import type { LastCheckin } from "./dashboard.functions";

export type RecKind = "breathing" | "affirmation" | "mobility" | "calm" | "checkin";
export type Recommendation = { kind: RecKind; reason: string };

export function pickRecommendations(c: LastCheckin | null, todayDate: string): Recommendation[] {
  if (!c) return [{ kind: "checkin", reason: "No check-in yet — start there." }];
  // If latest check-in is older than today, still use it but mark light.
  const stale = c.date !== todayDate;

  const out: Recommendation[] = [];
  if (c.stress >= 7) out.push({ kind: "breathing", reason: stale ? "Stress was high. Two minutes of breath." : "Stress is up. Two minutes of breath." });
  if (c.mood <= 4) out.push({ kind: "affirmation", reason: "Mood is low. One minute of truth." });
  if (c.energy <= 4) out.push({ kind: "mobility", reason: "Energy is low. Move gently, don't force." });
  if (c.sleep_hours <= 5 && !out.some((r) => r.kind === "breathing"))
    out.push({ kind: "breathing", reason: "Short sleep. Reset the nervous system." });

  if (out.length === 0) out.push({ kind: "calm", reason: "Numbers look steady. Keep going." });

  // Dedupe by kind, max 2
  const seen = new Set<RecKind>();
  return out.filter((r) => (seen.has(r.kind) ? false : (seen.add(r.kind), true))).slice(0, 2);
}
