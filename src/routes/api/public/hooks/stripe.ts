import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { stripeSecretKey, stripeWebhookSecret, stripeMode } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { wrapPublicHandler } from "@/lib/server-log";

/**
 * Stripe webhook — the ONLY thing that grants access after money moves.
 *
 * Subscribe this endpoint to:
 *   checkout.session.completed
 *   payment_intent.succeeded
 *   setup_intent.succeeded
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 *   invoice.payment_failed
 *
 * Every grant is idempotent: purchases are written to payment_transactions
 * behind a unique (provider, provider_txn_id) index, and tier grants are
 * plain writes of a desired end state, so replays are harmless.
 */
export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/stripe", id: "hooks/stripe", perMinute: 120 }, async ({ request }) => {
        const secret = stripeSecretKey();
        const whSecret = stripeWebhookSecret();
        if (!secret || !whSecret) {
          return new Response("Stripe not configured", { status: 503 });
        }

        const stripe = new Stripe(secret);
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, whSecret);
        } catch (err) {
          console.error("[stripe-webhook] bad signature", (err as Error).message);
          return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              const userId =
                session.client_reference_id ||
                (session.metadata?.supabase_user_id as string | undefined) ||
                (session.customer ? await lookupUserByCustomer(session.customer as string) : null);
              if (!userId) break;

              const planMeta = (session.metadata?.plan as string | undefined) ?? null;
              if (session.customer) await setCustomerId(userId, session.customer as string);

              if (session.mode === "payment" && planMeta) {
                await fulfilOneTime(userId, planMeta, {
                  txnId: (session.payment_intent as string | null) ?? session.id,
                  amount: session.amount_total ?? 0,
                });
                break;
              }

              if (!session.subscription) break;
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              if (planMeta === "course_installment") {
                await grantTier(userId, "lifetime_pro", "course_497");
              } else {
                await upsertSub(userId, sub, session.customer as string);
              }
              break;
            }

            case "payment_intent.succeeded": {
              // One-time purchases from our single-page checkout.
              const pi = event.data.object as Stripe.PaymentIntent;
              const userId =
                (pi.metadata?.supabase_user_id as string | undefined) ||
                (pi.customer ? await lookupUserByCustomer(pi.customer as string) : null);
              const plan = pi.metadata?.plan as string | undefined;
              if (!userId || !plan) break;
              if (pi.customer) await setCustomerId(userId, pi.customer as string);
              await fulfilOneTime(userId, plan, { txnId: pi.id, amount: pi.amount_received || pi.amount });
              break;
            }

            case "setup_intent.succeeded": {
              // Trial subscriptions only grant access once a payment method is
              // actually stored, so re-sync the subscription at that moment.
              const si = event.data.object as Stripe.SetupIntent;
              const subId =
                typeof si.metadata?.subscription_id === "string"
                  ? si.metadata.subscription_id
                  : null;
              const customerId = (si.customer as string | null) ?? null;
              if (!customerId) break;
              const subs = subId
                ? [await stripe.subscriptions.retrieve(subId)]
                : (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 })).data;
              for (const sub of subs) {
                const userId =
                  (sub.metadata?.supabase_user_id as string | undefined) ||
                  (await lookupUserByCustomer(customerId));
                if (userId) await upsertSub(userId, sub, customerId);
              }
              break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const sub = event.data.object as Stripe.Subscription;
              const userId =
                (sub.metadata?.supabase_user_id as string | undefined) ||
                (await lookupUserByCustomer(sub.customer as string));
              if (!userId) break;
              const planMeta = (sub.metadata?.plan as string | undefined) ?? null;
              // Don't downgrade lifetime course buyers when their installment plan ends.
              if (planMeta === "course_installment") {
                await setCustomerId(userId, sub.customer as string);
                break;
              }
              await upsertSub(userId, sub, sub.customer as string);
              if (event.type === "customer.subscription.created") {
                await sendConfirmation(userId, sub, planMeta);
              }
              break;
            }

            case "invoice.paid": {
              const inv = event.data.object as Stripe.Invoice;
              const customerId = inv.customer as string | null;
              if (!customerId) break;
              const userId = await lookupUserByCustomer(customerId);
              if (!userId) break;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const subId = (inv as any).subscription as string | null | undefined;
              if (subId) {
                const sub = await stripe.subscriptions.retrieve(subId);
                await upsertSub(userId, sub, customerId);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const line = inv.lines.data[0] as any;
              await recordTransaction({
                userId,
                txnId: inv.id ?? `inv_${inv.created}`,
                productKey: (line?.price?.metadata?.rebuilt_item as string) ?? "subscription",
                priceId: (line?.price?.id as string | undefined) ?? null,
                amount: inv.amount_paid ?? 0,
                status: "paid",
                billingKind: "recurring",
              });
              break;
            }

            case "invoice.payment_failed": {
              const inv = event.data.object as Stripe.Invoice;
              const customerId = inv.customer as string | null;
              if (!customerId) break;
              const userId = await lookupUserByCustomer(customerId);
              if (!userId) break;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabaseAdmin as any)
                .from("user_profile")
                .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
                .eq("user_id", userId);
              console.warn("[stripe-webhook] payment failed", { userId, invoice: inv.id });
              break;
            }
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        console.log("[stripe-webhook] handled", event.type, event.id);
        return new Response("ok");
      }),
    },
  },
});

type Tier = "free" | "pro" | "elite" | "lifetime_pro";

function planToTier(plan: string | null | undefined): Tier {
  switch (plan) {
    case "elite_monthly":
    case "elite_annual":
      return "elite";
    case "pro_monthly":
    case "pro_annual":
    case "monthly": // legacy
    case "yearly":  // legacy
      return "pro";
    default:
      return "pro";
  }
}

async function grantTier(userId: string, tier: Tier, source: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin.rpc as any)("grant_tier", {
    p_user_id: userId,
    p_tier: tier,
    p_source: source,
  });
  if (error) throw new Error(`grant_tier failed: ${error.message}`);
  console.log("[stripe-webhook] granted", { userId, tier, source });
}

async function setCustomerId(userId: string, customerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from("user_profile")
    .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

/** Look the buyer up by Stripe customer, profile first then consult table. */
async function lookupUserByCustomer(customerId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabaseAdmin as any)
    .from("user_profile")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id as string;

  const { data } = await supabaseAdmin
    .from("consult_subscription")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Idempotent purchase ledger write. Duplicate events are silently ignored. */
async function recordTransaction(opts: {
  userId: string;
  txnId: string;
  productKey: string;
  priceId?: string | null;
  amount: number;
  status: string;
  billingKind: "one_time" | "recurring";
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).from("payment_transactions").insert({
    provider: "stripe",
    provider_txn_id: opts.txnId,
    user_id: opts.userId,
    product_key: opts.productKey,
    price_id: opts.priceId ?? null,
    amount_cents: opts.amount,
    currency: "usd",
    status: opts.status,
    billing_kind: opts.billingKind,
    environment: stripeMode(),
    occurred_at: new Date().toISOString(),
  });
  // 23505 = duplicate event replay; expected and harmless.
  if (error && error.code !== "23505") {
    console.error("[stripe-webhook] ledger write failed", error.message);
  }
  return !error;
}

/**
 * One-time products: record the purchase, grant what was bought, and email
 * the buyer what they now own.
 */
async function fulfilOneTime(
  userId: string,
  plan: string,
  tx: { txnId: string; amount: number },
) {
  const isNew = await recordTransaction({
    userId,
    txnId: tx.txnId,
    productKey: plan,
    amount: tx.amount,
    status: "succeeded",
    billingKind: "one_time",
  });

  if (plan === "course_full" || plan === "course_installment") {
    await grantTier(userId, "lifetime_pro", "course_497");
    await recordCoursePurchase(userId, plan, tx.amount);
  }
  // The Mogul Bundle grants no tier — access is proven by the purchase row.

  if (isNew) await sendDelivery(userId, plan, tx.amount);
}

/** Keeps email-based purchase restore working for later/second signups. */
async function recordCoursePurchase(userId: string, plan: string, amount: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (supabaseAdmin as any)
    .from("user_profile")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!p?.email) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).from("course_purchases").insert({
    email: p.email,
    user_id: userId,
    plan,
    amount_cents: amount,
    installments_paid: 1,
    purchased_at: new Date().toISOString(),
  });
  if (error && error.code !== "23505") {
    console.error("[stripe-webhook] course_purchases insert failed", error.message);
  }
}

async function sendDelivery(userId: string, plan: string, amount: number) {
  try {
    const { CATALOG } = await import("@/lib/stripe-catalog");
    const { MOGUL_BONUSES } = await import("@/lib/mogul-bonuses");
    const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");
    const entry = plan in CATALOG ? CATALOG[plan as keyof typeof CATALOG] : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (supabaseAdmin as any)
      .from("user_profile")
      .select("email, first_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!p?.email) return;

    const items =
      plan === "mogul_bundle"
        ? MOGUL_BONUSES.map((b) => b.title)
        : [
            "The full REBUILT Course",
            "Lifetime REBUILT Pro access",
            "All five Mogul guides",
          ];

    await enqueueRebuiltEmail({
      templateName: "purchase-delivered",
      recipientEmail: p.email,
      templateData: {
        firstName: p.first_name ?? "brother",
        productName: entry?.name ?? plan,
        priceLabel: entry?.priceLabel ?? `$${(amount / 100).toFixed(2)}`,
        items,
        ctaLabel: plan === "mogul_bundle" ? "Open your guides" : "Start the course",
        ctaPath: plan === "mogul_bundle" ? "/app/nutrition/mogul-bonuses" : "/app/nutrition/academy",
      },
      idempotencyKey: `purchase-delivered:${plan}:${userId}`,
    });
  } catch (err) {
    console.error("[stripe-webhook] delivery email failed", err);
  }
}

async function upsertSub(
  userId: string,
  sub: Stripe.Subscription,
  customerId: string,
) {
  const item = sub.items.data[0];
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end;
  await supabaseAdmin
    .from("consult_subscription")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        plan_price_cents: item?.price?.unit_amount ?? 100000,
      },
      { onConflict: "user_id" },
    );

  const planMeta = (sub.metadata?.plan as string | undefined) ?? null;
  const tier: Tier = planToTier(planMeta);

  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const trialStart = sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null;

  // A trial only counts once a payment method is actually on file, otherwise
  // anyone could take 30 free days by abandoning the payment step.
  const hasPaymentMethod =
    !!sub.default_payment_method ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(sub as any).default_source ||
    !!(typeof sub.customer === "object" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sub.customer as any)?.invoice_settings?.default_payment_method);

  const grantsAccess =
    sub.status === "active" ||
    sub.status === "past_due" ||
    (sub.status === "trialing" && hasPaymentMethod);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from("user_profile")
    .update({
      stripe_customer_id: customerId,
      subscription_status: sub.status,
      subscription_plan: planMeta,
      trial_started_at: trialStart,
      trial_ends_at: trialEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (grantsAccess) {
    const source = sub.status === "trialing" ? `stripe_trial:${planMeta ?? tier}` : `stripe_paid:${planMeta ?? tier}`;
    await grantTier(userId, tier, source);
  } else if (
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired"
  ) {
    // Don't downgrade lifetime course buyers
    const { data: row } = await supabaseAdmin
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("tier" as any)
      .eq("user_id", userId)
      .maybeSingle();
    const currentTier = (row as Record<string, unknown> | null)?.tier as Tier | undefined;
    if (currentTier !== "lifetime_pro") {
      await grantTier(userId, "free", "stripe_canceled");
      // Revoke partner perk codes when subscription lapses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.rpc as any)("revoke_member_perks", { p_user_id: userId });
    }
  }
}

/**
 * California ARL: send the buyer a written acknowledgement of the renewal
 * terms right after they subscribe.
 */
async function sendConfirmation(
  userId: string,
  sub: Stripe.Subscription,
  planMeta: string | null,
) {
  try {
    const { CATALOG } = await import("@/lib/stripe-catalog");
    const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");
    const entry = planMeta && planMeta in CATALOG
      ? CATALOG[planMeta as keyof typeof CATALOG]
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (supabaseAdmin as any)
      .from("user_profile")
      .select("email, first_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!p?.email) return;

    const firstCharge = sub.trial_end
      ? new Date(sub.trial_end * 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : ((sub.items.data[0] as any)?.current_period_end
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? new Date(((sub.items.data[0] as any).current_period_end as number) * 1000)
        : null);

    await enqueueRebuiltEmail({
      templateName: "subscription-confirmed",
      recipientEmail: p.email,
      templateData: {
        firstName: p.first_name ?? "brother",
        planLabel: entry?.name ?? "Your REBUILT membership",
        priceLabel: entry ? `${entry.priceLabel}${entry.cadenceLabel}` : "",
        renewalTerms: entry?.renewalTerms ?? "",
        firstChargeDate: firstCharge
          ? firstCharge.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "your renewal date",
      },
      idempotencyKey: `sub-confirmed:${sub.id}`,
    });
  } catch (err) {
    console.error("[stripe-webhook] confirmation email failed", err);
  }
}
