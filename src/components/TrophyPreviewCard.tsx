import { Link } from "@tanstack/react-router";
import { Trophy, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAchievements } from "@/lib/achievements.functions";
import { AchievementBadge } from "./AchievementBadge";
import { TrophyGraphic } from "./TrophyGraphic";

export function TrophyPreviewCard() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthReady(!!data.user);
    });
    return () => { cancelled = true; };
  }, []);

  const { data } = useQuery({
    queryKey: ["achievements-summary"],
    queryFn: () => listAchievements(),
    enabled: authReady,
    staleTime: 30_000,
  });

  if (!data) return null;

  const unlocked = data.items
    .filter((i) => i.unlocked)
    .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""))
    .slice(0, 3);
  const close = data.items
    .filter((i) => !i.unlocked && !i.hidden && i.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 2);
  const pct = Math.min(100, Math.round(((data.stats.totalXp - data.stats.prevLevelXp) / Math.max(1, data.stats.nextLevelXp - data.stats.prevLevelXp)) * 100));

  return (
    <Link to="/app/achievements" className="block card-elevated p-5 animate-count-up" style={{ animationDelay: "240ms" }}>
      <div className="flex items-center justify-between">
        <p className="label-mono text-gold flex items-center gap-1.5"><Trophy className="h-3 w-3" /> Trophy Room</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {unlocked.length > 0 && (
        <div className="mt-4 flex items-end justify-center gap-2 py-2 px-2 rounded-md bg-gradient-to-b from-transparent to-muted/30 border border-border/40">
          {unlocked.map((t) => (
            <div key={t.key} title={t.title}>
              <TrophyGraphic rarity={t.rarity} icon={t.icon} unlocked size="sm" animated achievementKey={t.key} />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 3 - unlocked.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="opacity-30">
              <TrophyGraphic rarity="bronze" icon={null} unlocked={false} size="sm" animated={false} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-end justify-between">
        <div>
          {data.stats.level > 0 ? (
            <>
              <p className="font-display text-3xl text-foreground leading-none">Lvl {data.stats.level}</p>
              <p className="mt-1 label-mono text-muted-foreground">{data.stats.unlockedCount} / {data.stats.totalCount} unlocked</p>
            </>
          ) : (() => {
            // Zero-state: show the next unlock target instead of "0/47 unlocked"
            const nextUp = data.items
              .filter((i) => !i.unlocked && !i.hidden)
              .sort((a, b) => b.progress - a.progress)[0];
            return (
              <>
                <p className="font-display text-xl text-foreground leading-tight">
                  Level 1 in {Math.max(1, data.stats.nextLevelXp - data.stats.totalXp)} XP
                </p>
                <p className="mt-1 label-mono text-muted-foreground truncate max-w-[180px]">
                  {nextUp ? `Next: ${nextUp.title}` : "Show up today to unlock your first trophy"}
                </p>
              </>
            );
          })()}
        </div>
        <div className="text-right">
          <p className="font-display text-xl text-gold">{data.stats.totalXp}</p>
          <p className="label-mono text-muted-foreground">XP</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-gold/80 to-gold" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs label-mono text-muted-foreground">
        {data.stats.level > 0
          ? `${data.stats.nextLevelXp - data.stats.totalXp} XP to Lvl ${data.stats.level + 1}`
          : "Every check-in earns XP."}
      </p>

      {unlocked.length === 0 && close.length > 0 && (
        <div className="mt-4 grid gap-2">
          {close.map(({ key, ...rest }) => (
            <AchievementBadge key={key} achievementKey={key} {...rest} compact />
          ))}
        </div>
      )}
    </Link>
  );
}

