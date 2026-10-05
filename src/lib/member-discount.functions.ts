import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tier } from "@/lib/tier";
import { hasTier } from "@/lib/tier";

export type PartnerKey = "youthfullab" | "candyrx";

export type MemberDiscount = {
  partner: PartnerKey;
  partnerLabel: string;
  enabled: boolean;
  visible: boolean;
  unlocked: boolean;
  headline: string;
  description: string;
  code: string | null;
  checkoutUrl: string | null;
  tierLabel: string;
  comingSoon: boolean;
  discountPercent: number;
};

export type MemberDiscountResponse = {
  tier: Tier;
  isActive: boolean;
  discounts: MemberDiscount[];
};

type PartnerMeta = {
  label: string;
  checkoutUrl: string;
  description: string;
};

const PARTNER_META: Record<PartnerKey, PartnerMeta> = {
  youthfullab: {
    label: "YouthfulLab (research compounds)",
    checkoutUrl:
      process.env.YOUTHFULLAB_CHECKOUT_URL ?? "https://www.youthfullabusa.com",
    description:
      "Active-member discount. Products are sold by YouthfulLab under its own terms. 21+ · Research use only · Not medical advice.",
  },
  candyrx: {
    label: "CandyRx",
    checkoutUrl: process.env.CANDYRX_CHECKOUT_URL ?? "https://www.shopcandyrx.com",
    description:
      "Standing member discount at CandyRx. Prescription products dispensed by licensed providers — not medical advice.",
  },
};

function tierLabelFor(t: string): string {
  if (t === "elite") return "Member perk · Elite";
  if (t === "pro") return "Member perk · Pro";
  return "Member perk · Free";
}

export const getMemberDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberDiscountResponse> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    let tier: Tier = "free";
    let isActive = false;
    try {
      const { data } = await supabase
        .from("user_profile")
        .select("tier, entitlement, subscription_status, trial_ends_at")
        .eq("user_id", userId)
        .maybeSingle();
      tier = ((data?.tier as Tier | undefined) ?? "free") as Tier;
      const status = (data?.subscription_status as string | null) ?? null;
      const ent = (data?.entitlement as string | null) ?? "free";
      const trialEndsAt = (data?.trial_ends_at as string | null) ?? null;
      const trialing =
        status === "trialing" &&
        (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
      isActive =
        ent === "lifetime" ||
        status === "active" ||
        trialing ||
        tier === "lifetime_pro";
    } catch {
      // fall through with free
    }

    // Load admin-controlled configs
    const { data: cfgRows } = await supabase
      .from("partner_perk_config")
      .select("partner,enabled,discount_percent,tier_required");

    const cfgByPartner = new Map<
      PartnerKey,
      { enabled: boolean; discount_percent: number; tier_required: string }
    >();
    for (const r of (cfgRows ?? []) as Array<{
      partner: PartnerKey;
      enabled: boolean;
      discount_percent: number;
      tier_required: string;
    }>) {
      cfgByPartner.set(r.partner, r);
    }

    const discounts: MemberDiscount[] = [];
    for (const partner of ["youthfullab", "candyrx"] as PartnerKey[]) {
      const meta = PARTNER_META[partner];
      const cfg = cfgByPartner.get(partner);
      if (!cfg || !cfg.enabled) {
        // Hide entirely when partner perk not enabled by admin
        discounts.push({
          partner,
          partnerLabel: meta.label,
          enabled: false,
          visible: false,
          unlocked: false,
          headline: "",
          description: meta.description,
          code: null,
          checkoutUrl: meta.checkoutUrl,
          tierLabel: tierLabelFor(tier),
          comingSoon: true,
          discountPercent: 0,
        });
        continue;
      }

      const qualifies = hasTier(tier, cfg.tier_required as Tier) && isActive;
      let code: string | null = null;
      if (qualifies) {
        const { data } = await supabase.rpc("issue_member_perk_code", {
          p_partner: partner,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.code && row?.status === "active") code = row.code as string;
      }

      discounts.push({
        partner,
        partnerLabel: meta.label,
        enabled: true,
        visible: true,
        unlocked: qualifies && code !== null,
        headline: `${cfg.discount_percent}% off for ${cfg.tier_required.toUpperCase()}+ members`,
        description: meta.description,
        code,
        checkoutUrl: meta.checkoutUrl,
        tierLabel: `Member perk · ${cfg.tier_required.toUpperCase()}+`,
        comingSoon: false,
        discountPercent: cfg.discount_percent,
      });
    }

    return { tier, isActive, discounts };
  });
