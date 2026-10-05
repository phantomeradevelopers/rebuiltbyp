import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferralInfo = {
  code: string;
  signups: number;   // people who set referred_by to me
  converted: number; // of those, completed onboarding
  referredByCode: string | null; // who invited me (display only)
};

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralInfo> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: me, error: meErr } = await supabase
      .from("user_profile")
      .select("referral_code, referred_by")
      .eq("user_id", userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    if (!me?.referral_code) throw new Error("Referral code not yet assigned.");

    const { data: refs, error: refErr } = await supabase
      .from("user_profile")
      .select("onboarding_completed_at")
      .eq("referred_by", userId);
    if (refErr) throw new Error(refErr.message);

    const signups = refs?.length ?? 0;
    const converted = (refs ?? []).filter((r: any) => !!r.onboarding_completed_at).length;

    let referredByCode: string | null = null;
    if (me.referred_by) {
      const { data: byUser } = await supabase
        .from("user_profile")
        .select("referral_code")
        .eq("user_id", me.referred_by)
        .maybeSingle();
      referredByCode = byUser?.referral_code ?? null;
    }

    return { code: me.referral_code, signups, converted, referredByCode };
  });

/**
 * Redeem a referral code. Sets the caller's `referred_by` to the owner of the
 * given code if not already set. Self-referrals and unknown codes are rejected
 * silently (no-op) to avoid leaking validity.
 */
export const redeemReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(16) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const code = data.code.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const { data: me } = await supabase
      .from("user_profile")
      .select("referred_by")
      .eq("user_id", userId)
      .maybeSingle();
    if (me?.referred_by) return { ok: true, alreadyReferred: true };

    const { data: owner } = await supabase
      .from("user_profile")
      .select("user_id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!owner || owner.user_id === userId) return { ok: true, redeemed: false };

    const { error } = await supabase
      .from("user_profile")
      .update({ referred_by: owner.user_id, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { ok: true, redeemed: true };
  });
