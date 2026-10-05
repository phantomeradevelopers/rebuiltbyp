import { motion, useReducedMotion } from "motion/react";
import { useCountUp } from "@/hooks/useCountUp";

type Inputs = {
  mood?: number | null;          // 1..10
  energy?: number | null;        // 1..10
  stress?: number | null;        // 1..10 (lower = better)
  sleep_hours?: number | null;   // hours
};

export function computeReadiness({ mood, energy, stress, sleep_hours }: Inputs): number {
  const m = (mood ?? 5) * 5;                          // 5..50
  const e = (energy ?? 5) * 5;                        // 5..50
  const s = (11 - (stress ?? 5)) * 4;                 // 4..40
  const sh = Math.min(Math.max(sleep_hours ?? 7, 0), 9) / 9 * 30; // 0..30
  const raw = m + e + s + sh; // ~9..170
  // Normalize to 0..100
  const pct = Math.round(((raw - 9) / (170 - 9)) * 100);
  return Math.max(0, Math.min(100, pct));
}

function labelFor(score: number): { tag: string; meaning: string; tone: string } {
  if (score >= 75) return { tag: "Primed", meaning: "Push today. You've got it.", tone: "var(--rebuilt-gold)" };
  if (score >= 55) return { tag: "Steady", meaning: "Solid base — keep moving.", tone: "var(--rebuilt-gold)" };
  if (score >= 35) return { tag: "Hold", meaning: "Dial it back. Quality over volume.", tone: "var(--text-secondary)" };
  return { tag: "Recover", meaning: "Sleep, eat, breathe. Tomorrow we work.", tone: "var(--text-secondary)" };
}

export function ReadinessGauge({
  inputs,
  size = 120,
  stroke = 8,
}: {
  inputs: Inputs;
  size?: number;
  stroke?: number;
}) {
  const score = computeReadiness(inputs);
  const display = Math.round(useCountUp(score, 900));
  const { tag, meaning, tone } = labelFor(score);
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border-strong, rgba(255,255,255,0.08))"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduce ? c - dash : c }}
            animate={{ strokeDashoffset: c - dash }}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p
              className="font-display text-3xl leading-none tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {display}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)] mt-1">
              Readiness
            </p>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.2em] font-semibold"
          style={{ color: tone }}
        >
          {tag}
        </p>
        <p className="mt-1.5 font-display text-lg leading-snug text-[color:var(--text-primary)]">
          {meaning}
        </p>
      </div>
    </div>
  );
}
