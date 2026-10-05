import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ScrollText, Sparkles } from "lucide-react";
import { getMirror, saveMirror } from "@/lib/identity.functions";
import { celebrate } from "@/lib/celebrate";
import { PageSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/app/mirror/$id")({
  component: MirrorPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function MirrorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchMirror = useServerFn(getMirror);
  const submit = useServerFn(saveMirror);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mirror", id],
    queryFn: () => fetchMirror({ data: { id } }),
  });

  const [stillHim, setStillHim] = useState<"yes" | "getting_there" | "no" | null>(null);
  const [evidence, setEvidence] = useState("");
  const [recommit, setRecommit] = useState("");
  const [score, setScore] = useState(7);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return (
    <div className="px-4 sm:px-6 pt-12 max-w-md mx-auto">
      <p className="text-sm text-muted-foreground">Couldn't load this check-in.</p>
      <Link to="/app" className="label-mono text-gold mt-4 inline-block">Back to today</Link>
    </div>
  );

  const { checkin, contract } = data;
  const month = checkin.milestone_month as number;

  async function finish() {
    if (!stillHim) { toast.error("Tell the truth first."); return; }
    setBusy(true);
    try {
      await submit({ data: { id, still_him: stillHim, evidence, recommit, score } });
      if (stillHim === "yes" && score >= 7) {
        celebrate("fireworks", {
          milestone: {
            title: `Month ${month}. Still standing.`,
            subtitle: "The mirror doesn't lie. Neither did you.",
            bigNumber: month,
          },
        });
      } else if (stillHim === "no") {
        toast.success("Honesty is the rep. Rewrite the contract.");
        navigate({ to: "/app/identity" as never });
        return;
      } else {
        celebrate("burst", { toast: "Logged. Keep going." });
      }
      setTimeout(() => navigate({ to: "/app" as never }), 1200);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto pb-12 space-y-7">
      <header>
        <Link to="/app" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="label-mono text-gold mt-3">The Mirror · Month {month}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">Look yourself in the eye.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {month} months ago you signed this. Time to find out if you meant it.
        </p>
      </header>

      {/* Read it back */}
      <section className="card-elevated p-6 space-y-4 border-gold/40">
        <ScrollText className="h-5 w-5 text-gold" />
        <p className="font-display text-xl leading-snug">"{contract?.statement}"</p>
        {contract?.signature_data_url && (
          <img src={contract.signature_data_url} alt="Your signature" className="h-16 w-full object-contain opacity-80" />
        )}
        <p className="label-mono text-[10px] text-muted-foreground">
          Signed {contract?.signed_at ? new Date(contract.signed_at).toLocaleDateString() : ""}
        </p>
      </section>

      {/* Still him? */}
      <section className="space-y-3">
        <p className="label-mono text-gold">Are you still that person?</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["yes", "Yes."],
            ["getting_there", "Getting there."],
            ["no", "Not yet."],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setStillHim(k)}
              className={`rounded-lg border p-3 text-sm transition-colors ${
                stillHim === k ? "border-gold bg-gold/10 text-gold" : "border-border hover:bg-card"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Evidence */}
      <section className="space-y-2">
        <label className="label-mono text-gold">Prove it. One sentence.</label>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          rows={3}
          maxLength={800}
          placeholder="What did you do this quarter that proves it?"
          className="w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
        />
      </section>

      {/* Score */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label-mono text-gold">How close, 1–10?</label>
          <span className="font-display text-2xl text-gold">{score}</span>
        </div>
        <input
          type="range"
          min={1} max={10} step={1}
          value={score}
          onChange={(e) => setScore(parseInt(e.target.value, 10))}
          className="w-full accent-[color:var(--gold,#c9a84c)]"
        />
      </section>

      {/* Recommit */}
      <section className="space-y-2">
        <label className="label-mono text-gold">Next 3 months. What's the rep?</label>
        <textarea
          value={recommit}
          onChange={(e) => setRecommit(e.target.value)}
          rows={3}
          maxLength={800}
          placeholder="Recommit. Be specific."
          className="w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
        />
      </section>

      <button onClick={finish} disabled={busy} className="btn-gold w-full h-12 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
        <Sparkles className="h-4 w-4" />
        {busy ? "Logging…" : "Sign the moment"}
      </button>
    </div>
  );
}
