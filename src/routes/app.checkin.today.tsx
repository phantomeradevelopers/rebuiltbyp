import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight } from "lucide-react";
import { CheckinFlow, type CheckinFlowDone } from "@/components/CheckinFlow";
import { CelebrationBurst } from "@/components/rebuilt/CelebrationBurst";
import { StreakNumber } from "@/components/rebuilt/StreakNumber";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/app/checkin/today")({
  head: () => ({
    meta: [
      { title: "Check-in — Rebuilt" },
      { name: "description", content: "Tell P where you're at. Around 90 seconds." },
    ],
  }),
  component: CheckinTodayPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function CheckinTodayPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState<CheckinFlowDone | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--background,#0a0a0a)] overflow-y-auto">
      <div className="mx-auto max-w-md min-h-dvh px-6 py-6 flex flex-col">
        {/* Eyebrow + close */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold text-[color:var(--rebuilt-gold)] tracking-[0.24em] uppercase">
            Check-in
          </span>
          <Link
            to="/app/checkin"
            aria-label="Close check-in"
            onClick={() => haptic("selection")}
            className="h-9 w-9 -mr-2 grid place-items-center rounded-full text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-8 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {!done ? (
              <motion.div
                key="flow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CheckinFlow
                  onClose={() => navigate({ to: "/app/checkin" })}
                  onDone={(info) => setDone(info)}
                />
              </motion.div>
            ) : (
              <VictoryScreen info={done} onDismiss={() => navigate({ to: "/app/checkin" })} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function VictoryScreen({
  info,
  onDismiss,
}: {
  info: CheckinFlowDone;
  onDismiss: () => void;
}) {
  // Auto-dismiss back to /app/checkin after 2s.
  useEffect(() => {
    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const streakLine =
    info.streakDelta > 0
      ? `+${info.streakDelta} day · you're at ${info.nextStreak}`
      : info.partial
        ? "Saved. We'll pick up the rest tomorrow."
        : "Already counted today. Discipline stays.";

  return (
    <motion.div
      key="done"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center pt-10"
    >
      <CelebrationBurst size={104} />

      <h1
        className="mt-8 font-display tracking-tight font-semibold text-[color:var(--rebuilt-gold-bright)] leading-[0.95]"
        style={{ fontSize: 56 }}
      >
        Locked in.
      </h1>

      {info.nextStreak > 0 && info.streakDelta > 0 && (
        <div className="mt-6">
          <StreakNumber count={info.nextStreak} size="md" />
        </div>
      )}

      <p className="mt-5 text-base text-[color:var(--text-primary)]/85 max-w-[20rem]">
        {streakLine}
      </p>
      <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">See you tomorrow.</p>

      <Link
        to="/app/checkin"
        onClick={() => haptic("selection")}
        className="mt-10 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[color:var(--rebuilt-gold)] text-[#0a0a0a] text-sm font-semibold shadow-[0_8px_28px_-10px_var(--rebuilt-gold-glow)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        Back to today <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}
