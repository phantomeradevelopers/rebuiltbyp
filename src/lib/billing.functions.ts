import { createServerFn } from "@tanstack/react-start";
import { getStripe, priceIdFor } from "@/lib/stripe-server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Plan, Tier } from "@/lib/tier";

export type BillingStatus = {
  tier: Tier;
  tierSource: string | null;
  entitlement: "free" | "subscriber" | "lifetime";
  subscriptionStatus: string | null;
  subscriptionPlan: Plan | null;
  trialEndsAt: string | null;
  isMember: boolean; // legacy: any paid tier or trialing
  isPro: boolean;
  isElite: boolean;
  isLifetime: boolean;
  isTrialing: boolean;
};

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingStatus> => {
    const { supabase, userId } = context;
    try {
      const { data } = await supabase
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("tier, tier_source, entitlement, subscription_status, subscription_plan, trial_ends_at" as any)
        .eq("user_id", userId)
        .maybeSingle();

      const row = (data ?? {}) as Record<string, unknown>;
      const tier = ((row.tier as Tier | undefined) ?? "free") as Tier;
      const tierSource = (row.tier_source as string | null) ?? null;
      const entitlement = ((row.entitlement as string) ?? "free") as BillingStatus["entitlement"];
      const subscriptionStatus = (row.subscription_status as string | null) ?? null;
      const subscriptionPlan = (row.subscription_plan as Plan | null) ?? null;
      const trialEndsAt = (row.trial_ends_at as string | null) ?? null;

      const isTrialing = subscriptionStatus === "trialing" &&
        (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
      const isPro = tier === "pro" || tier === "elite" || tier === "lifetime_pro" || isTrialing;
      const isElite = tier === "elite";
      const isLifetime = tier === "lifetime_pro";
      const isMember = isPro;

      return { tier, tierSource, entitlement, subscriptionStatus, subscriptionPlan, trialEndsAt, isMember, isPro, isElite, isLifetime, isTrialing };
    } catch (e) {
      console.error("getBillingStatus failed; serving free fallback", e);
      return {
        tier: "free",
        tierSource: null,
        entitlement: "free",
        subscriptionStatus: null,
        subscriptionPlan: null,
        trialEndsAt: null,
        isMember: false,
        isPro: false,
        isElite: false,
        isLifetime: false,
        isTrialing: false,
      };
    }
  });

const PLAN_SCHEMA = z.enum([
  "pro_monthly",
  "pro_annual",
  "elite_monthly",
  "elite_annual",
  "course_full",
  "course_installment",
]);

function priceEnvFor(plan: Plan): string | undefined {
  return priceIdFor(plan);
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: PLAN_SCHEMA }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const price = priceEnvFor(data.plan);
    if (!price) throw new Error(`Missing Stripe price ID for ${data.plan}. Please configure it.`);

    const stripe = await getStripe();

    const { data: profile } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("email, stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const row = (profile ?? {}) as Record<string, unknown>;
    const email = (row.email as string | undefined) ?? undefined;
    const customerId = (row.stripe_customer_id as string | null) ?? undefined;

    const origin = process.env.PUBLIC_SITE_URL || "https://rebuilt-pathway.lovable.app";
    const isCourse = data.plan === "course_full" || data.plan === "course_installment";
    const isInstallment = data.plan === "course_installment";

    // Course one-time
    if (data.plan === "course_full") {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : email,
        client_reference_id: userId,
        allow_promotion_codes: true,
        metadata: { supabase_user_id: userId, plan: data.plan, grants: "lifetime_pro" },
        success_url: `${origin}/app/account?upgrade=success`,
        cancel_url: `${origin}/pricing?canceled=1`,
      });
      return { url: session.url };
    }

    // Course 3-installment: a 3-cycle subscription that grants lifetime up-front,
    // continues billing 3x, then cancels. Stripe enforces cycle count via `iterations`.
    if (isInstallment) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : email,
        client_reference_id: userId,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { supabase_user_id: userId, plan: data.plan, grants: "lifetime_pro" },
        },
        metadata: { supabase_user_id: userId, plan: data.plan, grants: "lifetime_pro" },
        success_url: `${origin}/app/account?upgrade=success`,
        cancel_url: `${origin}/pricing?canceled=1`,
      });
      return { url: session.url };
    }

    // Regular subscription (Pro / Elite) — Stripe path kept dark for migration reference.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      client_reference_id: userId,
      allow_promotion_codes: true,
      payment_method_collection: "always",
      subscription_data: {
        metadata: { supabase_user_id: userId, plan: data.plan },
      },
      metadata: { supabase_user_id: userId, plan: data.plan },
      success_url: `${origin}/app/account?upgrade=success`,
      cancel_url: `${origin}/pricing?canceled=1`,
    });

    return { url: session.url };
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    const { data: profile } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = ((profile ?? {}) as Record<string, unknown>).stripe_customer_id as string | null;
    if (!customerId) throw new Error("No billing account yet. Start a trial first.");

    const stripe = await getStripe();
    const origin = process.env.PUBLIC_SITE_URL || "https://rebuilt-pathway.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/account`,
    });
    return { url: portal.url };
  });

/**
 * Cancel the user's active Stripe subscription at period end.
 * Looks the subscription up on the Stripe customer (source of truth) and only
 * falls back to the legacy consult_subscription row.
 */
export const cancelStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const stripe = await getStripe();

    const { data: profile } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = ((profile ?? {}) as Record<string, unknown>)
      .stripe_customer_id as string | null;

    let subId: string | undefined;
    if (customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      subId = subs.data.find((s) =>
        ["active", "trialing", "past_due", "unpaid"].includes(s.status),
      )?.id;
    }

    if (!subId) {
      const { data: sub } = await supabase
        .from("consult_subscription")
        .select("stripe_subscription_id, status")
        .eq("user_id", userId)
        .maybeSingle();
      subId = (sub as { stripe_subscription_id?: string } | null)
        ?.stripe_subscription_id;
    }
    if (!subId) throw new Error("No active subscription found.");

    const updated = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("consult_subscription")
      .update({ cancel_at_period_end: true })
      .eq("user_id", userId);

    return { ok: true, cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : null };
  });



