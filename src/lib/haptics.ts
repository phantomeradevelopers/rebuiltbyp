/**
 * Haptics wrapper. Today this calls navigator.vibrate (Android web only;
 * iOS Safari ignores it). When we wrap the app in Capacitor we'll swap the
 * body for @capacitor/haptics calls — call sites stay the same.
 */
type Pattern = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  selection: 8,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [40, 80, 40, 80, 40],
};

const STORAGE_KEY = "rebuilt.haptics";

export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}
export function setHapticsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

export function haptic(pattern: Pattern = "light") {
  if (typeof window === "undefined") return;
  if (!isHapticsEnabled()) return;
  try {
    const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(PATTERNS[pattern]);
  } catch {
    /* no-op */
  }
}
