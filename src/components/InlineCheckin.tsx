import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, Pencil, Check } from "lucide-react";
import { getToday } from "@/lib/dashboard.functions";
import { haptic } from "@/lib/haptics";
import { springConfig } from "@/lib/motion-rebuilt";
import { ReadinessGauge } from "@/components/ReadinessGauge";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Launcher mounted at the top of /app/checkin.
 * Restyled in REBUILT v2 visual language to match HeroCheckinCard.
 */
export function InlineCheckin() {
  const date = todayISO();
  const todayQ = useQuery({
    queryKey: ["today", date],
    queryFn: () => getToday({ data: { date } }),
    staleTime: 30_000,
  });

  const last = todayQ.data?.lastCheckin;
  const done = !!todayQ.data?.checkinDoneToday && last?.date === date;

  if (done && last) {
    return (
      <section className="rounded-2xl p-5 border border-[color:var(--rebuilt-gold-solid)] bg-[color:var(--rebuilt-gold-dim)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-6 w-6 rounded-full bg-[color:var(--rebuilt-gold)] text-[#0a0a0a]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--rebuilt-gold)]">
                Checked in today
              </p>
            </div>
            <div className="mt-4">
              <ReadinessGauge
                inputs={{
                  mood: last.mood,
                  energy: last.energy,
                  stress: last.stress,
                  sleep_hours: last.sleep_hours,
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Chip label="Mood" value={last.mood} />
              <Chip label="Energy" value={last.energy} />
              <Chip label="Stress" value={last.stress} />
              <Chip label="Sleep" value={`${last.sleep_hours}h`} />
              {last.workout_completed && <Chip label="Trained" value="yes" />}
            </div>
          </div>
          <Link
            to="/app/checkin/today"
            onClick={() => haptic("selection")}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)] hover:text-[color:var(--rebuilt-gold)] inline-flex items-center gap-1 shrink-0"
          >
            <Pencil className="h-3 w-3" /> Redo
          </Link>
        </div>
      </section>
    );
  }

  return (
    <Link
      to="/app/checkin/today"
      preload="intent"
      onClick={() => haptic("selection")}
      className="block"
      aria-label="Start today's check-in"
    >
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={springConfig}
        className="rounded-2xl p-6 border border-[color:var(--rebuilt-gold)] bg-[color:var(--bg-raised)] rb-hero-pulse"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)]">
          Today's check-in · ~90 sec
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight text-[color:var(--text-primary)]">
          Tell P where you're at.
        </h2>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)] leading-snug">
          Body · Mind · Faith. Six honest answers — P uses it to tune your day.
          No judgement, no streak shame.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[color:var(--rebuilt-gold)] text-[#0a0a0a] text-sm font-semibold shadow-[0_8px_28px_-10px_var(--rebuilt-gold-glow)]">
          Start check-in <ArrowRight className="h-4 w-4" />
        </span>
      </motion.div>
    </Link>
  );
}

function Chip({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[color:var(--bg-raised)] border border-[color:var(--border-strong,rgba(255,255,255,0.06))]">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
        {label}
      </span>
      <span className="text-[color:var(--text-primary)] text-[11px] tabular-nums">{value ?? "—"}</span>
    </span>
  );
}
