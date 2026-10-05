import { motion, useReducedMotion } from "motion/react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Wraps route content with a snappy fade transition keyed on pathname.
 * Mobile-first: opacity only (no slide — horizontal slides feel janky on phones),
 * tiny vertical lift, fast easing. Respects prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
