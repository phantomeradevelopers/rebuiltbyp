import { useMemo, useState } from "react";
import { Quote } from "lucide-react";
import { SheetShell } from "./SheetShell";
import { haptic } from "@/lib/haptics";

const FALLBACK = [
  "You're stronger than the story your mind is telling you.",
  "One breath. One choice. That's the work.",
  "Slow is fine. Stopping is not.",
];

export function AffirmationSheet({ pool, onClose }: { pool: string[]; onClose: () => void }) {
  const picks = useMemo(() => {
    const src = pool.length >= 3 ? pool : [...pool, ...FALLBACK];
    const copy = [...src];
    const out: string[] = [];
    for (let i = 0; i < 3 && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }, [pool]);

  const [i, setI] = useState(0);
  const last = i >= picks.length - 1;

  return (
    <SheetShell
      eyebrow={`Reset · ${i + 1} / ${picks.length}`}
      title="Affirmation"
      onClose={onClose}
      variant="dialog"
      footer={
        <button
          onClick={() => {
            haptic("selection");
            if (last) onClose();
            else setI(i + 1);
          }}
          className="btn-gold h-12 w-full rounded-md text-sm font-medium"
        >
          {last ? "Close" : "Next"}
        </button>
      }
    >
      <div className="py-4">
        <Quote className="h-6 w-6 text-gold mb-4" />
        <p className="font-display text-2xl sm:text-3xl leading-snug min-h-[140px]">
          {picks[i]}
        </p>
      </div>
    </SheetShell>
  );
}
