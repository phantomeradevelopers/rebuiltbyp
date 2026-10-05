import { motion } from "motion/react";

interface CelebrationBurstProps {
  size?: number;
}

/**
 * SVG check that draws itself, surrounded by a 12-particle gold burst.
 * Pure visual — caller controls when to render.
 */
export function CelebrationBurst({ size = 96 }: CelebrationBurstProps) {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  const radius = size * 0.95;

  return (
    <div className="relative grid place-items-center" style={{ height: size * 1.4, width: size * 1.4 }}>
      {/* Particle burst */}
      {particles.map((i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-[color:var(--rebuilt-gold-bright)]"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: tx, y: ty, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.012, ease: [0.22, 1, 0.36, 1] }}
            style={{ boxShadow: "0 0 12px var(--rebuilt-gold-glow)" }}
          />
        );
      })}

      {/* Halo ring */}
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1.3, opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="absolute rounded-full border-2 border-[color:var(--rebuilt-gold)]"
        style={{ height: size, width: size }}
      />

      {/* Solid check disc */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 18 }}
        className="grid place-items-center rounded-full bg-[color:var(--rebuilt-gold)]"
        style={{
          height: size,
          width: size,
          boxShadow: "0 0 48px -6px var(--rebuilt-gold-glow)",
        }}
      >
        <svg viewBox="0 0 48 48" style={{ height: size * 0.55, width: size * 0.55 }}>
          <motion.path
            d="M12 24 L21 33 L36 16"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
