import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, Loader2, TrendingUp, Activity, AlertTriangle, Target } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getFuelFeel } from "@/lib/fuel-feel.functions";

type Tone = "ahead" | "ontrack" | "behind" | "over";

const TONE: Record<Tone, { label: string; color: string; bar: string; tint: string; ring: string; Icon: typeof Sparkles }> = {
  ahead:   { label: "AHEAD OF PACE", color: "text-emerald-300", bar: "bg-emerald-400", tint: "from-emerald-500/15", ring: "ring-emerald-400/20", Icon: TrendingUp },
  ontrack: { label: "ON TRACK",      color: "text-[color:var(--rebuilt-gold,#d4af37)]", bar: "bg-[color:var(--rebuilt-gold,#d4af37)]", tint: "from-[color:var(--rebuilt-gold,#d4af37)]/15", ring: "ring-[color:var(--rebuilt-gold,#d4af37)]/20", Icon: Target },
  behind:  { label: "BEHIND",        color: "text-orange-300", bar: "bg-orange-400", tint: "from-orange-500/15", ring: "ring-orange-400/20", Icon: Activity },
  over:    { label: "OVER TARGET",   color: "text-rose-300", bar: "bg-rose-400", tint: "from-rose-500/15", ring: "ring-rose-400/20", Icon: AlertTriangle },
};

const STRENGTH: Record<Tone, number> = { ahead: 0.85, ontrack: 0.7, behind: 0.45, over: 0.95 };

export function FuelFeelCard() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["fuel-feel"],
    queryFn: () => getFuelFeel({ data: {} }),
    staleTime: 30 * 60_000,
    retry: 1,
  });

  function refresh() {
    qc.removeQueries({ queryKey: ["fuel-feel"] });
    refetch();
  }

  const tone: Tone = data?.tone ?? "ontrack";
  const t = TONE[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-raised,#141416)] p-5 ring-1 ${data ? t.ring : "ring-white/[0.04]"} transition-shadow`}
    >
      {/* Tint backdrop */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.tint} to-transparent opacity-90`} aria-hidden />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full bg-white/[0.04] inline-flex items-center justify-center ${data ? t.color : "text-[color:var(--rebuilt-gold,#d4af37)]"}`}>
              <t.Icon className="h-3.5 w-3.5" />
            </div>
            <p className={`font-mono text-[10px] tracking-[0.22em] font-semibold ${data ? t.color : "text-[color:var(--rebuilt-gold,#d4af37)]"}`}>
              {data ? t.label : "HOW YOU'RE DOING"}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            aria-label="Refresh feel"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[color:var(--text-tertiary,rgba(255,255,255,0.5))] hover:text-[color:var(--text-primary,#fff)] disabled:opacity-50 active:scale-90 transition-colors"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="load"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="h-3 w-3/4 rounded-md bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-1/2 rounded-md bg-white/[0.06] animate-pulse" />
            </motion.div>
          ) : error ? (
            <motion.div
              key="err"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-between text-xs"
            >
              <p className="text-[color:var(--text-secondary,rgba(255,255,255,0.6))]">Couldn't load your fuel summary.</p>
              <button onClick={refresh} className="text-[color:var(--rebuilt-gold,#d4af37)] hover:underline font-medium">Retry</button>
            </motion.div>
          ) : data ? (
            <motion.div
              key={`d-${tone}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <p className="text-[15px] leading-snug text-[color:var(--text-primary,#fff)]/90">
                {data.summary}
              </p>
              {/* Tone strength bar */}
              <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${t.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(STRENGTH[tone] * 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
