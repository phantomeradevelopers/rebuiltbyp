/**
 * REBUILT v2 — shared motion presets.
 * Use these instead of one-off spring configs so every animation in the
 * app feels like it came from the same hand.
 */
import type { Transition } from "motion/react";

export const springConfig: Transition = { type: "spring", stiffness: 380, damping: 30 };
export const celebrateSpring: Transition = { type: "spring", stiffness: 280, damping: 18 };
export const bouncySpring: Transition = { type: "spring", stiffness: 300, damping: 20 };

export const REBUILT_EASE_OUT = [0, 0, 0.2, 1] as const;
export const REBUILT_EASE_SPRING = [0.25, 0.46, 0.45, 0.94] as const;

export const pageEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: REBUILT_EASE_OUT },
};
