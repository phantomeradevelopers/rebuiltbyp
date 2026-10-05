// 40 short, plain-language lines in Coach Grace's voice — Angels track.
// 8th-grade words. Warm, strong, plain. Never condescending.
// Tone reference: "Strong is quiet. Show up anyway."
export const COACH_GRACE_LINES: string[] = [
  "Strong is quiet. Show up anyway.",
  "You don't have to feel ready. Start small.",
  "One breath. Then the next one. That's it.",
  "Soft doesn't mean weak. It means steady.",
  "The mood follows the move. Give it a minute.",
  "You are allowed to rest. You are not required to quit.",
  "Small steady wins. Nothing has to be big.",
  "You are not behind. You are right on time for today.",
  "Kindness to yourself is a form of discipline.",
  "The story in your head is not the score.",
  "Do the boring thing. Then do it tomorrow.",
  "The rep you almost skipped is the one that counts.",
  "Progress, not proof. Nobody is grading this.",
  "You have done harder things. You just forgot.",
  "Show up tired. Show up quiet. Just show up.",
  "One good choice beats a perfect plan.",
  "Breathe first. Decide after.",
  "You are stronger than the story your mind is telling you.",
  "Stop scoring the day at halftime.",
  "The reset button is a breath.",
  "Two minutes counts. Two minutes always counts.",
  "Old you did the best she could. New you does the next thing.",
  "You are not falling apart. You are becoming.",
  "Give yourself the same grace you give your people.",
  "Warmth is a strength. Use it on yourself first.",
  "The body remembers. Keep feeding it good moments.",
  "Rest is part of the plan, not a break from it.",
  "You do not need to earn today. You just need to show up.",
  "Discipline is love with a schedule.",
  "You are the mother of your next self. Be gentle. Be honest.",
  "Softer with yourself. Steady with the work.",
  "The next right thing is small. Do that one.",
  "Cry if you need to. Then move a little.",
  "You get to choose again in five minutes.",
  "Faith is the small step you take when you can't see the whole staircase.",
  "You do not have to be loud to be brave.",
  "Comfort is not the goal. Peace is.",
  "The plan is simple. Doing it is the whole thing.",
  "You are not too much. You are becoming yourself.",
  "One breath. One choice. That is the work.",
];

let cursor = 0;
export function pickCoachGraceLine(seed?: string): string {
  if (typeof seed === "string" && seed.length > 0) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % COACH_GRACE_LINES.length;
    return COACH_GRACE_LINES[idx];
  }
  const line = COACH_GRACE_LINES[cursor % COACH_GRACE_LINES.length];
  cursor += 1;
  return line;
}
