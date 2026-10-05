import { Flame } from "lucide-react";
import { motion } from "motion/react";
import { useCountUp } from "@/hooks/useCountUp";

/**
 * Compact streak ring. Renders an SVG arc that fills based on current count
 * relative to the next habit-formation milestone (3 → 7 → 21 → 66 → 100 → 365).
 * Stroke animates in on mount/update; count rolls up smoothly.
 */
export function StreakRing({ count, label }: { count: number; label?: string }) {
  const milestones = [3, 7, 21, 66, 100, 365];
  const next = milestones.find((m) => m > count) ?? 365;
  const prev = milestones.filter((m) => m <= count).pop() ?? 0;
  const span = next - prev || 1;
  const pct = Math.min(1, Math.max(0, (count - prev) / span));

  const size = 56;
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  const display = Math.round(useCountUp(count));

  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={4}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--rebuilt-gold, hsl(45 80% 55%))"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - dash }}
            transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }}
            style={{
              filter:
                pct >= 1
                  ? "drop-shadow(0 0 6px var(--rebuilt-gold-glow, rgba(212,175,55,0.45)))"
                  : undefined,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Flame className="h-4 w-4 text-gold" />
        </div>
      </div>
      <div>
        <p className="font-display text-xl leading-none text-foreground tabular-nums">
          {display}
        </p>
        <p className="label-mono text-xs text-muted-foreground mt-1">
          {label ?? "day streak"} · next {next}
        </p>
      </div>
    </div>
  );
}
