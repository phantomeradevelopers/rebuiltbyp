// 40 short, plain-language lines in Coach P's voice.
// 8th-grade words. No "unyielding precision." No "resides." No hype.
// Tone reference: "No shame, no story. Just noticing." / "5 minutes. Show up."
export const COACH_P_LINES: string[] = [
  "No shame, no story. Just noticing.",
  "5 minutes. Show up.",
  "One breath. Then the next one. That's it.",
  "You don't have to feel like it. You just have to start.",
  "Slow is fine. Stopping is not.",
  "The mood follows the move. Not the other way around.",
  "Small wins stack. Trust that.",
  "You're not behind. You're right on time for today.",
  "Progress, not proof. Nobody's grading this.",
  "You can't out-think a bad day. You can walk through it.",
  "Do the boring thing. Then do it tomorrow.",
  "The rep you don't want to do is the one that counts.",
  "You're allowed to rest. You're not allowed to quit.",
  "Give it 10 minutes. If you still hate it, walk away.",
  "Discipline is just being kind to your future self.",
  "You are not your worst hour. You are the next choice.",
  "Show up messy. Show up tired. Just show up.",
  "One good decision beats a perfect plan.",
  "You've done harder things. You forgot, that's all.",
  "Softer with yourself. Harder with the work.",
  "Breathe. Then decide.",
  "Nothing has to be big. It has to be today.",
  "Stop scoring the day at halftime.",
  "The body remembers. Keep feeding it good reps.",
  "Rest is part of the plan, not a break from it.",
  "You don't need motivation. You need a start time.",
  "Two minutes counts. Two minutes always counts.",
  "The story in your head is not the report card.",
  "Old you didn't get you here. New you does the next rep.",
  "Comfort is not the goal. Steadiness is.",
  "Show up for the person you said you'd be.",
  "You get to choose again in five minutes.",
  "The plan is simple. Doing it is the whole thing.",
  "Fear is loud. Do it quiet.",
  "Every day you show up is a vote for the new you.",
  "The reset button is a breath.",
  "Don't wait to feel ready. Ready shows up during the work.",
  "You are not falling apart. You are getting stronger in real time.",
  "One rep. One meal. One breath. Stack it.",
  "The next right thing is small. Do that one.",
];

let cursor = 0;
export function pickCoachPLine(seed?: string): string {
  if (typeof seed === "string" && seed.length > 0) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % COACH_P_LINES.length;
    return COACH_P_LINES[idx];
  }
  const line = COACH_P_LINES[cursor % COACH_P_LINES.length];
  cursor += 1;
  return line;
}

// Track-aware, intensity-aware, locale-aware picker.
import { COACH_GRACE_LINES, pickCoachGraceLine } from "./coach-grace-quotes";
import { COACH_P_FIRE_EN, COACH_P_FIRE_ES } from "./coach-p-fire-quotes";
import { COACH_GRACE_FIRE_EN, COACH_GRACE_FIRE_ES } from "./coach-grace-fire-quotes";
import type { MindsetIntensity } from "./mindset-intensity";

export type Track = "men" | "angels" | null | undefined;

function seededPick(pool: string[], seed?: string): string {
  if (pool.length === 0) return "";
  if (typeof seed === "string" && seed.length > 0) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return pool[Math.abs(h) % pool.length];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickTrackLine(track: Track, seed?: string): string {
  if (track === "angels") return pickCoachGraceLine(seed);
  return pickCoachPLine(seed);
}

export function trackLinePool(track: Track): string[] {
  return track === "angels" ? COACH_GRACE_LINES : COACH_P_LINES;
}

/**
 * Intensity + locale aware picker.
 *   calm     → curated calm pool only
 *   fire     → curated fire pool only
 *   balanced → mix (~70% calm, ~30% fire, deterministic per seed)
 */
export function pickMindsetLine(opts: {
  track: Track;
  intensity: MindsetIntensity;
  locale?: string;
  seed?: string;
}): string {
  const isAngels = opts.track === "angels";
  const isEs = (opts.locale ?? "en").toLowerCase().startsWith("es");
  const calmPool = isAngels ? COACH_GRACE_LINES : COACH_P_LINES;
  const firePool = isAngels
    ? (isEs ? COACH_GRACE_FIRE_ES : COACH_GRACE_FIRE_EN)
    : (isEs ? COACH_P_FIRE_ES : COACH_P_FIRE_EN);

  if (opts.intensity === "fire") return seededPick(firePool, opts.seed);
  if (opts.intensity === "calm") return seededPick(calmPool, opts.seed);

  const bucketSeed = `bucket:${opts.seed ?? ""}`;
  let h = 0;
  for (let i = 0; i < bucketSeed.length; i++) h = (h * 31 + bucketSeed.charCodeAt(i)) | 0;
  const bucket = Math.abs(h) % 10;
  const pool = bucket < 3 ? firePool : calmPool;
  return seededPick(pool, opts.seed);
}

