import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** QA/demo accounts never count toward real numbers anywhere in this console. */
let demoIdsCache: { at: number; ids: string[] } | null = null;
export async function demoUserIds(): Promise<string[]> {
  if (demoIdsCache && Date.now() - demoIdsCache.at < 60_000) return demoIdsCache.ids;
  const { data } = await supabaseAdmin.from("user_profile").select("user_id").eq("is_demo", true).limit(1000);
  const ids = (data ?? []).map((r) => (r as { user_id: string }).user_id);
  demoIdsCache = { at: Date.now(), ids };
  return ids;
}
async function demoNotInList(): Promise<string | null> {
  const ids = await demoUserIds();
  return ids.length ? `(${ids.join(",")})` : null;
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}
function daysAgoDate(n: number) {
  return daysAgoIso(n).slice(0, 10);
}

/** Every feature we can measure, mapped to the table + timestamp column that records it. */
const FEATURES: { key: string; label: string; help: string; table: string; col: string; dateOnly?: boolean }[] = [
  { key: "coach", label: "Coach P chats", help: "AI coach messages sent", table: "ai_coach_messages", col: "created_at" },
  { key: "checkin", label: "Daily check-ins", help: "Morning check-ins completed", table: "daily_checkins", col: "date", dateOnly: true },
  { key: "food", label: "Plate snap & food logging", help: "Meals logged", table: "food_log", col: "date", dateOnly: true },
  { key: "journal", label: "Journal entries", help: "Voice + written journals", table: "voice_journals", col: "created_at" },
  { key: "breathe", label: "Breathe sessions", help: "Box-breathing sessions finished", table: "breathing_sessions", col: "created_at" },
  { key: "anchor", label: "Spirit & faith anchors", help: "Daily anchor reflections", table: "anchor_reflections", col: "anchor_date", dateOnly: true },
  { key: "mindset", label: "Mindset reps", help: "Mindset logs completed", table: "mindset_logs", col: "date", dateOnly: true },
  { key: "streak", label: "Streak activity", help: "Streak ticks recorded", table: "streak_events", col: "created_at" },
  { key: "trophies", label: "Trophies earned", help: "Achievements unlocked", table: "user_achievements", col: "unlocked_at" },
  { key: "weekly", label: "Weekly reviews", help: "Weekly reviews generated", table: "weekly_reviews", col: "generated_at" },
  { key: "readiness", label: "Readiness checks", help: "Readiness check-ins", table: "readiness_checkins", col: "day_date", dateOnly: true },
  { key: "gyms", label: "Gym visits", help: "Verified or detected gym visits", table: "gym_visits", col: "entered_at" },
  { key: "outdoor", label: "Outdoor sessions", help: "Walks, runs and hikes tracked", table: "outdoor_sessions", col: "started_at" },
  { key: "meds", label: "Medications", help: "Doses logged", table: "medication_doses", col: "created_at" },
  { key: "identity", label: "Identity contracts", help: "Identity milestone check-ins", table: "identity_checkins", col: "created_at" },
  { key: "xp", label: "Reps / XP events", help: "XP ledger entries", table: "xp_ledger", col: "created_at" },
];

async function countBetween(table: string, col: string, from: string, to?: string) {
  let q = supabaseAdmin.from(table as never).select("*", { count: "exact", head: true }).gte(col, from);
  if (to) q = q.lt(col, to);
  const notIn = await demoNotInList();
  if (notIn) q = q.not("user_id", "in", notIn);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

async function distinctUsers(table: string, col: string, from: string) {
  let dq = supabaseAdmin.from(table as never).select("user_id").gte(col, from).limit(20000);
  const notIn = await demoNotInList();
  if (notIn) dq = dq.not("user_id", "in", notIn);
  const { data, error } = await dq;
  if (error) return new Set<string>();
  return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean));
}

export async function featureUsage() {
  const rows = await Promise.all(
    FEATURES.map(async (f) => {
      const from30 = f.dateOnly ? daysAgoDate(30) : daysAgoIso(30);
      const from60 = f.dateOnly ? daysAgoDate(60) : daysAgoIso(60);
      const from7 = f.dateOnly ? daysAgoDate(7) : daysAgoIso(7);
      const [count30, count60, count7, users] = await Promise.all([
        countBetween(f.table, f.col, from30),
        countBetween(f.table, f.col, from60, from30),
        countBetween(f.table, f.col, from7),
        f.table === "nutrition_lessons" ? Promise.resolve(new Set<string>()) : distinctUsers(f.table, f.col, from30),
      ]);
      const change = count60 === 0 ? (count30 > 0 ? 100 : 0) : Math.round(((count30 - count60) / count60) * 100);
      return {
        key: f.key,
        label: f.label,
        help: f.help,
        count30,
        prev30: count60,
        count7,
        users30: users.size,
        change,
      };
    }),
  );
  rows.sort((a, b) => b.count30 - a.count30);
  return { features: rows };
}

const ACTIVITY_SOURCES: { table: string; col: string; dateOnly?: boolean }[] = [
  { table: "daily_checkins", col: "date", dateOnly: true },
  { table: "food_log", col: "date", dateOnly: true },
  { table: "ai_coach_messages", col: "created_at" },
  { table: "xp_ledger", col: "created_at" },
];

async function activeUserSet(days: number) {
  const sets = await Promise.all(
    ACTIVITY_SOURCES.map((s) =>
      s.table === "ai_coach_messages"
        ? Promise.resolve(new Set<string>())
        : distinctUsers(s.table, s.col, s.dateOnly ? daysAgoDate(days) : daysAgoIso(days)),
    ),
  );
  const all = new Set<string>();
  for (const s of sets) for (const u of s) all.add(u);
  return all;
}

export async function overview() {
  const [profiles, active1, active7, active30] = await Promise.all([
    supabaseAdmin.from("user_profile").select("user_id, created_at, tier, entitlement").eq("is_demo", false).limit(20000),
    activeUserSet(1),
    activeUserSet(7),
    activeUserSet(30),
  ]);
  const users = profiles.data ?? [];

  const signups = (days: number) => users.filter((u) => String(u.created_at) >= daysAgoIso(days)).length;

  // 30-day signup + active trend buckets
  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) buckets[daysAgoDate(i)] = 0;
  for (const u of users) {
    const k = String(u.created_at).slice(0, 10);
    if (k in buckets) buckets[k] = (buckets[k] ?? 0) + 1;
  }

  // Retention: of people who joined 8–38 days ago, how many were active in the last 7 days?
  const cohort = users.filter(
    (u) => String(u.created_at) < daysAgoIso(7) && String(u.created_at) >= daysAgoIso(38),
  );
  const retained = cohort.filter((u) => active7.has(u.user_id)).length;

  // Drop-off: joined more than 7 days ago and not active in 30 days.
  const older = users.filter((u) => String(u.created_at) < daysAgoIso(7));
  const dormant = older.filter((u) => !active30.has(u.user_id)).length;

  const tiers: Record<string, number> = {};
  for (const u of users) {
    const t = (u.tier as string) || "free";
    tiers[t] = (tiers[t] ?? 0) + 1;
  }

  return {
    users: users.length,
    signups7: signups(7),
    signups30: signups(30),
    active1: active1.size,
    active7: active7.size,
    active30: active30.size,
    retentionPct: cohort.length ? Math.round((retained / cohort.length) * 100) : 0,
    cohortSize: cohort.length,
    dormant,
    dormantPct: older.length ? Math.round((dormant / older.length) * 100) : 0,
    tiers: Object.entries(tiers)
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count),
    signupSeries: Object.entries(buckets).map(([date, count]) => ({ date, count })),
  };
}

export async function usersList() {
  const date30 = daysAgoDate(30);
  const [profilesRes, checkinsRes, mealsRes] = await Promise.all([
    supabaseAdmin
      .from("user_profile")
      .select("user_id, first_name, email, location, tier, entitlement, created_at, rebuilt_start_date").eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin.from("daily_checkins").select("user_id, date").gte("date", date30),
    supabaseAdmin.from("food_log").select("user_id").gte("date", date30),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const checkins = new Map<string, string[]>();
  for (const r of checkinsRes.data ?? []) {
    const arr = checkins.get(r.user_id) ?? [];
    arr.push(r.date);
    checkins.set(r.user_id, arr);
  }
  const meals = new Map<string, number>();
  for (const r of mealsRes.data ?? []) meals.set(r.user_id, (meals.get(r.user_id) ?? 0) + 1);

  return {
    users: (profilesRes.data ?? []).map((p) => {
      const loc = (p.location ?? {}) as { city?: string; country?: string };
      const ci = checkins.get(p.user_id) ?? [];
      return {
        user_id: p.user_id,
        name: p.first_name ?? "",
        email: p.email ?? "",
        place: [loc.city, loc.country].filter(Boolean).join(", "),
        tier: (p.tier as string) ?? "free",
        entitlement: (p.entitlement as string) ?? "free",
        joined: p.created_at ? String(p.created_at).slice(0, 10) : "",
        checkins30: ci.length,
        meals30: meals.get(p.user_id) ?? 0,
        lastActive: [...ci].sort().pop() ?? null,
      };
    }),
  };
}

export async function money() {
  const [subsRes, coursesRes, profilesRes] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("status, environment, product_id, current_period_end, cancel_at_period_end, created_at")
      .limit(5000),
    supabaseAdmin.from("course_purchases").select("email, purchased_at").limit(5000),
    supabaseAdmin.from("user_profile").select("tier, trial_ends_at, subscription_status").eq("is_demo", false).limit(20000),
  ]);

  const subs = subsRes.data ?? [];
  const byStatus: Record<string, number> = {};
  for (const s of subs) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

  const profiles = profilesRes.data ?? [];
  const now = Date.now();
  const onTrial = profiles.filter(
    (p) => p.trial_ends_at && new Date(String(p.trial_ends_at)).getTime() > now,
  ).length;
  const paidTiers = profiles.filter((p) => p.tier && p.tier !== "free").length;

  return {
    subscriptions: subs.length,
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    live: subs.filter((s) => s.environment === "live").length,
    sandbox: subs.filter((s) => s.environment !== "live").length,
    cancelling: subs.filter((s) => s.cancel_at_period_end).length,
    onTrial,
    paidTiers,
    coursePurchases: (coursesRes.data ?? []).length,
    recentCourses: (coursesRes.data ?? [])
      .slice()
      .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)))
      .slice(0, 20)
      .map((c) => ({ email: c.email, purchased_at: String(c.purchased_at).slice(0, 10) })),
  };
}

export async function contentStats() {
  const tables = [
    { key: "Meals in library", table: "meals" },
    { key: "Nutrition Academy lessons", table: "nutrition_lessons" },
    { key: "Exercise videos", table: "exercise_videos" },
    { key: "Daily quotes", table: "daily_quotes" },
    { key: "Daily affirmations", table: "daily_affirmations" },
    { key: "Daily lessons", table: "daily_lessons" },
    { key: "Achievements defined", table: "achievements" },
    { key: "Outdoor routes", table: "outdoor_routes" },
    { key: "Gyms", table: "gyms" },
    { key: "Public reviews", table: "public_reviews" },
  ];
  const rows = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabaseAdmin.from(t.table as never).select("*", { count: "exact", head: true });
      return { key: t.key, count: count ?? 0 };
    }),
  );
  return { rows };
}
