import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATALOG,
  paymentMethodsFor,
  type CheckoutItemKey,
} from "@/lib/stripe-catalog";
import {
  getStripe,
  resolvePriceId,
  stripeConfigured,
  stripePublishableKey,
  STATEMENT_DESCRIPTOR_SUFFIX,
} from "@/lib/stripe-server";



const ITEM_SCHEMA = z.enum([
  "pro_monthly",
  "pro_annual",
  "elite_monthly",
  "elite_annual",
  "course_full",
  "mogul_bundle",
]);

/** Publishable key for Stripe.js — safe to expose to the browser. */
export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const pk = stripePublishableKey();
    return {
      publishableKey: pk,
      testMode: pk.startsWith("pk_test"),
      configured: pk.length > 0 && stripeConfigured(),
    };
  },
);


/**
 * Starts a single-page checkout.
 *
 * Subscriptions: creates an incomplete subscription with the 30-day trial and
 * returns the pending SetupIntent client secret. Confirming that secret (card
 * or wallet) stores the mandate, so renewals actually charge.
 *
 * One-time items: returns a PaymentIntent client secret.
 *
 * California ARL: the buyer's affirmative consent to the renewal terms is
 * required and recorded before any intent is created.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        item: ITEM_SCHEMA,
        consented: z.literal(true),
        consentText: z.string().max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const entry = CATALOG[data.item as CheckoutItemKey];

    const stripe = await getStripe();
    const price = await resolvePriceId(stripe, data.item as CheckoutItemKey);


    const { data: profileRow } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("email, first_name, stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const profile = (profileRow ?? {}) as Record<string, unknown>;
    const email = (profile.email as string | undefined) ?? undefined;

    let customerId = (profile.stripe_customer_id as string | null) ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("user_profile")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    // Record affirmative consent to the renewal terms (California ARL).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("billing_consents").insert({
      user_id: userId,
      item_key: data.item,
      consent_text: data.consentText,
    });

    const methods = paymentMethodsFor(data.item as CheckoutItemKey);

    if (entry.interval) {
      // Never stack two subscriptions on one customer: if they already have a
      // live one, switch the plan in place instead of creating a second.
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const live = existing.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      );
      if (live) {
        const item = live.items.data[0];
        const updated = await stripe.subscriptions.update(live.id, {
          items: item ? [{ id: item.id, price }] : [{ price }],
          cancel_at_period_end: false,
          proration_behavior: "create_prorations",
          metadata: { supabase_user_id: userId, plan: data.item },
        });
        return {
          mode: "switched" as const,
          clientSecret: null,
          amount: entry.amount,
          subscriptionId: updated.id,
          methods,
        };
      }

      // Abandoned/incomplete attempts are cleaned up so a retry is clean.
      for (const s of existing.data.filter((s) => s.status === "incomplete")) {
        try {
          await stripe.subscriptions.cancel(s.id);
        } catch {
          /* best effort */
        }
      }

      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price }],
        trial_period_days: entry.trialDays || undefined,
        trial_settings: entry.trialDays
          ? { end_behavior: { missing_payment_method: "cancel" } }
          : undefined,
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
          // Recurring-safe methods only: no Afterpay (no recurring support),
          // no Affirm (no setup_future_usage), no Klarna (renewal unverified).
          payment_method_types: methods as unknown as never,
        },
        metadata: { supabase_user_id: userId, plan: data.item },
        expand: ["pending_setup_intent", "latest_invoice.payment_intent"],
      });

      const setupIntent = sub.pending_setup_intent as
        | { id?: string; client_secret?: string | null }
        | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoicePi = (sub.latest_invoice as any)?.payment_intent as
        | { client_secret?: string | null }
        | undefined;

      // Stamp the SetupIntent so setup_intent.succeeded can re-sync the exact
      // subscription and only then grant trial access.
      if (setupIntent?.id) {
        try {
          await stripe.setupIntents.update(setupIntent.id, {
            metadata: { supabase_user_id: userId, subscription_id: sub.id, plan: data.item },
          });
        } catch {
          /* non-fatal */
        }
      }

      const clientSecret =
        setupIntent?.client_secret ?? invoicePi?.client_secret ?? null;
      if (!clientSecret) throw new Error("Could not start checkout. Try again.");

      return {
        mode: (setupIntent?.client_secret ? "setup" : "payment") as
          | "setup"
          | "payment"
          | "switched",
        clientSecret,
        amount: entry.amount,
        subscriptionId: sub.id,
        methods,
      };
    }

    const intent = await stripe.paymentIntents.create({
      customer: customerId,
      amount: entry.amount,
      currency: "usd",
      // Explicit list so BNPL is actually offered on one-time products.
      payment_method_types: methods as unknown as never,
      // Verified live on acct_1QvqlvLbOwHrqvEJ: the suffix is accepted
      // alongside Affirm / Klarna / Afterpay. Renders "EEE INTL* REBUILT".
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
      description: entry.name,
      metadata: { supabase_user_id: userId, plan: data.item },
    });


    return {
      mode: "payment" as const,
      clientSecret: intent.client_secret!,
      amount: entry.amount,
      subscriptionId: null,
      methods,
    };

  });

/**
 * One-step cancellation (California ARL): no phone call, no retention flow.
 * Cancels at period end so the buyer keeps access through what they paid for.
 */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    const { data: profileRow } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = ((profileRow ?? {}) as Record<string, unknown>)
      .stripe_customer_id as string | null;
    if (!customerId) throw new Error("No subscription found on your account.");

    const stripe = await getStripe();


    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const active = subs.data.find((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status),
    );
    if (!active) throw new Error("No active subscription found.");

    const updated = await stripe.subscriptions.update(active.id, {
      cancel_at_period_end: true,
    });

    const endsAt =
      updated.cancel_at ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updated.items.data[0] as any)?.current_period_end ??
      null;

    return {
      ok: true,
      accessUntil: endsAt ? new Date(endsAt * 1000).toISOString() : null,
    };
  });

/** Current subscription state, read straight from Stripe. */
export const getMyStripeSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    if (!stripeConfigured()) return null;

    const { data: profileRow } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("stripe_customer_id" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = ((profileRow ?? {}) as Record<string, unknown>)
      .stripe_customer_id as string | null;
    if (!customerId) return null;

    const stripe = await getStripe();

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const sub = subs.data.find((s) =>
      ["active", "trialing", "past_due"].includes(s.status),
    );
    if (!sub) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodEnd = (sub.items.data[0] as any)?.current_period_end as
      | number
      | undefined;

    return {
      id: sub.id,
      status: sub.status,
      plan: (sub.metadata?.plan as string | undefined) ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    };
  });
