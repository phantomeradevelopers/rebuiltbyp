import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Loader2, ChevronLeft } from "lucide-react";
import { useSubscription, planLabel } from "@/hooks/useSubscription";
import { CancelSubscriptionSection } from "@/components/settings/CancelSubscriptionSection";
import { REFUND_STANCE, STATEMENT_DESCRIPTOR } from "@/lib/stripe-catalog";

export const Route = createFileRoute("/app/billing")({
  component: BillingPage,
  validateSearch: (s: Record<string, unknown>) => ({
    checkout: (s.checkout as string) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing — REBUILT" },
      { name: "description", content: "Manage your REBUILT subscription and payment method." },
      { property: "og:title", content: "Billing — REBUILT" },
      { property: "og:description", content: "Manage your REBUILT subscription. Cancel in one step." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: string, cancel: boolean) {
  if (status === "canceled") return "Canceled";
  if (cancel) return "Active — cancels at period end";
  if (status === "past_due") return "Payment failed — retrying";
  if (status === "trialing") return "Trial active";
  if (status === "active") return "Active";
  return status;
}

function BillingPage() {
  const search = useSearch({ from: "/app/billing" });
  const { subscription, loading } = useSubscription();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to={"/app/account" as never}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Account
          </Link>
          <p className="label-mono">Billing</p>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-6">
        {search.checkout === "success" && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
            Thanks — your subscription is being activated. This page updates as soon as the payment
            is confirmed.
          </div>
        )}

        <h1 className="font-display text-3xl">Your plan</h1>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !subscription ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">
              You're on the <strong className="text-foreground">Free</strong> plan.
            </p>
            <Link
              to={"/pricing" as never}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              See plans
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="font-medium">{planLabel(subscription.plan)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {statusLabel(subscription.status, subscription.cancelAtPeriodEnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? "Access until" : "Renews on"}
                  </dt>
                  <dd className="font-medium">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
                {subscription.trialEnd && (
                  <div>
                    <dt className="text-muted-foreground">Trial ends</dt>
                    <dd className="font-medium">{formatDate(subscription.trialEnd)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Charges appear as <strong>{STATEMENT_DESCRIPTOR}</strong>. {REFUND_STANCE}
              </p>
            </div>

            <CancelSubscriptionSection />
          </>
        )}
      </main>
    </div>
  );
}
