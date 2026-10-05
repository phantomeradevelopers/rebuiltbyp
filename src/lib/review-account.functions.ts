import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Fixed App Store reviewer login. Password lives only in APPLE_REVIEW_PASSWORD. */
export const REVIEW_EMAIL = "appreview@rebuiltbyp.com";

/**
 * Idempotently provisions the App Store reviewer account using the
 * APPLE_REVIEW_PASSWORD secret. Only acts when the caller already knows the
 * correct password, so it can't be used to probe or reset anything.
 */
export const ensureReviewAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const secret = process.env.APPLE_REVIEW_PASSWORD;
    if (!secret || data.password !== secret) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_profile")
      .select("user_id")
      .eq("email", REVIEW_EMAIL)
      .maybeSingle();
    let userId = (existing as { user_id?: string } | null)?.user_id;
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: secret, email_confirm: true });
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: REVIEW_EMAIL,
        password: secret,
        email_confirm: true,
        user_metadata: { first_name: "App Review" },
      });
      if (error || !created?.user) return { ok: false };
      userId = created.user.id;
    }
    const now = new Date();
    const start = new Date(now.getTime() - 6 * 86400000);
    await supabaseAdmin
      .from("user_profile")
      .update({
        first_name: "App Review",
        rebuilt_access: true,
        is_demo: true,
        onboarding_completed_at: now.toISOString(),
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
        welcome_email_sent_at: now.toISOString(),
        notification_email: false,
        notification_sms: false,
        updated_at: now.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("user_id", userId);
    return { ok: true };
  });
