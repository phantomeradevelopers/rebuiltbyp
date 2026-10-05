import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Options = {
  /** Milliseconds of inactivity before the nudge fires. Default 45s. */
  ms?: number;
  /** When false, the hook is inert (e.g., step already complete or onboarding flagged). */
  active: boolean;
  /** Toast body. */
  message: string;
  /** Optional CSS selector for the primary CTA to focus/scroll into view from the toast action. */
  ctaSelector?: string;
};

/**
 * Fires a single non-blocking toast nudge if the user sits idle on an
 * unfinished onboarding step. Once per mount.
 */
export function useIdleNudge({ ms = 45_000, active, message, ctaSelector }: Options) {
  const firedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const reset = () => {
      if (firedRef.current) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (firedRef.current) return;
        firedRef.current = true;
        toast(message, {
          duration: 8000,
          action: ctaSelector
            ? {
                label: "Continue",
                onClick: () => {
                  const el = document.querySelector<HTMLElement>(ctaSelector);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => el.focus({ preventScroll: true }), 400);
                  }
                },
              }
            : undefined,
        });
      }, ms);
    };

    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener("visibilitychange", reset);
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", reset);
    };
  }, [active, ms, message, ctaSelector]);
}
