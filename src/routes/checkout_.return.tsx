import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { getStripePublishableKey } from "@/lib/checkout.functions";
import { getAccessStatus } from "@/lib/access.functions";
import { CATALOG, type CheckoutItemKey } from "@/lib/stripe-catalog";
import { trackEvent } from "@/lib/web-track";

/**
 * Return leg for EVERY payment method, including the redirect-based ones
 * (Affirm, Klarna, Afterpay, Cash App Pay). Stripe sends the buyer back here
 * with `payment_intent` / `setup_intent` + `redirect_status`; we read the real
 * intent status from Stripe (never trust the query string alone) and then poll
 * entitlement while the webhook fulfils in the background.
 */
const Search = z.object({
  item: z
    .enum([
      "pro_monthly",
      "pro_annual",
      "elite_monthly",
      "elite_annual",
      "course_full",
      "mogul_bundle",
    ])
    .optional(),
  next: z.string().optional(),
  payment_intent: z.string().optional(),
  payment_intent_client_secret: z.string().optional(),
  setup_intent: z.string().optional(),
  setup_intent_client_secret: z.string().optional(),
  redirect_status: z.string().optional(),
});

export const Route = createFileRoute("/checkout_/return")({
  validateSearch: (s) => Search.parse(s),
  component: CheckoutReturnPage,
  head: () => ({
    meta: [
      { title: "Payment confirmation — REBUILT" },
      {
        name: "description",
        content:
          "Confirming your REBUILT payment and unlocking your access. Card, wallet, Link, Cash App Pay, Affirm, Klarna and Afterpay all land here.",
      },
      { property: "og:title", content: "Payment confirmation — REBUILT" },
      {
        property: "og:description",
        content: "Confirming your REBUILT payment and unlocking your access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type State = "checking" | "succeeded" | "processing" | "failed";

function CheckoutReturnPage() {
  const search = useSearch({ from: "/checkout_/return" });
  const entry = search.item ? CATALOG[search.item as CheckoutItemKey] : null;
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const nextPath = useMemo(() => {
    const raw = search.next ?? "/app/account";
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/account";
  }, [search.next]);

  // 1 — read the real intent status from Stripe
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const clientSecret =
        search.payment_intent_client_secret ?? search.setup_intent_client_secret ?? null;
      if (!clientSecret) {
        // Wallet/card flows can complete without a redirect payload.
        if (!cancelled) setState(search.redirect_status === "failed" ? "failed" : "succeeded");
        return;
      }
      try {
        const { publishableKey } = await getStripePublishableKey();
        const stripe = publishableKey ? await loadStripe(publishableKey) : null;
        if (!stripe) throw new Error("Payments are not configured.");

        const status = search.setup_intent_client_secret
          ? (await stripe.retrieveSetupIntent(clientSecret)).setupIntent?.status
          : (await stripe.retrievePaymentIntent(clientSecret)).paymentIntent?.status;

        if (cancelled) return;
        if (status === "succeeded") setState("succeeded");
        else if (status === "processing" || status === "requires_action") setState("processing");
        else {
          setState("failed");
          setMessage(
            status === "requires_payment_method"
              ? "That payment was not completed. Nothing was charged — you can try another method."
              : `Payment status: ${status ?? "unknown"}.`,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setState("failed");
          setMessage((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2 — poll entitlement while the webhook fulfils
  useEffect(() => {
    if (state !== "succeeded") return;
    trackEvent("purchase_completed");
    let tries = 0;
    let stop = false;
    const tick = async () => {
      tries += 1;
      try {
        const s = await getAccessStatus();
        if (s && s.tier !== "free") {
          setUnlocked(true);
          stop = true;
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 10) stop = true;
      if (!stop) window.setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [state]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-lg px-4 py-16">
        <section className="rounded-xl border border-border bg-card p-6 text-center">
          {state === "checking" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />
              <h1 className="mt-4 font-display text-2xl">Confirming your payment…</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hold tight — this only takes a moment.
              </p>
            </>
          )}

          {state === "succeeded" && (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
              <h1 className="mt-4 font-display text-2xl">
                {entry ? `${entry.name} — you're in.` : "Payment received."}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {unlocked
                  ? "Your access is unlocked and a confirmation email is on its way."
                  : "Unlocking your access now — your confirmation email is on its way."}
              </p>
              <Link
                to={nextPath as never}
                search={{ upgrade: "success" } as never}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                Continue
              </Link>
            </>
          )}

          {state === "processing" && (
            <>
              <Clock className="mx-auto h-10 w-10 text-gold" />
              <h1 className="mt-4 font-display text-2xl">Payment is processing</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your provider is still confirming this payment. Access unlocks automatically the
                moment it clears, and we'll email you the confirmation.
              </p>
              <Link
                to={nextPath as never}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                Continue
              </Link>
            </>
          )}

          {state === "failed" && (
            <>
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="mt-4 font-display text-2xl">Payment not completed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {message ?? "Nothing was charged. You can try again with another method."}
              </p>
              <Link
                to={"/checkout" as never}
                search={{ item: search.item ?? "pro_monthly" } as never}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                Try again
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
