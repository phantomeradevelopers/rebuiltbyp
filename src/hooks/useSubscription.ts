import { useCallback, useEffect, useState } from "react";
import { getMyStripeSubscription } from "@/lib/checkout.functions";
import { CATALOG, type CheckoutItemKey } from "@/lib/stripe-catalog";

export type PlanTier = "free" | "pro" | "elite" | "lifetime_pro";

export type StripeSubscription = {
  id: string;
  status: string;
  plan: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
};

export function tierFromPlan(plan: string | null | undefined): PlanTier {
  if (plan === "elite_monthly" || plan === "elite_annual") return "elite";
  if (plan === "course_full" || plan === "course_installment") return "lifetime_pro";
  if (plan) return "pro";
  return "free";
}

export function planLabel(plan: string | null | undefined): string {
  if (plan && plan in CATALOG) return CATALOG[plan as CheckoutItemKey].name;
  return "Free";
}

/** Live subscription state, read straight from Stripe (never a stale mirror). */
export function useSubscription() {
  const [subscription, setSubscription] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = (await getMyStripeSubscription()) as StripeSubscription | null;
      setSubscription(res ?? null);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const tier = tierFromPlan(subscription?.plan);
  const isActive =
    !!subscription &&
    ["active", "trialing", "past_due"].includes(subscription.status) &&
    (!subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd) > new Date());
  const isTrialing = subscription?.status === "trialing";

  return { subscription, tier, isActive, isTrialing, loading, refetch };
}
