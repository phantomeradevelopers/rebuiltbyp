import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Activity, Flame, Wind } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { springConfig } from "@/lib/motion-rebuilt";
import type { TopMission } from "@/lib/readiness-score";

const ICON = {
  low: Wind,
  steady: Activity,
  high: Flame,
} as const;

const ACCENT = {
  low: "text-[color:var(--text-secondary)]",
  steady: "text-[color:var(--rebuilt-gold)]",
  high: "text-[color:var(--streak-fire)]",
} as const;

/**
 * Readiness-driven top mission. Renders above the daily-loop block on /app.
 * Reads from cached `lastCheckin` so it appears instantly with no spinner.
 */
export function TopMissionCard({ mission }: { mission: TopMission }) {
  const Icon = ICON[mission.score];
  return (
    <Link
      to={mission.to as never}
      preload="intent"
      onClick={() => haptic("selection")}
      className="block group"
      aria-label={`Top mission: ${mission.label}`}
    >
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={springConfig}
        className="relative rounded-2xl border border-[color:var(--rebuilt-gold)]/35 bg-[color:var(--bg-raised)] px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div
            className={`shrink-0 grid place-items-center h-9 w-9 rounded-full bg-[color:var(--rebuilt-gold-dim)] ${ACCENT[mission.score]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)]">
              Top mission
            </p>
            <p className="mt-0.5 font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 16 }}>
              {mission.label}
            </p>
            <p className="text-[12px] text-[color:var(--text-secondary)] leading-snug truncate">
              {mission.sub}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--rebuilt-gold)]/70 group-active:translate-x-0.5 transition-transform" />
        </div>
        <p className="mt-3 pl-1 border-l-2 border-[color:var(--rebuilt-gold)]/50 ml-1 text-[12px] italic text-[color:var(--text-secondary)]">
          Coach P · {mission.reason}
        </p>
      </motion.div>
    </Link>
  );
}
