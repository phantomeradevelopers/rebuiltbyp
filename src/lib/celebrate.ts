import confetti from "canvas-confetti";
import { toast } from "sonner";
import { playChime } from "./sound";
import { haptic } from "./haptics";

const HAPTIC_BY_LEVEL: Record<CelebrateLevel, Parameters<typeof haptic>[0]> = {
  sparkle: "light",
  burst: "success",
  cannons: "success",
  fireworks: "heavy",
};

// Noir & Gold brand palette
const COLORS = ["#c9a84c", "#f0d78c", "#ffffff", "#1a1a1a"];

export type CelebrateLevel = "sparkle" | "burst" | "cannons" | "fireworks";

export type MilestoneEvent = {
  title: string;
  subtitle?: string;
  bigNumber?: string | number;
};

function safe(fn: () => void) {
  try { fn(); } catch (e) { console.warn("[celebrate]", e); }
}

/** Fire visual + audio celebration. Safe to call from any client handler. */
export function celebrate(level: CelebrateLevel, opts?: {
  toast?: string;
  milestone?: MilestoneEvent;
}) {
  if (typeof window === "undefined") return;
  safe(() => haptic(HAPTIC_BY_LEVEL[level]));

  switch (level) {
    case "sparkle":
      safe(() => confetti({
        particleCount: 30, spread: 50, startVelocity: 25, scalar: 0.8,
        origin: { y: 0.7 }, colors: COLORS, ticks: 120,
      }));
      playChime("ding");
      break;

    case "burst":
      safe(() => confetti({
        particleCount: 110, spread: 75, startVelocity: 40,
        origin: { y: 0.65 }, colors: COLORS, ticks: 180,
      }));
      playChime("chime");
      break;

    case "cannons":
      safe(() => {
        confetti({ particleCount: 100, spread: 60, angle: 60,
          origin: { x: 0, y: 0.75 }, colors: COLORS });
        confetti({ particleCount: 100, spread: 60, angle: 120,
          origin: { x: 1, y: 0.75 }, colors: COLORS });
      });
      playChime("chime");
      break;

    case "fireworks": {
      const end = Date.now() + 2400;
      const launch = () => {
        if (Date.now() > end) return;
        safe(() => {
          confetti({ particleCount: 60, spread: 70, startVelocity: 45,
            origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.3 + 0.2 },
            colors: COLORS, ticks: 200, scalar: 1.1 });
        });
        setTimeout(launch, 350);
      };
      launch();
      playChime("fanfare");
      break;
    }
  }

  if (opts?.toast) {
    toast.success(opts.toast, { duration: 4000 });
  }
  if (opts?.milestone) {
    window.dispatchEvent(new CustomEvent<MilestoneEvent>("rebuilt:milestone", { detail: opts.milestone }));
  }
}

/**
 * Per-task knockoff celebration. Pops confetti + a Rebuilt-voice toast that
 * scales by how many tasks remain in the day. Call after marking ANY daily
 * task complete (workout, walk, check-in, mindset, meal target hit, etc.).
 *
 * remaining = tasks still left for today AFTER this one (0 = day complete)
 * total     = total daily tasks (used for context, not displayed directly)
 * label     = short past-tense fragment, e.g. "Walk", "Workout", "Check-in"
 */
export function celebrateTask(remaining: number, total: number, label: string) {
  if (typeof window === "undefined") return;
  if (remaining <= 0) {
    celebrate("fireworks", {
      toast: "Day complete. You showed up. That's the whole game.",
    });
    return;
  }
  const msg =
    remaining === 1
      ? `${label} — done. One left. Don't blink now.`
      : remaining === 2
        ? `${label} — done. Two to go. Stack the wins.`
        : `${label} — done. ${remaining} more to go. Keep moving.`;
  celebrate(remaining <= 2 ? "cannons" : "burst", { toast: msg });
  // total kept in signature so callers stay honest about the denominator
  void total;
}

// ---------- Threshold helpers (pure, easy to test) ----------

const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30]);
export function streakMilestoneCrossed(prev: number, next: number): number | null {
  for (const m of STREAK_MILESTONES) if (next >= m && prev < m) return m;
  return null;
}

const PROGRAM_MILESTONES: Record<number, MilestoneEvent> = {
  7:  { title: "Week 1 complete.",      subtitle: "Foundation laid.",            bigNumber: 7 },
  15: { title: "Halfway. Don't blink.", subtitle: "More behind than ahead.",     bigNumber: 15 },
  21: { title: "Three weeks in.",       subtitle: "This is who you are now.",    bigNumber: 21 },
  30: { title: "30 days. Rebuilt.",     subtitle: "You did the work.",           bigNumber: 30 },
};
export function programMilestone(day: number): MilestoneEvent | null {
  return PROGRAM_MILESTONES[day] ?? null;
}

/** Returns the threshold (0/25/50/75/100) just crossed, or null. */
export function weightProgressCrossed(prevPct: number, nextPct: number): number | null {
  const thresholds = [25, 50, 75, 100];
  for (const t of thresholds) if (nextPct >= t && prevPct < t) return t;
  return null;
}

// ---------- Combined streak (workout + nutrition both logged same day) ----------

const COMBINED_TIERS = [3, 7, 30] as const;
export type CombinedTier = typeof COMBINED_TIERS[number];

export function combinedStreakMilestoneCrossed(prev: number, next: number): CombinedTier | null {
  for (const t of COMBINED_TIERS) if (next >= t && prev < t) return t;
  return null;
}

/** Fire the right level of celebration for a combined-streak tier. */
export function celebrateCombinedTier(tier: CombinedTier, alreadyEarned: boolean = false) {
  if (tier === 3) {
    celebrate("burst", { toast: "3-day momentum. Don't break the chain." });
    return;
  }
  if (tier === 7) {
    celebrate("fireworks", {
      toast: "Perfect week.",
      milestone: { title: "Perfect week. Rebuilt.", subtitle: "7 days. Workout + nutrition. Every day.", bigNumber: 7 },
    });
    return;
  }
  if (tier === 30 && !alreadyEarned) {
    celebrate("fireworks", {
      toast: "30 days. Rebuilt.",
      milestone: { title: "30 days. Rebuilt.", subtitle: "You did not flinch.", bigNumber: 30 },
    });
  }
}
