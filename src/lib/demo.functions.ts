import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "./rate-limit";

const DEMO_ACCOUNT_CAP = 500;

/**
 * Demo workflow:
 * - Admin-creates a confirmed throwaway user
 * - Grants rebuilt_access so paywall is bypassed
 * - Leaves onboarding incomplete so the user fills in their own info + goals
 * Returns credentials so the client can sign in with password.
 */
export const createDemoSession = createServerFn({ method: "POST" })
  .handler(async () => {
    // Per-IP rate limit to prevent account-creation spam against this
    // unauthenticated endpoint.
    const request = getRequest();
    if (request) {
      const limited = enforceRateLimit(request, { id: "create_demo_session", perMinute: 3 });
      if (limited) throw new Error("Too many demo requests. Please wait a minute and try again.");
    }

    // Global cap on active demo accounts to bound abuse of admin createUser.
    const { count } = await supabaseAdmin
      .from("user_profile")
      .select("user_id", { count: "exact", head: true })
      .like("email", "demo+%@rebuilt.test");
    if ((count ?? 0) >= DEMO_ACCOUNT_CAP) {
      throw new Error("Demo capacity reached. Please try again later.");
    }

    const rand = Math.random().toString(36).slice(2, 10);
    const email = `demo+${rand}@rebuilt.test`;
    const password = `Demo!${Math.random().toString(36).slice(2, 12)}`;

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { demo: true, first_name: "Demo" },
    });
    if (cErr || !created?.user) {
      console.error("demo create", cErr);
      throw new Error("Could not start demo. Try again.");
    }
    const userId = created.user.id;

    const nowIso = new Date().toISOString();
    const start = new Date();
    start.setDate(start.getDate() - 6);

    const { error: upErr } = await supabaseAdmin
      .from("user_profile")
      .update({
        first_name: "Demo",
        rebuilt_access: true,
        // Skip the 13-step flow entirely: sensible demo answers, marked complete.
        onboarding_completed_at: nowIso,
        screener_passed: true,
        rebuilt_start_date: start.toISOString().slice(0, 10),
        gender: "male",
        track: "men",
        age: 34,
        height_cm: 180,
        weight_kg: 88,
        goal_weight_kg: 80,
        goals: ["strength", "fat_loss"],
        training_days_per_week: 4,
        session_minutes: 45,
        equipment_access: "full_gym",
        unit_system: "imperial",
        country_code: "US",
        // No real outbound actions for demo accounts.
        welcome_email_sent_at: nowIso,
        notification_email: false,
        notification_sms: false,
        daily_motivation_enabled: false,
        notification_push: false,
        updated_at: nowIso,
      } as any)
      .eq("user_id", userId);
    if (upErr) console.error("demo profile", upErr);

    // Guarantee the demo skips onboarding: confirm the flag landed, retry if not.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: chk } = await supabaseAdmin
        .from("user_profile")
        .select("onboarding_completed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if ((chk as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at) break;
      await new Promise((r) => setTimeout(r, 250));
      await supabaseAdmin
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ user_id: userId, email, first_name: "Demo", rebuilt_access: true, onboarding_completed_at: nowIso, screener_passed: true, rebuilt_start_date: start.toISOString().slice(0, 10), gender: "male", track: "men" } as any, { onConflict: "user_id" });
    }

    return { email, password };
  });


/**
 * Demo time machine: shift the user's rebuilt_start_date so the dashboard
 * thinks "today" is the specified day in the program. Only works for
 * @rebuilt.test demo accounts.
 */
export const setDemoDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ day: z.number().int().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile").select("email").eq("user_id", userId).maybeSingle();
    if (!prof?.email?.endsWith("@rebuilt.test")) {
      throw new Error("Demo time machine is only available on demo accounts.");
    }
    const start = new Date();
    start.setDate(start.getDate() - (data.day - 1));
    const startStr = start.toISOString().slice(0, 10);
    const { error } = await supabase
      .from("user_profile")
      .update({ rebuilt_start_date: startStr })
      .eq("user_id", userId);
    if (error) throw new Error("Could not update demo day.");
    return { day: data.day, startDate: startStr };
  });

/**
 * Exit demo: deletes the demo user account entirely (cascades all data).
 * Only works for @rebuilt.test demo accounts.
 */
export const exitDemoSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile").select("email").eq("user_id", userId).maybeSingle();
    if (!prof?.email?.endsWith("@rebuilt.test")) {
      throw new Error("Exit demo is only available on demo accounts.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("demo delete", error);
      throw new Error("Could not exit demo.");
    }
    return { ok: true };
  });

/* ============================================================
 * Claim demo: convert the throwaway @rebuilt.test account into
 * a real account with the user's own email + password. Keeps the
 * same user_id, so all plan / check-in / journal / photo / AI
 * coach data automatically stays attached.
 * ============================================================ */

export const claimDemoAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      password: z.string().min(8).max(72),
      firstName: z.string().trim().min(1).max(80).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: prof } = await supabaseAdmin
      .from("user_profile")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof?.email?.endsWith("@rebuilt.test")) {
      throw new Error("Only demo accounts can be saved this way.");
    }

    // Reject if another auth user already uses the target email.
    const { data: existing } = await supabaseAdmin
      .from("user_profile")
      .select("user_id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing && existing.user_id !== userId) {
      throw new Error("That email is already in use. Try signing in instead.");
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        demo: false,
        claimed_at: new Date().toISOString(),
        ...(data.firstName ? { first_name: data.firstName } : {}),
      },
    });
    if (updErr) {
      console.error("claim demo updateUser", updErr);
      const msg = /already|registered|exists/i.test(updErr.message)
        ? "That email is already in use. Try signing in instead."
        : "Could not save your account. Try a different email.";
      throw new Error(msg);
    }

    const profileUpdate = data.firstName
      ? { email: data.email, first_name: data.firstName }
      : { email: data.email };
    const { error: pErr } = await supabaseAdmin
      .from("user_profile")
      .update(profileUpdate)
      .eq("user_id", userId);

    if (pErr) console.error("claim demo profile", pErr);

    return { email: data.email };
  });

