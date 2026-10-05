/**
 * QA PREVIEW MODE — server-only.
 *
 * A 6-digit code (env QA_PIN) unlocks a dedicated, fully-seeded demo account
 * so the whole app can be audited without creating a real account.
 *
 * Security notes:
 *  - QA_PIN is read from process.env inside handlers only. It is never sent to
 *    the browser, never returned by any server function, never logged.
 *  - QA_MODE_ENABLED is the kill switch. When it is not "true", /qa 404s and
 *    the demo account cannot be signed into at all.
 *  - Failed attempts are counted per IP in the database: 5 failures inside a
 *    15-minute window locks that IP for the rest of the window.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { regeneratePlanForUser } from "@/lib/profile.server";

export const QA_EMAIL = "qa-preview@rebuilt.test";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export function qaModeEnabled(): boolean {
  return String(process.env["QA_MODE_ENABLED"] ?? "").trim().toLowerCase() === "true";
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function clientIpFrom(request: Request | undefined): string {
  const h = request?.headers;
  return (
    h?.get("cf-connecting-ip") ||
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h?.get("x-real-ip") ||
    "unknown"
  );
}

type AttemptRow = { ip: string; attempts: number; window_start: string; locked_until: string | null };

async function readAttempts(ip: string): Promise<AttemptRow | null> {
  const { data } = await supabaseAdmin
    .from("qa_login_attempts")
    .select("ip, attempts, window_start, locked_until")
    .eq("ip", ip)
    .maybeSingle();
  return (data as AttemptRow | null) ?? null;
}

/** Throws a generic error when this IP is currently locked out. */
export async function assertNotLocked(ip: string) {
  const row = await readAttempts(ip);
  if (!row) return;
  const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60_000);
    throw new Error(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
}

async function recordFailure(ip: string) {
  const now = Date.now();
  const row = await readAttempts(ip);
  const windowStart = row ? new Date(row.window_start).getTime() : 0;
  const fresh = !row || now - windowStart > WINDOW_MINUTES * 60_000;
  const attempts = fresh ? 1 : (row?.attempts ?? 0) + 1;
  const lockedUntil =
    attempts >= MAX_ATTEMPTS
      ? new Date((fresh ? now : windowStart) + WINDOW_MINUTES * 60_000).toISOString()
      : null;
  await supabaseAdmin.from("qa_login_attempts").upsert(
    {
      ip,
      attempts,
      window_start: fresh ? new Date(now).toISOString() : new Date(windowStart).toISOString(),
      locked_until: lockedUntil,
    },
    { onConflict: "ip" },
  );
}

async function clearFailures(ip: string) {
  await supabaseAdmin.from("qa_login_attempts").delete().eq("ip", ip);
}

export function verifyPin(pin: string): boolean {
  const expected = String(process.env["QA_PIN"] ?? "");
  if (!/^\d{6}$/.test(expected)) return false;
  return timingSafeEqual(pin, expected);
}

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function dateDaysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/** Creates the QA demo user if missing and seeds believable sample data once. */
async function ensureQaUser(): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("user_profile")
    .select("user_id")
    .eq("email", QA_EMAIL)
    .maybeSingle();

  let userId = (existing as { user_id: string } | null)?.user_id ?? null;

  if (!userId) {
    const password = `Qa!${crypto.randomUUID()}`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: QA_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { demo: true, qa: true, first_name: "QA Preview" },
    });
    if (error || !created?.user) throw new Error("QA preview is unavailable.");
    userId = created.user.id;
  }

  await supabaseAdmin
    .from("user_profile")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      first_name: "QA Preview",
      is_demo: true,
      rebuilt_access: true,
      onboarding_completed_at: new Date().toISOString(),
      screener_passed: true,
      rebuilt_start_date: dateDaysAgo(11),
      tier: "elite",
      tier_source: "qa_preview",
      tier_granted_at: new Date().toISOString(),
      entitlement: "subscriber",
      entitlement_source: "qa_preview",
      gender: "male",
      track: "men",
      age: 38,
      height_cm: 183,
      weight_kg: 86,
      goal_weight_kg: 80,
      goals: ["strength", "fat_loss"],
      training_days_per_week: 4,
      session_minutes: 45,
      equipment_access: "full_gym",
      unit_system: "imperial",
      // No real outbound actions for this account.
      welcome_email_sent_at: new Date().toISOString(),
      notification_email: false,
      notification_push: false,
      notification_sms: false,
      meal_reminders_enabled: false,
      daily_motivation_enabled: false,
      notify_medications: false,
      updated_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("user_id", userId);

  await seedIfEmpty(userId);
  return userId;
}

async function seedIfEmpty(userId: string) {
  const { count } = await supabaseAdmin
    .from("daily_checkins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  // Check-ins — 7 consecutive days.
  const checkins = Array.from({ length: 7 }, (_, i) => ({
    user_id: userId,
    date: dateDaysAgo(i),
    mood: 6 + ((i * 3) % 4),
    energy: 5 + ((i * 2) % 5),
    sleep_hours: 6.5 + ((i % 3) * 0.5),
    stress: 3 + (i % 3),
    workout_completed: i % 3 !== 2,
    notes: i === 0 ? "Solid session. Legs felt strong." : null,
  }));
  await supabaseAdmin.from("daily_checkins").insert(checkins);

  // Meals — today and yesterday.
  const meals = [
    { day: 0, meal: "breakfast", name: "Eggs, oats and berries", calories: 520, protein_g: 38, carbs_g: 55, fat_g: 16 },
    { day: 0, meal: "lunch", name: "Chicken, rice and greens", calories: 680, protein_g: 52, carbs_g: 70, fat_g: 18 },
    { day: 1, meal: "dinner", name: "Salmon, potatoes, salad", calories: 720, protein_g: 46, carbs_g: 58, fat_g: 30 },
  ].map((m) => ({
    user_id: userId,
    date: dateDaysAgo(m.day),
    logged_at: isoDaysAgo(m.day),
    meal: m.meal,
    name: m.name,
    calories: m.calories,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    source: "meal_done",
  }));
  await supabaseAdmin.from("food_log").insert(meals);

  // Streaks.
  await supabaseAdmin.from("user_streaks").upsert(
    [
      { user_id: userId, kind: "checkin", current_count: 7, longest_count: 11, last_date: dateDaysAgo(0) },
      { user_id: userId, kind: "meal", current_count: 4, longest_count: 6, last_date: dateDaysAgo(0) },
      { user_id: userId, kind: "workout", current_count: 3, longest_count: 8, last_date: dateDaysAgo(1) },
    ],
    { onConflict: "user_id,kind" },
  );

  // Trophies — first three real achievements in the catalogue.
  const { data: ach } = await supabaseAdmin
    .from("achievements")
    .select("key")
    .eq("hidden", false)
    .order("sort_order", { ascending: true })
    .limit(3);
  if (ach?.length) {
    await supabaseAdmin.from("user_achievements").upsert(
      ach.map((a, i) => ({
        user_id: userId,
        achievement_key: (a as { key: string }).key,
        unlocked_at: isoDaysAgo(i + 1),
      })),
      { onConflict: "user_id,achievement_key" },
    );
  }

  // Coach P conversation.
  const { data: convo } = await supabaseAdmin
    .from("ai_coach_conversations")
    .insert({ user_id: userId, title: "Getting the first week right" })
    .select("id")
    .maybeSingle();
  const convoId = (convo as { id: string } | null)?.id;
  if (convoId) {
    await supabaseAdmin.from("ai_coach_messages").insert([
      { conversation_id: convoId, role: "user", content: "Knees ache on squat day. Should I push through?" },
      {
        conversation_id: convoId,
        role: "assistant",
        content: "No. Pain is information, not a test of character. Shorten the range, slow the tempo, keep the sets. We build around it, not through it.",
      },
      { conversation_id: convoId, role: "user", content: "Got it. And protein — am I low?" },
      {
        conversation_id: convoId,
        role: "assistant",
        content: "You're about 30g short most days. Add one full palm of protein at breakfast. That's the whole fix.",
      },
    ]);
  }

  // A plan in progress.
  try {
    const { data: plan } = await supabaseAdmin
      .from("user_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!plan) await regeneratePlanForUser(supabaseAdmin, userId);
  } catch (e) {
    console.error("qa seed plan failed", e);
  }
}

/**
 * Verifies the code and, on success, mints one-time credentials for the demo
 * account so the browser can sign in. Never returns anything derived from the PIN.
 */
export async function qaSignIn(pinRaw: unknown, ip: string): Promise<{ email: string; password: string }> {
  if (!qaModeEnabled()) throw new Error("Not found.");
  const pin = String(pinRaw ?? "").trim();
  await assertNotLocked(ip);
  if (!/^\d{6}$/.test(pin) || !verifyPin(pin)) {
    await recordFailure(ip);
    throw new Error("Incorrect code.");
  }
  await clearFailures(ip);

  const userId = await ensureQaUser();
  const password = `Qa!${crypto.randomUUID()}`;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error("QA preview is unavailable.");
  return { email: QA_EMAIL, password };
}
