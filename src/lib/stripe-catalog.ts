/**
 * REBUILT billing catalog — single source of truth for what we sell.
 *
 * Prices here are the ones already configured in the project; they are
 * mirrored by the Stripe price IDs held in server env vars
 * (STRIPE_PRICE_*). Nothing here invents new pricing.
 */

export type SubscriptionPlanKey =
  | "pro_monthly"
  | "pro_annual"
  | "elite_monthly"
  | "elite_annual";

export type OneTimeKey = "course_full" | "mogul_bundle";

export type CheckoutItemKey = SubscriptionPlanKey | OneTimeKey;

export type CatalogEntry = {
  key: CheckoutItemKey;
  /** Product name shown on the checkout summary. */
  name: string;
  /** Short line under the name. */
  blurb: string;
  /** Amount in cents. */
  amount: number;
  /** Recurring interval, or null for one-time purchases. */
  interval: "month" | "year" | null;
  /** Free trial length in days (subscriptions only). */
  trialDays: number;
  /** Formatted price, e.g. "$14.99". */
  priceLabel: string;
  /** Formatted cadence, e.g. "/month". */
  cadenceLabel: string;
  /** California ARL renewal-terms sentence, shown before the pay button. */
  renewalTerms: string;
};

const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export const CATALOG: Record<CheckoutItemKey, CatalogEntry> = {
  pro_monthly: {
    key: "pro_monthly",
    name: "REBUILT Pro — Monthly",
    blurb: "Full app, Coach P, nutrition, plan, trophies.",
    amount: 1499,
    interval: "month",
    trialDays: 30,
    priceLabel: money(1499),
    cadenceLabel: "/month",
    renewalTerms:
      "Your first 30 days are free. After the trial, REBUILT Pro renews automatically at $14.99 per month until you cancel. You can cancel in one step from Settings at any time.",
  },
  pro_annual: {
    key: "pro_annual",
    name: "REBUILT Pro — Annual",
    blurb: "Full app, billed once a year.",
    amount: 12900,
    interval: "year",
    trialDays: 30,
    priceLabel: money(12900),
    cadenceLabel: "/year",
    renewalTerms:
      "Your first 30 days are free. After the trial, REBUILT Pro renews automatically at $129 per year until you cancel. You can cancel in one step from Settings at any time.",
  },
  elite_monthly: {
    key: "elite_monthly",
    name: "REBUILT Elite — Monthly",
    blurb: "Everything in Pro plus consults and perks.",
    amount: 2499,
    interval: "month",
    trialDays: 30,
    priceLabel: money(2499),
    cadenceLabel: "/month",
    renewalTerms:
      "Your first 30 days are free. After the trial, REBUILT Elite renews automatically at $24.99 per month until you cancel. You can cancel in one step from Settings at any time.",
  },
  elite_annual: {
    key: "elite_annual",
    name: "REBUILT Elite — Annual",
    blurb: "Everything in Pro plus consults, billed yearly.",
    amount: 21900,
    interval: "year",
    trialDays: 30,
    priceLabel: money(21900),
    cadenceLabel: "/year",
    renewalTerms:
      "Your first 30 days are free. After the trial, REBUILT Elite renews automatically at $219 per year until you cancel. You can cancel in one step from Settings at any time.",
  },
  course_full: {
    key: "course_full",
    name: "REBUILT Course — Lifetime",
    blurb: "The full course plus lifetime Pro access.",
    amount: 49700,
    interval: null,
    trialDays: 0,
    priceLabel: money(49700),
    cadenceLabel: "one-time",
    renewalTerms:
      "This is a single one-time charge of $497. It does not renew and you will not be billed again.",
  },
  mogul_bundle: {
    key: "mogul_bundle",
    name: "REBUILT Mogul Bundle",
    blurb: "All four Mogul guides, delivered in your library.",
    amount: 9900,
    interval: null,
    trialDays: 0,
    priceLabel: money(9900),
    cadenceLabel: "one-time",
    renewalTerms:
      "This is a single one-time charge of $99. It does not renew and you will not be billed again.",
  },
};

export const SUBSCRIPTION_KEYS: SubscriptionPlanKey[] = [
  "pro_monthly",
  "pro_annual",
  "elite_monthly",
  "elite_annual",
];

export function isSubscription(key: CheckoutItemKey): key is SubscriptionPlanKey {
  return CATALOG[key].interval !== null;
}

/** Plain-language refund stance, shown at checkout (required to be clear). */
export const REFUND_STANCE =
  "Cancel any time. You keep access through the end of the period you already paid for. We do not refund months already billed and we do not prorate.";

/** What the buyer will see on their bank statement. */
export const STATEMENT_DESCRIPTOR = "EEE INTL* REBUILT";

/* ------------------------------------------------------------------ */
/* Payment methods — split by product type, gated by amount            */
/* ------------------------------------------------------------------ */

export type PayMethod =
  | "card"
  | "link"
  | "cashapp"
  | "affirm"
  | "klarna"
  | "afterpay_clearpay";

/**
 * BNPL amount windows (USD cents) as enforced by the providers themselves.
 * A mark is never rendered for a product outside its provider's window.
 */
const BNPL_RANGE: Record<"affirm" | "klarna" | "afterpay_clearpay", [number, number]> = {
  affirm: [5000, 3000000], // $50 min
  klarna: [100, 500000], // $5,000 max
  afterpay_clearpay: [100, 400000], // $4,000 max
};

/**
 * The exact Stripe payment_method_types offered for a catalog item.
 *
 * One-time: card (Apple Pay / Google Pay ride on the card rail), Link,
 * Cash App Pay, plus Affirm / Klarna / Afterpay when the amount sits inside
 * that provider's supported window.
 *
 * Subscriptions (auto-charged): card and Link only — plus Apple Pay and
 * Google Pay, which ride the card rail via the Express Checkout Element.
 *  - Afterpay has no recurring support at all.
 *  - Affirm cannot do setup_future_usage (send_invoice collection only).
 *  - Klarna can save a mandate, but a real renewal charge has not been
 *    verified on this account, so it stays off rather than shipping a plan
 *    that silently fails to renew.
 *  - Cash App Pay is left off subscriptions too: card / wallets / Link are
 *    the methods verified to renew here.
 */
export function paymentMethodsFor(key: CheckoutItemKey): PayMethod[] {
  const entry = CATALOG[key];
  if (entry.interval) return ["card", "link"];

  const base: PayMethod[] = ["card", "link", "cashapp"];
  const bnpl = (["affirm", "klarna", "afterpay_clearpay"] as const).filter((m) => {
    const [min, max] = BNPL_RANGE[m];
    return entry.amount >= min && entry.amount <= max;
  });
  return [...base, ...bnpl];
}


/** Display labels for the accepted-methods row (only for methods that render). */
export const PAY_METHOD_LABEL: Record<PayMethod | "apple_pay" | "google_pay", string> = {
  card: "Card",
  link: "Link",
  cashapp: "Cash App Pay",
  affirm: "Affirm",
  klarna: "Klarna",
  afterpay_clearpay: "Afterpay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

