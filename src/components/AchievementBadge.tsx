import type { Rarity } from "@/lib/achievements.functions";
import { TrophyGraphic } from "./TrophyGraphic";

const RARITY_STYLES: Record<Rarity, { glow: string; text: string; border: string }> = {
  bronze:   { glow: "shadow-[0_0_20px_-4px_rgba(217,119,6,0.4)]",  text: "text-amber-500",   border: "border-amber-700/40" },
  silver:   { glow: "shadow-[0_0_20px_-4px_rgba(148,163,184,0.4)]", text: "text-slate-300",   border: "border-slate-400/40" },
  gold:     { glow: "shadow-[0_0_24px_-4px_rgba(234,179,8,0.5)]",   text: "text-yellow-400",  border: "border-yellow-500/50" },
  platinum: { glow: "shadow-[0_0_28px_-2px_rgba(217,70,239,0.55)]", text: "text-fuchsia-300", border: "border-fuchsia-400/50" },
  mythic:   { glow: "shadow-[0_0_32px_-2px_rgba(220,38,38,0.7)]",   text: "text-red-400",     border: "border-red-500/60" },
};

export function AchievementBadge({
  title, description, rarity, icon, unlocked, progress, current, target, xp, hidden, compact, achievementKey,
}: {
  title: string;
  description: string;
  rarity: Rarity;
  icon: string | null;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
  xp: number;
  hidden?: boolean;
  compact?: boolean;
  achievementKey?: string;
}) {
  const s = RARITY_STYLES[rarity];
  const showLocked = !unlocked && hidden;

  return (
    <div className={`relative card-elevated p-4 transition-all ${unlocked ? `${s.glow} ${s.border}` : ""}`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <TrophyGraphic
            rarity={rarity}
            icon={showLocked ? null : icon}
            unlocked={unlocked}
            size="sm"
            animated
            achievementKey={showLocked ? undefined : achievementKey}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-display text-base leading-tight ${unlocked ? (rarity === "mythic" || rarity === "platinum" ? "text-gold-shimmer" : "text-foreground") : "text-muted-foreground"}`}>
              {showLocked ? "???" : title}
            </p>
            <span className={`label-mono text-xs shrink-0 ${unlocked ? s.text : "text-muted-foreground/70"}`}>+{xp} XP</span>
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {showLocked ? "Hidden trophy — keep showing up." : description}
            </p>
          )}
          {!unlocked && target > 1 && !showLocked && (
            <div className="mt-2">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-foreground/40 to-foreground/70"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs label-mono text-muted-foreground">{current} / {target}</p>
            </div>
          )}
          {unlocked && (
            <p className={`mt-1 text-xs label-mono ${s.text}`}>UNLOCKED</p>
          )}
        </div>
      </div>
    </div>
  );
}
