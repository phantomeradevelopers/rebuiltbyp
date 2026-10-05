/**
 * Client-side crisis keyword detection. Runs locally — no network call on
 * sensitive content. Server-side classifier is a future opt-in second pass.
 *
 * Returns matched terms + severity. Empty array = safe to proceed normally.
 */
const HIGH = [
  "kill myself", "end my life", "suicide", "suicidal", "take my own life",
  "want to die", "better off dead", "no reason to live",
];
const MEDIUM = [
  "self-harm", "self harm", "hurt myself", "cutting myself",
  "hopeless", "worthless", "can't go on", "give up on life",
];
const LOW = [
  "rock bottom", "spiraling", "panic attack", "abusing", "relapsed",
];

export type SafetySignal = {
  matched: string[];
  severity: "low" | "medium" | "high";
  excerpt: string;
};

export function detectCrisis(text: string): SafetySignal | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const hits = (list: string[]) => list.filter((t) => lower.includes(t));
  const high = hits(HIGH);
  const medium = hits(MEDIUM);
  const low = hits(LOW);
  const matched = [...high, ...medium, ...low];
  if (matched.length === 0) return null;
  const severity: SafetySignal["severity"] = high.length ? "high" : medium.length ? "medium" : "low";
  return {
    matched,
    severity,
    excerpt: text.slice(0, 280),
  };
}
