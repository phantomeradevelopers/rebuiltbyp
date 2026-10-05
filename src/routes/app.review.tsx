import { createFileRoute, Link } from "@tanstack/react-router";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Sparkles, RefreshCcw } from "lucide-react";
import { generateWeeklyReview, getLatestWeeklyReview } from "@/lib/weekly-review.functions";
import { CardSkeleton } from "@/components/skeletons";
import { RouteError } from "@/components/RouteError";
import { CoachSpeakerButton } from "@/components/CoachSpeakerButton";

export const Route = createFileRoute("/app/review")({
  component: ReviewPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

type Review = {
  week_start: string;
  stats: Record<string, unknown>;
  ai_summary: string | null;
  one_thing: string | null;
  generated_at: string;
};

function ReviewPage() {
  const smartBack = useSmartBack("/app");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const { review } = await getLatestWeeklyReview();
      setReview(review as Review | null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoaded(true); }
  }
  useEffect(() => { void load(); }, []);

  async function generate() {
    setBusy(true);
    try {
      const r = await generateWeeklyReview();
      setReview({ ...r, generated_at: new Date().toISOString() } as Review);
      toast.success("Weekly review ready.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  const stats = (review?.stats ?? {}) as Record<string, number | string | string[] | null>;
  const statRows: Array<[string, string | number | null | undefined]> = review ? [
    ["Check-ins", stats.checkins as number],
    ["Workouts", stats.workouts as number],
    ["Mindset reps", stats.mindset_reps as number],
    ["Avg mood", stats.avg_mood as number],
    ["Avg energy", stats.avg_energy as number],
    ["Avg sleep (hrs)", stats.avg_sleep as number],
    ["Avg readiness", stats.avg_readiness as number],
    ["Journal entries", stats.journal_count as number],
  ] : [];

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-8">
      <header>
        <button onClick={smartBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="label-mono text-gold mt-3">Weekly review</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">The week, honestly.</h1>
      </header>

      {!loaded ? (
        <>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </>
      ) : !review ? (
        <section className="card-elevated p-6 text-center space-y-4">
          <Sparkles className="h-6 w-6 text-gold mx-auto" />
          <p className="font-display text-xl">No review yet</p>
          <p className="text-sm text-muted-foreground">Generate your first one from the past 7 days.</p>
          <button onClick={generate} disabled={busy} className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60">
            {busy ? "Generating…" : "Generate weekly review"}
          </button>
        </section>
      ) : (
        <>
          <section className="card-elevated p-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="label-mono text-xs text-muted-foreground">Week of {review.week_start}</p>
              {review.ai_summary && <CoachSpeakerButton text={review.ai_summary} />}
            </div>
            <p className="font-display text-lg leading-snug">{review.ai_summary || "Add more logs this week — there's not much to summarize yet."}</p>
            {review.one_thing && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between gap-3">
                  <p className="label-mono text-gold">Next week — one thing</p>
                  <CoachSpeakerButton text={review.one_thing} />
                </div>
                <p className="mt-1 text-base">{review.one_thing}</p>
              </div>
            )}
          </section>

          <section className="card-elevated p-5">
            <p className="label-mono text-gold mb-3">Stats</p>
            <dl className="grid grid-cols-2 gap-3">
              {statRows.map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-background/40 p-3">
                  <dt className="text-xs label-mono text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-display text-xl">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {Array.isArray(stats.top_emotions) && (stats.top_emotions as string[]).length > 0 && (
              <div className="mt-4">
                <p className="text-xs label-mono text-muted-foreground mb-2">Top emotions</p>
                <div className="flex flex-wrap gap-1.5">
                  {(stats.top_emotions as string[]).map((t) => (
                    <span key={t} className="px-2 h-6 inline-flex items-center rounded-full bg-gold/10 border border-gold/30 text-xs text-gold">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <button onClick={generate} disabled={busy} className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md border border-gold/40 text-sm text-gold hover:bg-gold/5 disabled:opacity-60">
            <RefreshCcw className="h-4 w-4" /> {busy ? "Regenerating…" : "Regenerate for this week"}
          </button>
        </>
      )}
    </div>
  );
}
