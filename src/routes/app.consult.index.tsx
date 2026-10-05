import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Phone, Clock, CalendarCheck } from "lucide-react";
import {
  getConsultStatus,
  createConsultCheckout,
  cancelConsult,
  type ConsultStatus,
} from "@/lib/consult.functions";

export const Route = createFileRoute("/app/consult/")({
  component: ConsultPage,
  validateSearch: (s: Record<string, unknown>) => ({
    ok: s.ok === "1" || s.ok === 1,
    canceled: s.canceled === "1" || s.canceled === 1,
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

const INCLUDED = [
  "Private 20-min 1:1 call with P every single week",
  "Your training, nutrition, mindset, recovery — all dialed by P personally",
  "Direct text line for between-call moves",
  "Real plan changes based on how you actually feel that week",
  "First-name-basis accountability — no scripts, no team, no handoffs",
  "Cancel anytime. No contracts, no games.",
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Why only 6 seats?",
    a: "Because more than that and you stop being a person to me and start being a row in a CRM. Six lets me actually know your week, your last call, what we're working on. That's the whole point.",
  },
  {
    q: "What if 6 is full when I apply?",
    a: "You go on the waitlist. When a seat opens, the longest-waiting approved applicant gets it first. We'll notify you the same day.",
  },
  {
    q: "Is this medical or therapy?",
    a: "No. Coaching, accountability, and strategy for training/nutrition/mindset. Prescriptions go through licensed clinicians. Mental health crises go to professionals (the app's safety system will route you).",
  },
  {
    q: "What if I miss a week?",
    a: "Life happens. We reschedule within the same week when possible, or you carry the slot forward. We don't waste your money.",
  },
];

function ConsultPage() {
  const { ok, canceled } = useSearch({ from: "/app/consult/" });
  const fetchStatus = useServerFn(getConsultStatus);
  const startCheckout = useServerFn(createConsultCheckout);
  const cancelSub = useServerFn(cancelConsult);
  const [loading, setLoading] = useState(false);

  const statusQ = useQuery({ queryKey: ["consult-status"], queryFn: () => fetchStatus() });
  const status = statusQ.data ?? null;

  useEffect(() => {
    if (ok) toast.success("You're in. Welcome to the Inner Circle.");
    if (canceled) toast.info("Checkout canceled — no charges.");
  }, [ok, canceled]);

  async function onStart() {
    setLoading(true);
    try {
      const { url } = await startCheckout({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  async function onCancel() {
    if (!confirm("Cancel at the end of your current month?")) return;
    try {
      await cancelSub({});
      toast.success("Canceled. You keep access until the period ends.");
      statusQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const seatsLeft = status ? Math.max(0, status.seatsTotal - status.seatsTaken) : null;

  return (
    <div className="px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-12">
      <Link to="/app" className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <p className="text-xs text-muted-foreground border border-border rounded-md px-3 py-2">
        Coaching is educational and accountability-based. It is not medical care.
      </p>

      <header className="space-y-2">
        <p className="label-mono text-gold">P's Inner Circle</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-[1.05]">
          You + P.<br />Every week.<br />Until you're rebuilt.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The app gets you 80% of the way. This is the other 20% — a private
          1:1 with me every single week. No team, no scripts. Just real
          coaching from someone who's done it.
        </p>
      </header>

      <section className="card-elevated p-5 border border-gold/40 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl sm:text-4xl text-gold">$3,000</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cancel anytime · No contracts
            </p>
          </div>
          {seatsLeft !== null && (
            <div className="text-right">
              <p className="label-mono text-gold text-[10px]">SEATS</p>
              <p className="font-display text-2xl">{seatsLeft} / {status!.seatsTotal}</p>
              <p className="text-[10px] text-muted-foreground">remaining</p>
            </div>
          )}
        </div>

        <ul className="space-y-2">
          {INCLUDED.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <CTABlock status={status} loading={loading} onStart={onStart} onCancel={onCancel} />

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Coaching & accountability. Not medical advice.
        </p>
      </section>

      <section className="space-y-3">
        <p className="label-mono text-gold text-xs">QUESTIONS</p>
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-md border border-border p-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer text-sm font-medium flex justify-between items-center">
              {f.q}
              <span className="text-gold group-open:rotate-45 transition text-lg leading-none">+</span>
            </summary>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

function CTABlock({
  status,
  loading,
  onStart,
  onCancel,
}: {
  status: ConsultStatus | null;
  loading: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (!status) {
    return (
      <div className="h-12 rounded-md bg-muted/30 animate-pulse" />
    );
  }

  // Already an active seat
  if (status.active) {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-gold/10 border border-gold/40 p-3 text-xs">
          <p className="label-mono text-gold">Active membership</p>
          {status.currentPeriodEnd && (
            <p className="mt-1 text-muted-foreground">
              {status.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
              {new Date(status.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
        <Link
          to="/app/consult/seat"
          search={{ ok: false }}
          className="btn-gold w-full h-12 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          <CalendarCheck className="h-4 w-4" /> Go to my seat
        </Link>
        {!status.cancelAtPeriodEnd && (
          <button
            onClick={onCancel}
            className="w-full h-10 text-xs label-mono text-muted-foreground hover:text-foreground"
          >
            Cancel renewal
          </button>
        )}
      </div>
    );
  }

  const app = status.application;

  // Approved — show checkout
  if (app?.status === "approved") {
    return (
      <button
        onClick={onStart}
        disabled={loading || !status.stripeReady}
        className="btn-gold w-full h-12 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Phone className="h-4 w-4" />
        {loading ? "Opening checkout…" : "You're approved — claim your seat"}
      </button>
    );
  }

  // Pending review
  if (app?.status === "pending") {
    return (
      <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-center space-y-1">
        <p className="label-mono text-gold text-xs flex items-center justify-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Application in review
        </p>
        <p className="text-xs text-muted-foreground">
          Submitted {new Date(app.created_at).toLocaleDateString()} · P responds within 48 hours
        </p>
      </div>
    );
  }

  // Waitlist
  if (app?.status === "waitlist") {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-4 text-center space-y-1">
        <p className="label-mono text-xs">On the waitlist</p>
        <p className="text-xs text-muted-foreground">
          We'll notify you the moment a seat opens.
        </p>
      </div>
    );
  }

  // Rejected — soft message
  if (app?.status === "rejected") {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-4 text-center space-y-1">
        <p className="text-xs">Not the right fit right now.</p>
        <p className="text-[11px] text-muted-foreground">
          Keep using the app — re-apply in 30 days.
        </p>
      </div>
    );
  }

  // No application yet
  const seatsLeft = Math.max(0, status.seatsTotal - status.seatsTaken);
  return (
    <Link
      to="/app/consult/apply"
      search={{ ok: false, canceled: false }}
      className="btn-gold w-full h-12 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
    >
      <Phone className="h-4 w-4" />
      {seatsLeft > 0 ? `Apply for one of ${seatsLeft} seats` : "Apply for the waitlist"}
    </Link>
  );
}
