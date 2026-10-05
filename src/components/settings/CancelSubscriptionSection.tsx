import { useState } from "react";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";
import { useSubscription, planLabel } from "@/hooks/useSubscription";
import { cancelMySubscription } from "@/lib/checkout.functions";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

/**
 * California ARL: cancellation must be as easy as signing up.
 * Two taps — "Cancel subscription" then one plain confirm. No retention
 * screens, no discount offers, no phone call.
 */
export function CancelSubscriptionSection() {
  const { subscription, isActive, isTrialing, loading, refetch } = useSubscription();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || !subscription || !isActive) return null;

  const endsAt = fmt(subscription.currentPeriodEnd);

  async function doCancel() {
    setBusy(true);
    try {
      const res = await cancelMySubscription();
      const until = fmt(res.accessUntil);
      toast.success(until ? `Cancelled. Access continues until ${until}.` : "Cancelled.");
      setConfirming(false);
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold flex items-center gap-1.5">
        <XCircle className="h-3 w-3" /> Subscription
      </p>
      <p className="mt-2 text-sm text-foreground/90">
        {planLabel(subscription.plan)} —{" "}
        {subscription.cancelAtPeriodEnd
          ? `cancelled. Access continues until ${endsAt ?? "the end of this period"}.`
          : isTrialing
            ? `free trial. First charge on ${fmt(subscription.trialEnd) ?? endsAt ?? "the trial end date"} unless you cancel.`
            : `renews automatically on ${endsAt ?? "your renewal date"}.`}
      </p>

      {!subscription.cancelAtPeriodEnd &&
        (!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 w-full min-tap rounded-md border border-destructive/40 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
          >
            Cancel subscription
          </button>
        ) : (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-foreground">
              Cancel subscription — access continues until {endsAt ?? "the end of this period"}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={doCancel}
                disabled={busy}
                className="flex-1 min-tap rounded-md bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50 inline-flex items-center justify-center"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm cancel"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 min-tap rounded-md border border-border text-sm"
              >
                Keep it
              </button>
            </div>
          </div>
        ))}

      <p className="mt-2 text-[11px] text-muted-foreground">
        No phone call, no email required. We do not refund periods already billed and we do not prorate.
      </p>
    </section>
  );
}
