/**
 * Server-side Stripe wiring for REBUILT.
 *
 * Single place that decides WHICH Stripe account we charge on and in which
 * mode. Everything server-side must go through here so we can never
 * accidentally fall back to the old Lovable-managed sandbox account.
 *
 * Account: EEE International LLC — acct_1QvqlvLbOwHrqvEJ (live).
 * Live key: STRIPE_SECRET_KEY_EEE (restricted live key on that account).
 *
 * TEST MODE
 * ---------
 * Set STRIPE_MODE=test (plus STRIPE_SECRET_KEY_TEST /
 * STRIPE_PUBLISHABLE_KEY_TEST) in the preview environment ONLY. Production
 * never opts in by accident: without an explicit STRIPE_MODE=test we always
 * resolve the live key, and a `_test_` key is never accepted in live mode.
 * In test mode the catalog is mirrored automatically — prices are looked up
 * by lookup key (`rebuilt_<item>`) and created on first use — so nobody has
 * to hand-maintain a second set of price IDs.
 */

import { CATALOG, type CheckoutItemKey } from "@/lib/stripe-catalog";
import type Stripe from "stripe";

/** The only account REBUILT is allowed to charge on. */
export const REBUILT_STRIPE_ACCOUNT = "acct_1QvqlvLbOwHrqvEJ";

/** Suffix appended to the account descriptor => "EEE INTL* REBUILT". */
export const STATEMENT_DESCRIPTOR_SUFFIX = "REBUILT";

export type StripeMode = "live" | "test";

/** Live unless the environment explicitly opts into test mode. */
export function stripeMode(): StripeMode {
  return process.env["STRIPE_MODE"] === "test" &&
    !!process.env["STRIPE_SECRET_KEY_TEST"]
    ? "test"
    : "live";
}

/**
 * Live price IDs created on the EEE account. These are public identifiers,
 * not secrets. Env vars may override them, but the defaults are the truth so
 * a missing/stale secret can never silently point checkout somewhere else.
 */
export const LIVE_PRICE_IDS: Record<string, string> = {
  pro_monthly: "price_1U0csDLbOwHrqvEJ4eNgDM9n",
  pro_annual: "price_1U0csDLbOwHrqvEJsc1jJ88y",
  elite_monthly: "price_1U0csELbOwHrqvEJigzKBoPo",
  elite_annual: "price_1U0csELbOwHrqvEJjd6sC4cL",
  course_full: "price_1U0csELbOwHrqvEJ3JOi7NJk",
  mogul_bundle: "price_1U0csELbOwHrqvEJfStCfMUw",
};

/** Resolve the LIVE Stripe price for a catalog item. */
export function priceIdFor(key: CheckoutItemKey | string): string | undefined {
  const override = {
    pro_monthly: process.env["STRIPE_PRICE_PRO_MONTHLY_EEE"],
    pro_annual: process.env["STRIPE_PRICE_PRO_ANNUAL_EEE"],
    elite_monthly: process.env["STRIPE_PRICE_ELITE_MONTHLY_EEE"],
    elite_annual: process.env["STRIPE_PRICE_ELITE_ANNUAL_EEE"],
    course_full: process.env["STRIPE_PRICE_COURSE_FULL_EEE"],
    mogul_bundle: process.env["STRIPE_PRICE_MOGUL_BUNDLE_EEE"],
    course_installment: process.env["STRIPE_PRICE_COURSE_INSTALLMENT_EEE"],
  }[key];
  return override || LIVE_PRICE_IDS[key];
}

/**
 * Mode-aware price resolution. Live uses the fixed IDs above; test mirrors
 * the catalog on demand so preview checkouts always match production pricing.
 */
export async function resolvePriceId(
  stripe: Stripe,
  key: CheckoutItemKey,
): Promise<string> {
  if (stripeMode() === "live") {
    const id = priceIdFor(key);
    if (!id) throw new Error(`Missing Stripe price for ${key}.`);
    return id;
  }

  const entry = CATALOG[key];
  const lookupKey = `rebuilt_${key}`;

  const found = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;

  const product = await stripe.products.create({
    name: entry.name,
    description: entry.blurb,
    metadata: { rebuilt_item: key },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: entry.amount,
    lookup_key: lookupKey,
    ...(entry.interval ? { recurring: { interval: entry.interval } } : {}),
  });
  return price.id;
}

/**
 * The secret key for the current mode. In live mode a `_test_` value is
 * treated as "not configured" so a test-mode charge can never happen in
 * production.
 */
export function stripeSecretKey(): string | null {
  if (stripeMode() === "test") {
    return process.env["STRIPE_SECRET_KEY_TEST"] ?? null;
  }
  const eee = process.env["STRIPE_SECRET_KEY_EEE"];
  if (eee && !/_test_/.test(eee)) return eee;
  const fallback = process.env["STRIPE_SECRET_KEY"];
  if (fallback && !/_test_/.test(fallback)) return fallback;
  return null;
}

/** Webhook signing secret for the current mode. */
export function stripeWebhookSecret(): string | null {
  if (stripeMode() === "test") {
    return (
      process.env["STRIPE_WEBHOOK_SECRET_TEST"] ??
      process.env["STRIPE_WEBHOOK_SECRET"] ??
      null
    );
  }
  return (
    process.env["STRIPE_WEBHOOK_SECRET_EEE"] ??
    process.env["STRIPE_WEBHOOK_SECRET"] ??
    null
  );
}

/** True when billing is wired to a usable key. */
export function stripeConfigured(): boolean {
  return stripeSecretKey() !== null;
}

/** Publishable key for Stripe.js in the browser. */
export function stripePublishableKey(): string {
  if (stripeMode() === "test") {
    return process.env["STRIPE_PUBLISHABLE_KEY_TEST"] ?? "";
  }
  return (
    process.env["STRIPE_PUBLISHABLE_KEY_EEE"] ??
    process.env["STRIPE_PUBLISHABLE_KEY"] ??
    ""
  );
}

/** Construct a Stripe client bound to the current mode. */
export async function getStripe() {
  const secret = stripeSecretKey();
  if (!secret) throw new Error("Billing is not configured yet.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(secret);
}
