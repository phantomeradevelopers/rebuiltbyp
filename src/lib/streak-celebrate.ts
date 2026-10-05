import { getCombinedStreak, awardBadge } from "./progress.functions";
import { combinedStreakMilestoneCrossed, celebrateCombinedTier } from "./celebrate";

const STORAGE_KEY = "rebuilt:combined-streak";

function readPrev(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch { return 0; }
}
function writeCur(n: number) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch {}
}

/** Call after a successful workout or meal log. Idempotent + cheap. */
export async function checkCombinedStreakAndCelebrate() {
  try {
    const { streak, earnedBadges } = await getCombinedStreak();
    const prev = readPrev();
    writeCur(streak);
    const tier = combinedStreakMilestoneCrossed(prev, streak);
    if (!tier) return;
    const badgeKey = `combined-${tier}`;
    const already = earnedBadges.includes(badgeKey);
    if (tier === 30 && already) return;
    celebrateCombinedTier(tier, already);
    // Persist 7d/30d badges so they don't re-fire across sessions
    if (tier === 7 || tier === 30) {
      try { await awardBadge({ data: { badge: badgeKey } }); } catch {}
    }
  } catch (e) {
    console.warn("[streak] check failed", (e as Error).message);
  }
}
