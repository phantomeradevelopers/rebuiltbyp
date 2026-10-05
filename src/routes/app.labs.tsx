import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Check, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLabsWaitlistStatus, joinLabsWaitlist } from "@/lib/labs.functions";
import { ImmersiveHeader } from "@/components/ImmersiveHeader";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/app/labs")({
  component: LabsPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

const BIOMARKERS = [
  "Testosterone (total + free)",
  "Cortisol",
  "Hemoglobin A1c",
  "Vitamin D",
  "Thyroid panel (TSH / T3 / T4)",
  "Lipid panel",
  "Inflammation (hs-CRP)",
  "Liver + kidney function",
];

function LabsPage() {
  const fetchStatus = useServerFn(getLabsWaitlistStatus);
  const join = useServerFn(joinLabsWaitlist);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["labs-waitlist"],
    queryFn: () => fetchStatus(),
  });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function prefillEmail() {
    if (email) return;
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user?.email) setEmail(s.session.user.email);
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await join({ data: { email } });
      toast.success("You're on the list. We'll email when Labs goes live.");
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ImmersiveHeader
        eyebrow="Coming soon"
        title="Blood work, decoded."
        subtitle="Order your panel. Track what's actually changing inside."
        variant="dawn"
      />
      <div className="px-4 sm:px-6 max-w-md mx-auto space-y-6 pb-12 -mt-4">
        <section className="card-elevated p-6">
          <div className="flex items-center gap-2 text-gold">
            <FlaskConical className="h-4 w-4" />
            <p className="label-mono">Labs — coming soon</p>
          </div>
          <h2 className="mt-3 font-display text-2xl text-foreground">
            Order your panel. Results delivered here.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Track testosterone, cortisol, A1C, and 50+ biomarkers over time —
            right alongside your check-ins, weight, and training.
          </p>
          <div className="mt-5 pt-5 border-t border-border space-y-2">
            {BIOMARKERS.map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm text-foreground/90">
                <Check className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 label-mono text-[10px] text-muted-foreground inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Powered by Junction — nationwide lab access, no doctor visit required
          </p>
        </section>

        <section className="card-elevated p-5">
          <p className="label-mono text-gold">Waitlist</p>
          <h3 className="mt-2 font-display text-xl">
            Get notified when blood work goes live for REBUILT members.
          </h3>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : data?.joined ? (
            <div className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-4">
              <p className="text-sm text-foreground">
                <Check className="inline h-4 w-4 text-gold mr-1" />
                You're on the list. We'll email{" "}
                <span className="text-gold">{data.email}</span> when Labs unlocks.
              </p>
            </div>
          ) : (
            <form onSubmit={onJoin} className="mt-4 space-y-3">
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onFocus={prefillEmail}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-md border border-border bg-input px-4 text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60"
              >
                {busy ? "Adding…" : "Notify me when Labs goes live"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
