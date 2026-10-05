import { AnimatePresence, motion } from "motion/react";
import { Flame, Snowflake } from "lucide-react";

interface StreakNumberProps {
  count: number;
  best?: number;
  size?: "sm" | "md" | "lg";
}

/**
 * Streak counter with a flip animation when the number changes.
 * Active (count > 0): fire icon + warm orange numeral.
 * Broken (count == 0): snowflake + calm copy — never shame-based.
 */
export function StreakNumber({ count, best, size = "lg" }: StreakNumberProps) {
  const broken = count <= 0;
  const fontSize = size === "lg" ? 52 : size === "md" ? 38 : 28;

  return (
    <div className="flex items-center gap-4">
      <div
        className="grid place-items-center rounded-full"
        style={{
          height: size === "lg" ? 56 : 44,
          width: size === "lg" ? 56 : 44,
          background: broken ? "rgba(255,255,255,0.05)" : "var(--streak-dim)",
        }}
      >
        {broken ? (
          <Snowflake className="h-6 w-6" style={{ color: "var(--text-secondary)" }} />
        ) : (
          <Flame
            className="h-7 w-7"
            style={{ color: "var(--streak-fire)", filter: "drop-shadow(0 0 8px var(--streak-glow))" }}
          />
        )}
      </div>

      <div className="leading-none">
        <div className="flex items-baseline gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="font-extrabold tracking-tight tabular-nums"
              style={{
                fontSize,
                color: broken ? "var(--text-tertiary)" : "var(--streak-fire)",
                lineHeight: 1,
              }}
            >
              {Math.max(0, count)}
            </motion.span>
          </AnimatePresence>
          <span
            className="font-medium"
            style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.04em" }}
          >
            {broken ? "fresh start" : count === 1 ? "DAY" : "DAYS"}
          </span>
        </div>
        {typeof best === "number" && best > 0 && (
          <p
            className="mt-2 uppercase"
            style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}
          >
            Best · {best} {best === 1 ? "day" : "days"}
          </p>
        )}
      </div>
    </div>
  );
}
