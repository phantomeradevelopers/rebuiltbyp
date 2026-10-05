import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Check, Flame } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { springConfig } from "@/lib/motion-rebuilt";

interface HeroCheckinCardProps {
  /** Whether today's check-in has already been completed. */
  completed: boolean;
  /** Current streak (in days). Used in the subtitle when uncompleted. */
  streak?: number;
  /** Three micro-completion dots: body, mind, faith. Optional. */
  micro?: { body?: boolean; mind?: boolean; faith?: boolean };
  /** Destination route. Defaults to the standard check-in flow. */
  to?: string;
  /**
   * Fires a one-shot gold ring pulse + scale bump. Driven by an integer
   * "tick" — increment to replay (e.g. after an optimistic completion).
   */
  pulseKey?: number;
}

/**
 * The single most important element on the Home screen.
 * Uncompleted state: pulsing gold glow + bright gold border, calls to action.
 * Completed state: calm gold-dim fill with a filled checkmark.
 */
export function HeroCheckinCard({ completed, streak = 0, micro, to = "/app/checkin/today", pulseKey = 0 }: HeroCheckinCardProps) {
  return (
    <Link
      to={to as never}
      preload="intent"
      onClick={() => haptic("selection")}
      className="block group"
      aria-label={completed ? "Today's check-in complete" : "Start today's check-in"}
    >
      <motion.div
        key={`hero-${pulseKey}`}
        whileTap={{ scale: 0.97 }}
        animate={pulseKey > 0 ? { scale: [1, 1.03, 1], boxShadow: ["0 0 0 0 rgba(0,0,0,0)", "0 0 32px -4px var(--rebuilt-gold-glow, rgba(212,175,55,0.65))", "0 0 0 0 rgba(0,0,0,0)"] } : undefined}
        transition={pulseKey > 0 ? { duration: 0.7, ease: [0.22, 1, 0.36, 1] } : springConfig}
        className={[
          "relative flex items-center gap-4 rounded-2xl px-5 py-4 min-h-[80px]",
          "transition-colors duration-200",
          completed
            ? "border bg-[color:var(--rebuilt-gold-dim)] border-[color:var(--rebuilt-gold-solid)]"
            : "border bg-[color:var(--bg-raised)] border-[color:var(--rebuilt-gold)] rb-hero-pulse",
        ].join(" ")}
        style={{ willChange: "transform" }}
      >
        {/* Status icon */}
        <div
          className={[
            "shrink-0 grid place-items-center rounded-full transition-all",
            completed
              ? "h-9 w-9 bg-[color:var(--rebuilt-gold)] text-[#0a0a0a]"
              : "h-9 w-9 border-2 border-[color:var(--rebuilt-gold)]/70",
          ].join(" ")}
        >
          {completed ? <Check className="h-5 w-5" strokeWidth={3} /> : null}
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p
            className={[
              "font-semibold leading-tight",
              completed ? "text-[color:var(--text-primary)]" : "text-[color:var(--rebuilt-gold-bright)]",
            ].join(" ")}
            style={{ fontSize: 17 }}
          >
            {completed ? "Checked in ✓" : "Check in today"}
          </p>
          <p
            className="mt-0.5 text-[13px] leading-snug text-[color:var(--text-secondary)] truncate"
          >
            {completed ? (
              "Today is locked in."
            ) : streak > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3 text-[color:var(--streak-fire)]" />
                {streak} day streak · ~90 sec
              </span>
            ) : (
              "Body · Mind · Faith — about 90 seconds"
            )}
          </p>

          {/* Micro dots — completion sub-indicators (Faith omitted when faith mode is off) */}
          {micro && !completed && (
            <div className="mt-2 flex items-center gap-1.5">
              <Dot on={!!micro.body} label="Body" />
              <Dot on={!!micro.mind} label="Mind" />
              {micro.faith !== undefined && <Dot on={!!micro.faith} label="Faith" />}
            </div>
          )}
        </div>

        <ArrowRight
          className={[
            "h-5 w-5 shrink-0 transition-transform group-active:translate-x-0.5",
            completed ? "text-[color:var(--text-tertiary)]" : "text-[color:var(--rebuilt-gold)]",
          ].join(" ")}
        />
      </motion.div>
    </Link>
  );
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      aria-label={`${label} ${on ? "complete" : "pending"}`}
      className={[
        "h-1.5 w-1.5 rounded-full transition-colors",
        on ? "bg-[color:var(--rebuilt-gold)]" : "bg-[color:var(--border-strong)]",
      ].join(" ")}
    />
  );
}
