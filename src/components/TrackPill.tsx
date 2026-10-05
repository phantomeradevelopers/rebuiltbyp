import { useTrack } from "@/lib/track";
import { toast } from "sonner";
import { motion } from "motion/react";

/**
 * Home-screen track toggle. One tap flips coach (Coach P ↔ Coach Grace),
 * voices, and all track-aware copy. Same effect as the Settings picker.
 */
export function TrackPill() {
  const { track, setTrack, saving } = useTrack();

  async function switchTo(next: "men" | "angels") {
    if (saving || next === track) return;
    try {
      await setTrack(next);
      toast.success(
        next === "angels"
          ? "Switched to Rebuilt Angels — say hi to Coach Grace."
          : "Switched to Rebuilt — Coach P is with you.",
      );
    } catch {
      toast.error("Couldn't switch tracks. Try again.");
    }
  }

  const options: Array<{ v: "men" | "angels"; label: string; sub: string }> = [
    { v: "men", label: "Men's", sub: "Coach P" },
    { v: "angels", label: "Angels", sub: "Coach Grace" },
  ];

  return (
    <div className="flex justify-center">
      <div
        role="tablist"
        aria-label="Choose your track"
        className="relative inline-flex items-center rounded-full border border-foreground/12 bg-background/60 backdrop-blur-md p-1 text-xs shadow-sm"
      >
        {options.map((o) => {
          const active = track === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={saving}
              onClick={() => switchTo(o.v)}
              className={`relative z-10 inline-flex items-center gap-2 h-8 px-3.5 rounded-full transition-colors ${
                active ? "" : "text-foreground/70 hover:text-foreground"
              } disabled:opacity-70`}
              style={active ? { color: "var(--gold-foreground)" } : undefined}

            >
            {active && (
                <motion.span
                  layoutId="track-pill-active"
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--gradient-gold)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}

              <span className="relative label-mono tracking-[0.16em] font-medium">
                {o.label}
              </span>
              <span className="relative text-[10px] opacity-80">· {o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
