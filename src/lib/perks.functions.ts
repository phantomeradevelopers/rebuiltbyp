import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PartnerKey = "youthfullab" | "candyrx";

export type PartnerPerkConfig = {
  partner: PartnerKey;
  enabled: boolean;
  discount_percent: number;
  tier_required: "free" | "pro" | "elite";
  updated_at: string;
};

export type MyPerkCode = {
  partner: PartnerKey;
  code: string;
  discount_percent: number;
  tier_required: string;
  status: "active" | "revoked";
};

export const listPartnerPerkConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerPerkConfig[]> => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("partner_perk_config")
      .select("partner,enabled,discount_percent,tier_required,updated_at")
      .order("partner");
    if (error) throw new Error(error.message);
    return (data ?? []) as PartnerPerkConfig[];
  });

const configInput = z.object({
  partner: z.enum(["youthfullab", "candyrx"]),
  enabled: z.boolean(),
  discount_percent: z.number().int().min(0).max(90),
  tier_required: z.enum(["free", "pro", "elite"]),
});

export const setPartnerPerkConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => configInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("partner_perk_config")
      .upsert(
        {
          partner: data.partner,
          enabled: data.enabled,
          discount_percent: data.discount_percent,
          tier_required: data.tier_required,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "partner" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Returns the current user's live perk codes. Auto-issues a code per enabled
 * partner when the user's tier + entitlement qualify.
 */
export const getMyPerkCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPerkCode[]> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Only issue for members with active entitlement
    const { data: prof } = await supabase
      .from("user_profile")
      .select("tier, entitlement, subscription_status, trial_ends_at")
      .eq("user_id", userId)
      .maybeSingle();
    const status = (prof?.subscription_status as string | null) ?? null;
    const ent = (prof?.entitlement as string | null) ?? "free";
    const trialEndsAt = (prof?.trial_ends_at as string | null) ?? null;
    const trialing =
      status === "trialing" &&
      (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
    const isActive =
      ent === "lifetime" ||
      status === "active" ||
      trialing ||
      prof?.tier === "lifetime_pro";
    if (!isActive) return [];

    const partners: PartnerKey[] = ["youthfullab", "candyrx"];
    const out: MyPerkCode[] = [];
    for (const partner of partners) {
      const { data, error } = await supabase.rpc("issue_member_perk_code", {
        p_partner: partner,
      });
      if (error) continue;
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.code) {
        out.push({
          partner,
          code: row.code,
          discount_percent: row.discount_percent,
          tier_required: row.tier_required,
          status: row.status,
        });
      }
    }
    return out;
  });
