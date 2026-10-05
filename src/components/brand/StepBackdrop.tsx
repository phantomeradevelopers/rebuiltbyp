import { motion } from "motion/react";
import { DUR, REBUILT_EASE } from "@/lib/motion";

/**
 * Subtle radial gold glow that drifts on step change. Adds depth without
 * adding color. Sits behind the hero glyph, never above content.
 */
export function StepBackdrop({ stepKey }: { stepKey: string | number }) {
  // Deterministic-ish drift from the key so each step settles in a new spot.
  const hash = typeof stepKey === "number"
    ? stepKey
    : Array.from(String(stepKey)).reduce((a, c) => a + c.charCodeAt(0), 0);
  const dx = ((hash * 17) % 40) - 20;
  const dy = ((hash * 29) % 30) - 15;

  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, x: dx - 8, y: dy - 4 }}
      animate={{ opacity: 1, x: dx, y: dy }}
      transition={{ duration: DUR.backdrop, ease: REBUILT_EASE }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute left-1/2 top-32 -translate-x-1/2 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--gold) 10%, transparent), color-mix(in oklab, var(--gold) 4%, transparent) 55%, transparent 75%)",
          filter: "blur(40px)",
        }}
      />
    </motion.div>
  );
}

