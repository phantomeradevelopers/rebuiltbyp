// Server-only helpers for readiness. Kept in a separate module so the
// tss-serverfn-split transform can't drop sibling declarations from the
// handler chunk (which previously caused 500s on first check-in).

export type ReadinessInput = {
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  energy?: number | null;
  mood?: number | null;
  soreness?: number | null;
};

export function computeReadinessScore(v: ReadinessInput): number {
  const s = (v.sleep_quality ?? 3) * 8;       // 8..40
  const e = (v.energy ?? 3) * 6;              // 6..30
  const m = (v.mood ?? 3) * 6;                // 6..30
  const sor = (6 - (v.soreness ?? 3)) * 4;    // 4..20
  const sh = Math.min(v.sleep_hours ?? 7, 9) * 2; // 0..18
  return Math.max(0, Math.min(100, Math.round(s + e + m + sor + sh - 40)));
}
