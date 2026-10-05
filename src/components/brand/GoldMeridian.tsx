import { motion } from "motion/react";
import { DUR, REBUILT_EASE } from "@/lib/motion";

/**
 * Gold meridian — replaces the standard progress bar.
 * A thin gold line extending across the screen with a glowing tick at the
 * leading edge. Feels like the Apple-setup arc, executed in Rebuilt material.
 */
export function GoldMeridian({
  current,
  total,
  className = "",
}: {
  current: number; // 1-based
  total: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, current / total));

  return (
    <div className={`relative h-2 ${className}`} aria-hidden>
      {/* baseline */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
      {/* filled meridian */}

      <motion.div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-px origin-left"
        style={{
          background:
            "linear-gradient(to right, color-mix(in oklab, var(--gold) 0%, transparent), color-mix(in oklab, var(--gold) 90%, transparent) 30%, var(--gold))",
          boxShadow: "0 0 12px color-mix(in oklab, var(--gold) 45%, transparent)",
          width: "100%",
        }}
        initial={false}
        animate={{ scaleX: pct }}
        transition={{ duration: DUR.meridian, ease: REBUILT_EASE }}
      />

      {/* leading tick */}
      <motion.span
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-gold"
        style={{
          boxShadow:
            "0 0 14px 2px color-mix(in oklab, var(--gold) 70%, transparent), 0 0 4px var(--gold)",
        }}
        initial={false}
        animate={{ left: `${pct * 100}%` }}
        transition={{ duration: DUR.meridian, ease: REBUILT_EASE }}
      />
    </div>
  );
}

