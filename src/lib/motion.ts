/**
 * Shared motion tokens for Rebuilt's first-run presentation.
 * iPhone-faithful pacing, executed in Rebuilt's voice: slow, certain, never bouncy.
 */
import type { Transition, Variants } from "motion/react";

// Cubic-bezier "ease-out-quint" — confident landing, no overshoot.
export const REBUILT_EASE = [0.22, 1, 0.36, 1] as const;
export const REBUILT_EASE_IN = [0.64, 0, 0.78, 0] as const;

export const DUR = {
  glyphDraw: 0.7,
  glyphFade: 0.45,
  headline: 0.55,
  meridian: 0.6,
  backdrop: 0.9,
} as const;

export const DELAY = {
  headlineAfterGlyph: 0.08,
  subAfterHeadline: 0.06,
} as const;

export const glyphTransition: Transition = {
  duration: DUR.glyphDraw,
  ease: REBUILT_EASE,
};

export const headlineVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export const subVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export const fieldStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export const fieldItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: REBUILT_EASE } },
};

// Idle breathing — barely perceptible, period 4s.
export const breathing = {
  scale: [1, 1.015, 1] as number[],
  transition: { duration: 4, ease: "easeInOut" as const, repeat: Infinity },
};
