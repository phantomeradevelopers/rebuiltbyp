import { Lock } from "lucide-react";
import type { ReactNode } from "react";

interface MilestoneBadgeProps {
  label: string;
  /** Label shown below when unlocked (e.g. date). */
  unlockedSubtitle?: string;
  /** Label shown below when locked (e.g. "18 days away"). */
  lockedSubtitle?: string;
  unlocked: boolean;
  /** Emoji or icon shown in the circle when unlocked. */
  icon?: ReactNode;
}

/**
 * Locked or unlocked milestone badge. Used in the Progress tab horizontal scroll.
 */
export function MilestoneBadge({
  label,
  unlocked,
  unlockedSubtitle,
  lockedSubtitle,
  icon,
}: MilestoneBadgeProps) {
  return (
    <div className="flex flex-col items-center min-w-[80px]">
      <div
        className="grid place-items-center rounded-full transition-all"
        style={{
          height: 64,
          width: 64,
          background: unlocked ? "var(--rebuilt-gold-dim)" : "var(--bg-elevated)",
          border: unlocked ? "2px solid var(--rebuilt-gold)" : "1px solid var(--border-default)",
          boxShadow: unlocked ? "var(--shadow-gold)" : "none",
        }}
      >
        {unlocked ? (
          <span style={{ fontSize: 26 }}>{icon ?? "🔥"}</span>
        ) : (
          <Lock className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
        )}
      </div>
      <p
        className="mt-2 font-semibold"
        style={{
          fontSize: 12,
          color: unlocked ? "var(--rebuilt-gold)" : "var(--text-secondary)",
        }}
      >
        {label}
      </p>
      {(unlocked ? unlockedSubtitle : lockedSubtitle) && (
        <p
          className="mt-0.5 text-center"
          style={{ fontSize: 10, color: "var(--text-tertiary)" }}
        >
          {unlocked ? unlockedSubtitle : lockedSubtitle}
        </p>
      )}
    </div>
  );
}
