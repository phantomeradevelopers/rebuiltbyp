import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import type { Unlocked } from "@/lib/achievements.functions";
import { TrophyCard } from "./TrophyCard";
import { celebrate } from "@/lib/celebrate";
import { CoachSpeakerButton } from "./CoachSpeakerButton";
import { WinShareSheet } from "./share/WinShareSheet";
import { SignatureSeal } from "./brand/SignatureSeal";

let pushFn: ((items: Unlocked[]) => void) | null = null;

export function pushUnlocks(items: Unlocked[]) {
  if (pushFn && items.length) pushFn(items);
}

export function AchievementUnlockOverlay() {
  const [queue, setQueue] = useState<Unlocked[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    pushFn = (items) => setQueue((q) => [...q, ...items]);
    return () => { pushFn = null; };
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    if (current.rarity === "platinum" || current.rarity === "gold" || current.rarity === "mythic") {
      celebrate("fireworks", { toast: `Trophy unlocked: ${current.title}` });
    } else {
      celebrate("burst", { toast: `Trophy unlocked: ${current.title}` });
    }
  }, [current]);

  if (!current) return null;

  const haloColor = HALO_BY_RARITY[current.rarity] ?? HALO_BY_RARITY.bronze;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in"
      onClick={() => setQueue((q) => q.slice(1))}
    >
      <div className="max-w-sm w-full flex flex-col items-center text-center relative" onClick={(e) => e.stopPropagation()}>
        {/* Rarity-tinted halo behind the trophy */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full motion-safe:animate-[pulse_3.4s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(circle, ${haloColor} 0%, transparent 65%)`,
            filter: "blur(8px)",
          }}
        />
        {/* Conic light rays for top tiers */}
        {(current.rarity === "platinum" || current.rarity === "mythic" || current.rarity === "gold") && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] opacity-30 motion-safe:animate-[spin_18s_linear_infinite]"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${haloColor} 14deg, transparent 28deg, transparent 90deg, ${haloColor} 104deg, transparent 118deg, transparent 180deg, ${haloColor} 194deg, transparent 208deg, transparent 270deg, ${haloColor} 284deg, transparent 298deg)`,
              maskImage: "radial-gradient(circle, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 70%)",
            }}
          />
        )}

        <p className="relative label-mono text-gold mb-4 animate-in slide-in-from-top-2 tracking-widest">TROPHY UNLOCKED</p>

        <div className="relative">
          <TrophyCard
            achievementKey={current.key}
            rarity={current.rarity}
            icon={current.icon}
            title={current.title}
            description={current.description}
            unlocked
            size="lg"
            popOnMount
            serial="NEW"
          />
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          <p className="label-mono text-xs text-gold">+{current.xp} XP</p>
          <CoachSpeakerButton text={`${current.title}. ${current.description}`} />
        </div>

        <div className="relative mt-3 flex flex-col items-center gap-1">
          <p className="font-display text-lg text-foreground/90">Earned.</p>
          <SignatureSeal size="sm" prefix="—" opacity={0.75} />
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => setShareOpen(true)}
            className="h-11 px-5 rounded-md border border-gold/40 text-gold text-sm font-medium inline-flex items-center gap-2 hover:bg-gold/10 transition"
          >
            <Share2 className="h-4 w-4" /> Share win
          </button>
          <button
            onClick={() => setQueue((q) => q.slice(1))}
            className="h-11 px-8 rounded-md btn-gold text-sm font-medium"
          >
            {queue.length > 1 ? `Next (${queue.length - 1})` : "Continue"}
          </button>
        </div>
      </div>
      <WinShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={current.title}
        description={current.description}
      />
    </div>
  );
}

const HALO_BY_RARITY: Record<string, string> = {
  bronze: "rgba(205, 127, 50, 0.35)",
  silver: "rgba(192, 192, 192, 0.35)",
  gold: "rgba(234, 179, 8, 0.45)",
  platinum: "rgba(180, 220, 255, 0.45)",
  mythic: "rgba(217, 70, 239, 0.5)",
};

