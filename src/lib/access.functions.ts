import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tier } from "@/lib/tier";

export type Entitlement = "free" | "subscriber" | "lifetime";

export type AccessStatus = {
  hasAccess: boolean;
  onboardingComplete: boolean;
  screenerPassed: boolean | null;
  email: string;
  firstName: string | null;
  isDemo: boolean;
  currentDay: number;
  needsGender: boolean;
  entitlement: Entitlement;
  entitlementSource: string | null;
  tier: Tier;
  tierSource: string | null;
  track: "men" | "angels";
};

export const getAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("rebuilt_access, onboarding_completed_at, screener_passed, email, first_name, rebuilt_start_date, gender, entitlement, entitlement_source, tier, tier_source, track, welcome_email_sent_at" as any)
      .eq("user_id", userId)
      .maybeSingle();



    if (error) {
      console.error("getAccessStatus error", error);
      throw new Error("Could not load your profile.");
    }

    // Auto-restore: re-check course_purchases on every load so $497 buyers
    // who sign up later still unlock without doing anything.
    const row = (data ?? {}) as Record<string, unknown>;
    let entitlement = (row.entitlement as Entitlement | undefined) ?? "free";
    let entitlementSource = (row.entitlement_source as string | null | undefined) ?? null;
    if (entitlement === "free" && row.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: granted } = await (supabase.rpc as any)("restore_my_purchase");
      if (granted === "lifetime" || granted === "subscriber") {
        entitlement = granted;
        entitlementSource = "course_497";
      }
    }
    // App is free for everyone. Paid features are gated per-feature, not via hasAccess.
    const hasAccess = true;

    const email = (row.email as string | undefined) ?? "";
    const firstName = (row.first_name as string | null | undefined) ?? null;
    const tier = ((row.tier as Tier | undefined) ?? "free") as Tier;

    // Auto-send the REBUILT welcome email once per new signup. Existing users
    // were backfilled with welcome_email_sent_at = now() in the migration, so
    // this only ever fires for accounts created after the feature shipped.
    if (!row.welcome_email_sent_at && email) {
      try {
        const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");
        const bonusAccess: "full" | "free" =
          entitlement === "lifetime" ||
          entitlement === "subscriber" ||
          tier === "pro" ||
          tier === "elite" ||
          tier === "lifetime_pro"
            ? "full"
            : "free";
        const result = await enqueueRebuiltEmail({
          templateName: "welcome",
          recipientEmail: email,
          templateData: { firstName: firstName ?? undefined, bonusAccess },
          idempotencyKey: `welcome:${userId}`,
        });
        // Mark sent even on 'suppressed' so we don't retry every request.
        if (result.ok || (!result.ok && result.reason === "suppressed")) {
          await supabase
            .from("user_profile")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ welcome_email_sent_at: new Date().toISOString() } as any)
            .eq("user_id", userId);
        }
      } catch (err) {
        console.error("welcome-email enqueue failed", err);
      }
    }

    let currentDay = 1;
    if (row.rebuilt_start_date) {
      const start = new Date(String(row.rebuilt_start_date) + "T00:00:00");
      const now = new Date();
      const now0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      currentDay = Math.max(1, Math.floor((now0.getTime() - start.getTime()) / 86_400_000) + 1);
    }

    const gender = (row.gender as string | null | undefined) ?? null;

    return {
      hasAccess,
      onboardingComplete: Boolean(row.onboarding_completed_at),
      screenerPassed: (row.screener_passed as boolean | null | undefined) ?? null,
      email,
      firstName: (row.first_name as string | null | undefined) ?? null,
      isDemo: email.endsWith("@rebuilt.test"),
      currentDay,
      needsGender: Boolean(row.onboarding_completed_at) && (gender !== "male" && gender !== "female"),
      entitlement,
      entitlementSource,
      tier: ((row.tier as Tier | undefined) ?? "free") as Tier,
      tierSource: (row.tier_source as string | null | undefined) ?? null,
      track: ((row.track as string | null | undefined) === "angels" ? "angels" : "men"),
    };
  });

export const setGender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = (input as { gender?: string })?.gender;
    if (v !== "male" && v !== "female") throw new Error("Please choose Man or Woman.");
    return { gender: v as "male" | "female" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Auto-default the track for women on first gender selection, only if not
    // already set to a non-default value. Users can flip in Settings anytime.
    const patch: Record<string, unknown> = { gender: data.gender, updated_at: new Date().toISOString() };
    if (data.gender === "female") {
      const { data: row } = await supabase
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("track" as any)
        .eq("user_id", userId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!row || ((row as any).track ?? "men") === "men") patch.track = "angels";
    }
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("user_id", userId);
    if (error) throw new Error("Could not save your choice.");
    return { ok: true as const };
  });
