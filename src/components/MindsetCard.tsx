import { useState } from "react";
import { toast } from "sonner";
import { Brain, RefreshCw, Sparkles, Flame } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTodayMindset, regenerateMindset, type MindsetToday } from "@/lib/mindset.functions";
import { MindsetRepSheet } from "./MindsetRepSheet";

export function MindsetCard({ date }: { date?: string }) {
  const queryClient = useQueryClient();
  // Use the SAME query key the dashboard's mission row reads so a single
  // invalidation keeps both in lockstep.
  const queryKey = ["mindset-today-todo", date ?? "default"] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getTodayMindset({ data: date ? { date } : {} }),
    staleTime: 30_000,
  });
  const [regenerating, setRegenerating] = useState(false);
  const [openSheet, setOpenSheet] = useState(false);

  async function regen() {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await regenerateMindset({ data: date ? { date } : {} });
      queryClient.setQueryData(queryKey, res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  if (isLoading || !data) {
    return (
      <section className="card-elevated p-5 animate-count-up" style={{ animationDelay: "140ms" }}>
        <p className="label-mono text-gold flex items-center gap-1.5"><Brain className="h-3 w-3" /> Mindset</p>
        <p className="mt-3 text-sm text-muted-foreground">Tuning your edge…</p>
      </section>
    );
  }

  const completed = !!data.completedAt;

  return (
    <>
      <section
        className="relative overflow-hidden rounded-lg border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 shadow-[0_0_40px_-20px_rgba(201,168,76,0.6)] animate-count-up"
        style={{ animationDelay: "140ms" }}
      >
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Brain className="h-3 w-3" /> Mindset
          </p>
          <span className="label-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 bg-gold/5 text-gold">
            {data.chip}
          </span>
        </div>

        <p className="mt-4 font-display text-xl leading-snug text-foreground relative">
          "{data.prompt}"
        </p>

        <div className="mt-5 border-t border-gold/15 pt-4 relative">
          <p className="label-mono text-xs text-gold/80 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> {data.repTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{data.repBlurb}</p>
        </div>

        {!data.hasCheckin && (
          <p className="mt-3 text-[11px] text-foreground/70 relative">
            Tip: log today's mood to dial this in tighter.
          </p>
        )}

        <div className="mt-5 flex gap-2 relative">
          <button
            onClick={() => setOpenSheet(true)}
            className={`flex-1 h-11 rounded-md text-sm font-medium transition-all ${
              completed ? "border border-gold/40 bg-gold/10 text-gold" : "btn-gold"
            }`}
          >
            {completed ? "✓ Rep done" : "Start mental rep"}
          </button>
          <button
            type="button"
            onClick={regen}
            disabled={regenerating}
            aria-label="Regenerate"
            className="h-11 px-3 rounded-md border border-border hover:border-gold/60 hover:text-gold text-muted-foreground transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
          </button>
        </div>

        {data.streak > 0 && (
          <p className="mt-3 label-mono text-xs text-gold/80 flex items-center gap-1.5 relative">
            <Flame className="h-3 w-3" /> Mindset streak · {data.streak} day{data.streak === 1 ? "" : "s"}
          </p>
        )}
      </section>

      {openSheet && (
        <MindsetRepSheet
          data={data}
          date={date}
          onClose={() => setOpenSheet(false)}
          onCompleted={(streak) => {
            queryClient.setQueryData<MindsetToday | undefined>(queryKey, (prev) =>
              prev ? { ...prev, completedAt: new Date().toISOString(), streak } : prev,
            );
            queryClient.invalidateQueries({ queryKey });
            import("@/lib/achievements.functions").then(({ evaluateAchievements }) =>
              evaluateAchievements().then((r) =>
                import("@/components/AchievementUnlockOverlay").then(({ pushUnlocks }) => pushUnlocks(r.unlocked))
              ).catch(() => {})
            );
          }}
        />
      )}
    </>
  );
}
