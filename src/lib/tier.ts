// Client-safe tier helpers. Mirrors the server `has_tier` ordering.
export type Tier = "free" | "pro" | "elite" | "lifetime_pro";
export type Plan =
  | "pro_monthly"
  | "pro_annual"
  | "elite_monthly"
  | "elite_annual"
  | "course_full"
  | "course_installment";

const RANK: Record<Tier, number> = { free: 0, pro: 1, lifetime_pro: 1, elite: 2 };

export function hasTier(current: Tier | undefined | null, min: Tier): boolean {
  return (RANK[current ?? "free"] ?? 0) >= (RANK[min] ?? 0);
}

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
  lifetime_pro: "Lifetime Pro",
};

export const PLAN_LABEL: Record<Plan, string> = {
  pro_monthly: "Pro · Monthly",
  pro_annual: "Pro · Annual",
  elite_monthly: "Elite · Monthly",
  elite_annual: "Elite · Annual",
  course_full: "REBUILT Course · One-time",
  course_installment: "REBUILT Course · 3× installments",
};

export const PLAN_PRICE_CENTS: Record<Plan, number> = {
  pro_monthly: 1499,
  pro_annual: 12900,
  elite_monthly: 2499,
  elite_annual: 21900,
  course_full: 49700,
  course_installment: 17900, // per installment, billed 3x
};
