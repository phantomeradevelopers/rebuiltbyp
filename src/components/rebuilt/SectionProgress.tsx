import { motion } from "motion/react";

export type CheckinSection = "body" | "mind" | "faith";

interface SectionProgressProps {
  /** Currently active section. */
  current: CheckinSection;
  /** Progress through the current section, 0..1. */
  sectionProgress: number;
  /** Optional small "n / total" label rendered on the right. */
  stepLabel?: string;
}

const SECTIONS: { id: CheckinSection; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "mind", label: "Mind" },
  { id: "faith", label: "Faith" },
];

/**
 * 3-segment Body / Mind / Faith progress bar.
 * Completed segments fill solid gold; the active segment fills proportionally.
 */
export function SectionProgress({ current, sectionProgress, stepLabel }: SectionProgressProps) {
  const currentIdx = SECTIONS.findIndex((s) => s.id === current);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
        <div className="flex items-center gap-3">
          {SECTIONS.map((s, i) => {
            const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
            return (
              <span
                key={s.id}
                className={[
                  "font-mono transition-colors",
                  state === "pending"
                    ? "text-[color:var(--text-tertiary)]"
                    : state === "done"
                      ? "text-[color:var(--rebuilt-gold)]/70"
                      : "text-[color:var(--rebuilt-gold-bright)]",
                ].join(" ")}
              >
                {s.label}
              </span>
            );
          })}
        </div>
        {stepLabel && (
          <span className="font-mono text-[color:var(--text-tertiary)]">{stepLabel}</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {SECTIONS.map((s, i) => {
          const fill = i < currentIdx ? 1 : i === currentIdx ? Math.max(0, Math.min(1, sectionProgress)) : 0;
          return (
            <div
              key={s.id}
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--bg-raised)]"
            >
              <motion.div
                className="absolute inset-y-0 left-0 bg-[color:var(--rebuilt-gold)]"
                initial={false}
                animate={{ width: `${fill * 100}%` }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
