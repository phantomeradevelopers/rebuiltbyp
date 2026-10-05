import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferralRewardsView = {
  config: {
    activity_threshold_checkins: number;
    reps_referrer: number;
    reps_referred: number;
    freeze_referrer: number;
    freeze_referred: number;
    enabled: boolean;
  } | null;
  my_claim_as_referred: {
    claimed_at: string;
    reps_referred: number;
    freeze_referred: number;
  } | null;
  claims_as_referrer_count: number;
};

export const getReferralRewardsView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralRewardsView> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const [{ data: cfg }, { data: mine }, { data: refs }] = await Promise.all([
      supabase.from("referral_reward_config").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("referral_rewards_claims")
        .select("claimed_at, reps_referred, freeze_referred")
        .eq("referred_user_id", userId)
        .maybeSingle(),
      supabase
        .from("referral_rewards_claims")
        .select("id")
        .eq("referrer_user_id", userId),
    ]);

    return {
      config: cfg ?? null,
      my_claim_as_referred: mine ?? null,
      claims_as_referrer_count: refs?.length ?? 0,
    };
  });

/**
 * Idempotent claim: safe to call from any Today mount. DB helper enforces
 * threshold + dedupe via referral_rewards_claims.referred_user_id UNIQUE.
 */
export const checkAndClaimReferralReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_referral_rewards_for", {
      p_referred: userId,
    });
    if (error) return { ok: false as const, reason: "error" };
    return { ok: true as const, result: data };
  });
