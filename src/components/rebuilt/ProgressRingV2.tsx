import { motion } from "motion/react";
import type { ReactNode } from "react";

interface ProgressRingV2Props {
  /** Progress value (numerator). */
  value: number;
  /** Maximum value (denominator). */
  max: number;
  /** Ring diameter in pixels. Default 120. */
  size?: number;
  /** Stroke width in pixels. Default 8. */
  stroke?: number;
  /** Optional content rendered in the center of the ring. */
  children?: ReactNode;
}

/**
 * Animated gold progress ring. Draws clockwise from 12 o'clock on mount.
 */
export function ProgressRingV2({
  value,
  max,
  size = 120,
  stroke = 8,
  children,
}: ProgressRingV2Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max <= 0 ? 0 : value / max));
  const dash = c * pct;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size, willChange: "transform" }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rebuilt-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }}
          style={{ filter: pct >= 1 ? "drop-shadow(0 0 8px var(--rebuilt-gold-glow))" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
