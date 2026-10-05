import { motion } from "motion/react";
import { haptic } from "@/lib/haptics";
import { springConfig } from "@/lib/motion-rebuilt";

interface ScaleChipsProps {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Optional anchor labels under the chip row (e.g. ["Low", "High"]). */
  anchors?: [string, string];
}

/**
 * Large 1–10 chip selector. Big touch targets, gold fill on select.
 */
export function ScaleChips({ value, onChange, min = 1, max = 10, anchors }: ScaleChipsProps) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {items.map((n) => {
          const active = value === n;
          return (
            <motion.button
              key={n}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={springConfig}
              onClick={() => {
                haptic("selection");
                onChange(n);
              }}
              className={[
                "h-14 rounded-xl border text-base font-semibold tabular-nums transition-colors",
                active
                  ? "bg-[color:var(--rebuilt-gold)] text-[#0a0a0a] border-[color:var(--rebuilt-gold)] shadow-[0_8px_22px_-12px_var(--rebuilt-gold-glow)]"
                  : "bg-[color:var(--bg-raised)] text-[color:var(--text-secondary)] border-[color:var(--border-strong,rgba(255,255,255,0.08))] hover:text-[color:var(--text-primary)]",
              ].join(" ")}
              aria-pressed={active}
              aria-label={`${n}`}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
      {anchors && (
        <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
          <span>{anchors[0]}</span>
          <span>{anchors[1]}</span>
        </div>
      )}
    </div>
  );
}
