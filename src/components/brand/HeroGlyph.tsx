import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { DUR, REBUILT_EASE, glyphTransition, breathing } from "@/lib/motion";

/**
 * Rebuilt hero glyph.
 *
 * One large gold line-art icon, centered above the headline. On `name`
 * change, the outgoing glyph fades + lifts + tilts; the incoming one
 * scales in, draws its strokes, and a gold flare ring + scan line sweep
 * announce the handoff.
 */

export type GlyphName =
  | "compass"
  | "silhouette"
  | "target"
  | "barbell"
  | "bowl"
  | "heart"
  | "ring"
  | "signature"
  | "sunrise"
  | "aperture"
  | "summit"
  | "flag"
  | "dial"
  | "calendar"
  | "fork-spoon"
  | "moon"
  | "shield"
  | "bell";

type PathDef = { d: string; fill?: boolean };

// Single-stroke line-art on a 96x96 canvas. Each glyph reads as one gesture.
const GLYPHS: Record<GlyphName, PathDef[]> = {
  compass: [
    { d: "M48 8 a40 40 0 1 0 0.001 0" },
    { d: "M48 18 a30 30 0 1 0 0.001 0" },
    { d: "M48 30 L56 50 L48 66 L40 50 Z" },
    { d: "M48 4 L48 12 M48 84 L48 92 M4 48 L12 48 M84 48 L92 48" },
  ],
  silhouette: [
    { d: "M48 14 a10 10 0 1 0 0.001 0" },
    { d: "M28 86 V62 a20 20 0 0 1 40 0 V86" },
    { d: "M28 86 L68 86" },
  ],
  target: [
    { d: "M48 8 a40 40 0 1 0 0.001 0" },
    { d: "M48 22 a26 26 0 1 0 0.001 0" },
    { d: "M48 36 a12 12 0 1 0 0.001 0" },
    { d: "M48 48 L82 14" },
    { d: "M76 14 L84 14 L84 22" },
  ],
  barbell: [
    { d: "M14 36 L14 60" },
    { d: "M22 28 L22 68" },
    { d: "M22 48 L74 48" },
    { d: "M74 28 L74 68" },
    { d: "M82 36 L82 60" },
  ],
  bowl: [
    { d: "M12 46 H84 a36 36 0 0 1 -72 0 Z" },
    { d: "M6 78 H90" },
    { d: "M30 30 C 34 18, 42 18, 46 30" },
    { d: "M50 28 C 54 16, 62 16, 66 28" },
  ],
  heart: [
    { d: "M48 82 C 18 60, 10 38, 24 24 C 36 14, 46 22, 48 30 C 50 22, 60 14, 72 24 C 86 38, 78 60, 48 82 Z" },
    { d: "M10 50 H30 L36 38 L46 62 L54 46 L60 54 L66 50 L86 50" },
  ],
  ring: [
    { d: "M48 8 a40 40 0 1 0 0.001 0" },
  ],

  // A handwritten line + flourish — the user signing on.
  signature: [
    { d: "M10 64 C 22 54, 30 70, 42 60 S 62 48, 74 60 S 88 70, 92 56" },
    { d: "M14 78 H78" },
    { d: "M82 76 L88 80 L84 84" },
  ],

  // Sun arc rising over a horizon line.
  sunrise: [
    { d: "M14 64 H82" },
    { d: "M28 64 a20 20 0 0 1 40 0" },
    { d: "M48 24 V14 M22 36 L16 30 M74 36 L80 30 M14 50 H8 M82 50 H88" },
  ],

  // Camera iris — six bladed aperture.
  aperture: [
    { d: "M48 8 a40 40 0 1 0 0.001 0" },
    { d: "M48 14 L72 28 L48 28 Z" },
    { d: "M72 28 L72 56 L60 42 Z" },
    { d: "M72 56 L48 70 L60 56 Z" },
    { d: "M48 70 L24 56 L36 56 Z" },
    { d: "M24 56 L24 28 L36 42 Z" },
    { d: "M24 28 L48 14 L36 28 Z" },
  ],

  // Mountain range with a tiny summit flag.
  summit: [
    { d: "M8 80 L34 36 L52 60 L66 44 L88 80 Z" },
    { d: "M66 44 V20" },
    { d: "M66 20 L80 24 L66 28" },
    { d: "M8 80 H88" },
  ],

  // One planted flag, ground tick.
  flag: [
    { d: "M28 12 V84" },
    { d: "M28 16 L72 24 L52 36 L72 48 L28 56" },
    { d: "M18 84 H42" },
  ],

  // Half-circle gauge with needle.
  dial: [
    { d: "M14 64 a34 34 0 0 1 68 0" },
    { d: "M14 64 L20 64 M82 64 L76 64 M48 30 V36 M26 40 L30 44 M70 40 L66 44" },
    { d: "M48 64 L70 42" },
    { d: "M48 64 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" },
  ],

  // 7-cell week grid, one cell marked.
  calendar: [
    { d: "M12 22 H84 V80 H12 Z" },
    { d: "M12 36 H84" },
    { d: "M22 22 V14 M74 22 V14" },
    { d: "M22 50 V80 M32 50 V80 M42 50 V80 M52 50 V80 M62 50 V80 M74 50 V80" },
    { d: "M12 50 H84 M12 65 H84" },
    { d: "M42 50 H52 V65 H42 Z", fill: true },
  ],

  // Crossed fork + spoon.
  "fork-spoon": [
    { d: "M30 14 V36 a6 6 0 0 0 12 0 V14" },
    { d: "M30 22 V32 M36 14 V32 M42 22 V32" },
    { d: "M36 36 V84" },
    { d: "M60 14 a10 14 0 1 0 0.001 0" },
    { d: "M60 28 V84" },
  ],

  // Crescent moon + small star.
  moon: [
    { d: "M62 16 a34 34 0 1 0 0 64 a26 26 0 1 1 0 -64 Z" },
    { d: "M22 22 L26 30 L34 32 L26 34 L22 42 L18 34 L10 32 L18 30 Z" },
  ],

  // Shield with a check tick.
  shield: [
    { d: "M48 10 L82 22 V48 C 82 68, 66 82, 48 88 C 30 82, 14 68, 14 48 V22 Z" },
    { d: "M32 48 L44 60 L66 36" },
  ],

  // Bell with clapper.
  bell: [
    { d: "M22 70 C 22 48, 30 30, 48 30 C 66 30, 74 48, 74 70 Z" },
    { d: "M18 70 H78" },
    { d: "M44 76 a4 4 0 0 0 8 0" },
    { d: "M48 22 V30" },
    { d: "M44 18 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" },
  ],
};

export function HeroGlyph({
  name,
  size = 112,
  className = "",
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  const paths = GLYPHS[name];
  const reduce = useReducedMotion();

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={name}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 1.08, rotate: 6, filter: "blur(5px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.92, rotate: -6, filter: "blur(5px)" }}
          transition={{ duration: reduce ? 0.18 : DUR.glyphFade, ease: REBUILT_EASE }}
          className="absolute inset-0"
        >
          {/* Tuning-fork flare ring */}
          {!reduce && (
            <motion.span
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.5, ease: REBUILT_EASE }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: "1px solid color-mix(in oklab, var(--gold) 70%, transparent)",
                boxShadow: "0 0 24px color-mix(in oklab, var(--gold) 40%, transparent)",
              }}
            />
          )}

          <motion.div
            animate={breathing}
            className="absolute inset-0 flex items-center justify-center"
          >
            <svg
              viewBox="0 0 96 96"
              width={size}
              height={size}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 18px color-mix(in oklab, var(--gold) 35%, transparent))" }}
            >
              {paths.map((p, i) => (
                <motion.path
                  key={i}
                  d={p.d}
                  fill={p.fill ? "var(--gold)" : "none"}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={
                    reduce
                      ? { duration: 0.18 }
                      : {
                          ...glyphTransition,
                          delay: 0.05 + i * 0.08,
                          opacity: { duration: 0.25, delay: 0.05 + i * 0.08 },
                        }
                  }
                  style={{ stroke: "var(--gold)" }}
                />
              ))}
            </svg>

            {/* Scan-line sweep across the glyph */}
            {!reduce && (
              <motion.span
                aria-hidden
                initial={{ top: "0%", opacity: 0 }}
                animate={{ top: "100%", opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.7, ease: REBUILT_EASE, delay: 0.05 }}
                className="absolute left-[6%] right-[6%] h-px pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in oklab, var(--gold) 90%, transparent), transparent)",
                  boxShadow: "0 0 8px color-mix(in oklab, var(--gold) 80%, transparent)",
                }}
              />
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
