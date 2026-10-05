import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ChevronLeft, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG,
  PAY_METHOD_LABEL,
  REFUND_STANCE,
  STATEMENT_DESCRIPTOR,
  paymentMethodsFor,
  type CheckoutItemKey,
} from "@/lib/stripe-catalog";
import { getStripePublishableKey, startCheckout } from "@/lib/checkout.functions";
import { CheckoutPaymentForm } from "@/components/checkout/CheckoutPaymentForm";
import { trackEvent } from "@/lib/web-track";

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
    .default("pro_monthly"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: (s) => Search.parse(s),
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout — REBUILT" },
      {
        name: "description",
        content:
          "Complete your REBUILT membership. Apple Pay, Google Pay or card. Cancel any time in one step from Settings.",
      },
      { property: "og:title", content: "Checkout — REBUILT" },
      {
        property: "og:description",
        content: "Complete your REBUILT membership. Cancel any time in one step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CheckoutPage() {
  const { item, redirect } = useSearch({ from: "/checkout" });
  const navigate = useNavigate();
  const entry = CATALOG[item as CheckoutItemKey];

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const [intent, setIntent] = useState<{ mode: "setup" | "payment"; clientSecret: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [wallets, setWallets] = useState<string[]>([]);

  // Only methods that will actually render for THIS product are ever shown.
  const methods = useMemo(() => paymentMethodsFor(item as CheckoutItemKey), [item]);
  const walletLabels = useMemo(
    () =>
      wallets
        .map((w) =>
          w === "applePay" ? "Apple Pay" : w === "googlePay" ? "Google Pay" : null,
        )
        .filter(Boolean) as string[],
    [wallets],
  );

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({
          to: "/login" as never,
          search: { redirect: `/checkout?item=${item}` } as never,
        });
        return;
      }
      setAuthChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  useEffect(() => {
    void (async () => {
      const { publishableKey, testMode: tm } = await getStripePublishableKey();
      setTestMode(tm);
      if (publishableKey) setStripePromise(loadStripe(publishableKey));
    })();
  }, []);

  // Every method — card, wallets, Link and the redirect-based ones (Cash App
  // Pay, Affirm, Klarna, Afterpay) — comes back to one dedicated return page
  // that reads the real intent status and waits for fulfilment.
  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const next = redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/app/account";
    const qs = new URLSearchParams({ item, next });
    return `${window.location.origin}/checkout/return?${qs.toString()}`;
  }, [redirect, item]);

  async function begin() {
    if (!consented) {
      toast.error("Please agree to the renewal terms to continue.");
      return;
    }
    setStarting(true);
    try {
      trackEvent("checkout_started");
      const res = await startCheckout({
        data: { item, consented: true, consentText: entry.renewalTerms },
      });
      if (res.mode === "switched" || !res.clientSecret) {
        toast.success("Plan updated. Your new plan is active.");
        navigate({ to: (redirect ?? "/app/account") as never, search: { upgrade: "success" } as never });
        return;
      }
      setIntent({ mode: res.mode as "setup" | "payment", clientSecret: res.clientSecret });
    } catch (e) {
      toast.error((e as Error).message || "Could not start checkout.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {testMode && (
        <div className="w-full bg-orange-500/15 border-b border-orange-500/30 px-4 py-2 text-center text-xs text-orange-200">
          Payments are in <strong>test mode</strong>. No real charges.
        </div>
      )}
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link to={"/pricing" as never} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <p className="label-mono">REBUILT</p>
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* 1 — Plan summary */}
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="label-mono text-gold">Your plan</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h1 className="font-display text-2xl">{entry.name}</h1>
            <p className="text-right">
              <span className="font-display text-2xl">{entry.priceLabel}</span>
              <span className="ml-1 text-xs text-muted-foreground">{entry.cadenceLabel}</span>
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{entry.blurb}</p>
          {entry.trialDays > 0 && (
            <p className="mt-3 rounded-md bg-gold/10 px-3 py-2 text-sm text-foreground">
              Free for the first {entry.trialDays} days. Nothing is charged today.
            </p>
          )}
        </section>

        {/* 2 — California ARL disclosure + affirmative consent, before payment */}
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Renewal terms
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{entry.renewalTerms}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{REFUND_STANCE}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Charges appear on your statement as <strong>{STATEMENT_DESCRIPTOR}</strong>. Cancel in one
            step from Settings — no phone call, no email required.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consented}
              disabled={!!intent}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
            />
            <span>
              I agree to the{" "}
              {entry.interval ? "automatic renewal terms above" : "one-time charge above"}, the{" "}
              <Link to={"/terms" as never} className="underline">terms</Link> and the{" "}
              <Link to={"/refunds" as never} className="underline">refund policy</Link>.
            </span>
          </label>
        </section>

        {/* 3 — Payment */}
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="label-mono text-gold">Payment</p>
          {!intent ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                {entry.interval
                  ? "Apple Pay, Google Pay, Link or card — all on the next step of this page."
                  : "Apple Pay, Google Pay, Link, card, Cash App Pay, or pay over time with Affirm, Klarna or Afterpay."}
              </p>
              <button
                type="button"
                onClick={begin}
                disabled={!consented || starting || !authChecked}
                className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to payment"}
              </button>
            </>
          ) : !stripePromise ? (
            <p className="mt-3 text-sm text-destructive">
              Payments are not configured yet (missing publishable key).
            </p>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: intent.clientSecret,
                appearance: { theme: "night", variables: { colorPrimary: "#d4af37" } },
              }}
            >
              <CheckoutPaymentForm
                mode={intent.mode}
                returnUrl={returnUrl}
                onWalletsChange={setWallets}
                buttonLabel={
                  entry.interval
                    ? entry.trialDays > 0
                      ? "Start free trial"
                      : `Subscribe ${entry.priceLabel}${entry.cadenceLabel}`
                    : `Pay ${entry.priceLabel}`
                }
              />
            </Elements>
          )}

          {/* Accepted methods — rendered from the exact list this product supports */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...walletLabels, ...methods.map((m) => PAY_METHOD_LABEL[m])].map((label) => (
              <span
                key={label}
                className="rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
          {!entry.interval && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Pay over time available on this one-time purchase. Subject to provider approval.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
