import { motion } from "motion/react";
import { REBUILT_EASE } from "@/lib/motion";


type Props = {
  count: number;
  index: number;
  onSelect?: (i: number) => void;
  label?: string;
};

export function DotPager({ count, index, onSelect, label = "Step" }: Props) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === index;
        const visited = i < index;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${label} ${i + 1} of ${count}`}
            onClick={() => onSelect?.(i)}
            className="group relative h-6 w-6 grid place-items-center"
          >
            <motion.span
              layout
              transition={{ duration: 0.25, ease: REBUILT_EASE }}

              className={`block rounded-full ${
                active
                  ? "h-2.5 w-2.5 bg-gold shadow-[0_0_10px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                  : visited
                    ? "h-1.5 w-1.5 bg-gold/60"
                    : "h-1.5 w-1.5 bg-border group-hover:bg-muted-foreground"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
