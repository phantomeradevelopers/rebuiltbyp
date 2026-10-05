/**
 * Smart upgrade prompt dismiss memory.
 * Honest levers only: no repeat-nagging. Once a user dismisses an upgrade
 * card for a specific feature, we won't re-surface it for `COOLDOWN_MS`.
 */
const PREFIX = "rebuilt:upgrade-dismissed:";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function isUpgradeDismissed(feature: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PREFIX + feature);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function recordUpgradeDismissed(feature: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + feature, String(Date.now()));
  } catch {}
}

export function clearUpgradeDismissed(feature: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + feature);
  } catch {}
}
