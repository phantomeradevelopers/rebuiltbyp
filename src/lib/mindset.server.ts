export type MindsetState = "RECHARGE" | "RESET" | "IGNITE" | "SHARPEN";
export type RepType = "478_breath" | "box_breath" | "visualization" | "gratitude_trio" | "intention";

export function classifyState(input: {
  mood: number | null;
  energy: number | null;
  stress: number | null;
}): MindsetState {
  const mood = input.mood ?? 3;
  const energy = input.energy ?? 3;
  const stress = input.stress ?? 3;
  if (mood <= 2 || energy <= 2) return "RECHARGE";
  if (stress >= 4) return "RESET";
  if (energy >= 4 && mood >= 4) return "IGNITE";
  return "SHARPEN";
}

export const STATE_META: Record<MindsetState, {
  chip: string;
  title: string;
  repType: RepType;
  repTitle: string;
  repBlurb: string;
  fallback: string;
  systemPrompt: string;
}> = {
  RECHARGE: {
    chip: "Low fuel · Recharge",
    title: "Recharge",
    repType: "478_breath",
    repTitle: "4-7-8 breath · 4 rounds",
    repBlurb: "Inhale 4, hold 7, exhale 8. Drop the weight. You're still in the fight.",
    fallback: "Rest is not retreat. It's how warriors return sharper.",
    systemPrompt:
      "You write 1 sentence of fierce, compassionate mindset coaching for an athlete who is low on energy or mood today. Tone: warm, grounded, no toxic positivity. Max 140 chars. No emojis. No quotes. No 'remember,'. Speak directly to them.",
  },
  RESET: {
    chip: "High stress · Reset",
    title: "Reset",
    repType: "box_breath",
    repTitle: "Box breath · 4 rounds",
    repBlurb: "Inhale 4, hold 4, exhale 4, hold 4. Pull your power back to center.",
    fallback: "Pressure is a tax on greatness. Pay it, then keep moving.",
    systemPrompt:
      "You write 1 sentence of calm-but-fierce mindset coaching for an athlete carrying heavy stress. Tone: grounding, sovereign, no fluff. Max 140 chars. No emojis. No quotes. Speak directly to them.",
  },
  IGNITE: {
    chip: "Fired up · Channel it",
    title: "Ignite",
    repType: "visualization",
    repTitle: "60s visualization",
    repBlurb: "Close your eyes. See the rep, see the win, feel it land. Then go take it.",
    fallback: "Fire without aim burns the wrong things. Aim it. Then strike.",
    systemPrompt:
      "You write 1 sentence of warrior-mode mindset coaching for an athlete who is high energy and ready to attack. Tone: bold, electric, focused. Max 140 chars. No emojis. No quotes. Speak directly to them.",
  },
  SHARPEN: {
    chip: "Steady · Sharpen",
    title: "Sharpen",
    repType: "intention",
    repTitle: "Set today's intention",
    repBlurb: "One word. One outcome. Decide what wins today before anyone else can.",
    fallback: "Boring days build dynasties. Show up, then show up again.",
    systemPrompt:
      "You write 1 sentence of disciplined mindset coaching for an athlete on a steady, ordinary day. Tone: stoic, sharp, no hype. Max 140 chars. No emojis. No quotes. Speak directly to them.",
  },
};

// State-specific curated Coach P lines. Plain 8th-grade words, no hype.
// Tone reference: "No shame, no story. Just noticing." / "5 minutes. Show up."
const COACH_LINES: Record<MindsetState, string[]> = {
  RECHARGE: [
    "Low tank days count too. Show up small.",
    "Rest is part of the plan, not a break from it.",
    "You don't have to feel it. You have to start.",
    "Softer with yourself today. The reps still count.",
    "Two minutes is a full workout when you're low.",
    "You are not falling apart. You're refilling.",
    "One breath, then one choice. That's the whole day.",
    "Give it 10 minutes. If you still hate it, walk away.",
    "The mood follows the move. Even a small move.",
    "You've done harder things tired. You forgot, that's all.",
  ],
  RESET: [
    "Breathe. Then decide.",
    "You can't out-think a heavy day. Walk through it.",
    "The reset button is a breath.",
    "Pressure is loud. Do it quiet.",
    "Slow the body first. The head will follow.",
    "You don't have to fix it now. Just don't quit it now.",
    "Take one thing off the list. Then start.",
    "Stop scoring the day at halftime.",
    "One breath in, one breath out. That's a full rep.",
    "You are safe. You are steady. Now the next thing.",
  ],
  IGNITE: [
    "Point the fire at the work. Then swing.",
    "Fired up is a gift. Don't waste it on your phone.",
    "Big energy plus a small plan wins the day.",
    "Warm-up first. Then let it rip.",
    "This is the day for the hard set. Take it.",
    "You feel it. Now go earn the story.",
    "Move fast, breathe slow. That's the trick.",
    "Don't spend all of it in the first 10 minutes.",
    "The rep you want is the one that counts.",
    "Show up loud. Finish clean.",
  ],
  SHARPEN: [
    "Boring days build the new you.",
    "Small wins stack. Trust that.",
    "One good decision beats a perfect plan.",
    "Show up for the person you said you'd be.",
    "The plan is simple. Doing it is the whole thing.",
    "5 minutes. Show up.",
    "Steady is a skill. You're building it.",
    "Every day you show up is a vote for the new you.",
    "Do the boring thing. Then do it tomorrow.",
    "No shame, no story. Just noticing. Then move.",
  ],
};

export async function generateMindsetLine(
  state: MindsetState,
  ctx: { firstName?: string | null; goals?: string[]; weekNumber?: number | null },
): Promise<string> {
  // Curated pool only — no AI fortune-cookie. Deterministic-ish per name+state
  // so a user sees the same line if this runs twice in a day, without needing
  // to persist a random seed. Different users get different lines.
  void ctx.goals;
  void ctx.weekNumber;
  const pool = COACH_LINES[state] ?? COACH_LINES.SHARPEN;
  const seedStr = `${ctx.firstName ?? ""}|${state}|${new Date().toISOString().slice(0, 10)}`;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}
