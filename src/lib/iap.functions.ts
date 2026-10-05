import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Apple In-App Purchase (RevenueCat) — used only inside the iOS app.
 * Web purchases stay on Stripe.
 */
export const getRevenueCatConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.REVENUECAT_IOS_KEY ?? null;
    return { apiKey, appUserId: context.userId };
  });

const PRODUCT_TO_PLAN: Record<string, { tier: "pro" | "elite"; plan: string }> = {
  "rebuilt.pro.monthly": { tier: "pro", plan: "pro_monthly" },
  "rebuilt.pro.yearly": { tier: "pro", plan: "pro_annual" },
  "rebuilt.elite.monthly": { tier: "elite", plan: "elite_monthly" },
  "rebuilt.elite.yearly": { tier: "elite", plan: "elite_annual" },
};

/**
 * Server-side verification: asks RevenueCat for this user's active
 * subscriptions (never trusts the device) and updates the tier.
 */
export const syncAppleEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.REVENUECAT_IOS_KEY;
    if (!apiKey) throw new Error("In-app purchases are not configured yet.");
    const { userId } = context;
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${apiKey}`, "X-Platform": "ios" } },
    );
    if (!res.ok) throw new Error("Could not verify purchase. Try again.");
    const body = (await res.json()) as {
      subscriber?: { subscriptions?: Record<string, { expires_date: string | null; period_type?: string }> };
    };
    const subs = body.subscriber?.subscriptions ?? {};
    const now = Date.now();
    let best: { tier: "pro" | "elite"; plan: string; trial: boolean; expires: string | null } | null = null;
    for (const [productId, s] of Object.entries(subs)) {
      const map = PRODUCT_TO_PLAN[productId];
      if (!map) continue;
      const active = !s.expires_date || new Date(s.expires_date).getTime() > now;
      if (!active) continue;
      if (!best || (map.tier === "elite" && best.tier === "pro")) {
        best = { ...map, trial: s.period_type === "trial", expires: s.expires_date };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("tier, tier_source" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const row = (profile ?? {}) as { tier?: string; tier_source?: string | null };

    if (best) {
      await supabaseAdmin
        .from("user_profile")
        .update({
          tier: best.tier,
          tier_source: "apple_iap",
          subscription_status: best.trial ? "trialing" : "active",
          subscription_plan: best.plan,
          updated_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("user_id", userId);
      return { tier: best.tier };
    }
    // Only downgrade tiers that Apple granted — never touch Stripe or lifetime access.
    if (row.tier_source === "apple_iap" && row.tier !== "free") {
      await supabaseAdmin
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ tier: "free", subscription_status: "canceled", updated_at: new Date().toISOString() } as any)
        .eq("user_id", userId);
      return { tier: "free" };
    }
    return { tier: row.tier ?? "free" };
  });
