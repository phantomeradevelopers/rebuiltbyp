import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { Rarity } from "@/lib/achievements.functions";
import { TrophyGraphic } from "./TrophyGraphic";

type Size = "sm" | "md" | "lg";

const TIER_LABEL: Record<Rarity, string> = {
  bronze: "Recruit",
  silver: "Soldier",
  gold: "Warrior",
  platinum: "Champion",
  mythic: "Legend",
};

const TIER_STARS: Record<Rarity, number> = {
  bronze: 1, silver: 2, gold: 3, platinum: 4, mythic: 5,
};

const SIZE_CONFIG: Record<Size, { card: string; graphic: Size; title: string; lore: string; pad: string; ribbon: string }> = {
  sm: { card: "w-[140px]", graphic: "sm", title: "text-[11px]", lore: "text-[11px]", pad: "p-2.5", ribbon: "text-[8px]" },
  md: { card: "w-[200px]", graphic: "md", title: "text-sm", lore: "text-xs", pad: "p-3.5", ribbon: "text-[11px]" },
  lg: { card: "w-[280px]", graphic: "lg", title: "text-lg", lore: "text-[11px]", pad: "p-5", ribbon: "text-xs" },
};

export function TrophyCard({
  rarity,
  icon,
  title,
  description,
  unlocked,
  serial,
  size = "md",
  popOnMount = false,
  showLore = true,
  achievementKey,
  preview = false,
}: {
  rarity: Rarity;
  icon: string | null;
  title: string;
  description: string;
  unlocked: boolean;
  serial?: string;
  size?: Size;
  popOnMount?: boolean;
  showLore?: boolean;
  achievementKey?: string;
  preview?: boolean;
}) {
  const cfg = SIZE_CONFIG[size];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; mx: number; my: number }>({ rx: 0, ry: 0, mx: 50, my: 50 });

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      ry: (px - 0.5) * 14,
      rx: -(py - 0.5) * 14,
      mx: px * 100,
      my: py * 100,
    });
  }
  function onLeave() {
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
  }

  const stars = TIER_STARS[rarity];

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`trophy-card trophy-card-${rarity} ${cfg.card} ${cfg.pad} ${popOnMount ? "trophy-card-flip" : ""}`}
      style={{
        transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        // @ts-expect-error css vars
        "--mx": `${tilt.mx}%`,
        "--my": `${tilt.my}%`,
      }}
      data-locked={!unlocked}
    >
      {/* Holographic sheen layer */}
      <div className="trophy-card-holo" aria-hidden />
      {/* Foil border shimmer */}
      <div className="trophy-card-foil" aria-hidden />

      {/* Ribbon: tier + serial */}
      <div className="relative z-10 flex items-center justify-between">
        <div className={`label-mono ${cfg.ribbon} flex items-center gap-0.5 trophy-tier-${rarity}`}>
          {"★".repeat(stars)} <span className="ml-1">{TIER_LABEL[rarity].toUpperCase()}</span>
        </div>
        {serial && (
          <div className={`label-mono ${cfg.ribbon} text-muted-foreground`}>{serial}</div>
        )}
      </div>

      {/* Graphic */}
      <div className="relative z-10 mt-1 flex items-center justify-center">
        <TrophyGraphic
          rarity={rarity}
          icon={icon}
          unlocked={unlocked || preview}
          size={cfg.graphic}
          animated={unlocked}
          popOnMount={popOnMount}
          achievementKey={achievementKey}
        />
      </div>

      {/* Divider */}
      <div className="relative z-10 mt-1 h-px w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />

      {/* Title + lore */}
      <div className="relative z-10 mt-1.5 text-center">
        <p className={`font-display ${cfg.title} leading-tight ${unlocked || preview ? "" : "text-muted-foreground"}`}>
          {unlocked || preview ? title : "? ? ? ?"}
        </p>
        {showLore && (
          <p className={`${cfg.lore} mt-1 text-muted-foreground line-clamp-2 leading-snug`}>
            {unlocked || preview ? description : "Locked. Earn it to reveal."}
          </p>
        )}
      </div>

      {!unlocked && (
        <div className="absolute top-2 right-2 z-20 h-6 w-6 rounded-full bg-background/80 border border-border grid place-items-center">
          <Lock className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      {!unlocked && preview && (
        <div className="trophy-locked-stamp" aria-hidden>LOCKED</div>
      )}
    </div>
  );
}
