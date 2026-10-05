import { motion } from "motion/react";
import { HeroSurface } from "./HeroSurface";

/**
 * Compact cinematic header used on inner routes (Coach, Spirit, Plan, etc.).
 * Smaller than the dashboard hero — same visual language so the app feels unified.
 */
export function ImmersiveHeader({
  eyebrow,
  title,
  subtitle,
  variant,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  variant?: "dawn" | "iron" | "ember";
}) {
  return (
    <HeroSurface height="36vh" variant={variant}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-md mx-auto w-full px-6"
      >
        <p className="label-mono text-gold">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-[1.05] text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-foreground/80 max-w-sm mx-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {subtitle}
          </p>
        )}
      </motion.div>
    </HeroSurface>
  );
}
