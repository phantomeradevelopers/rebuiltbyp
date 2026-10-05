import { useEffect, useState } from "react";
import { Flame, Brain, Heart, Dumbbell, Utensils, Camera, Target, Gauge, Trophy, Moon, Sunrise, RotateCw, Crown, Lock, Award, Star, Swords, Rocket } from "lucide-react";
import type { Rarity } from "@/lib/achievements.functions";
import { TrophyArt, type ArtPalette } from "./TrophyArt";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  flame: Flame, brain: Brain, heart: Heart, dumbbell: Dumbbell, utensils: Utensils,
  camera: Camera, target: Target, gauge: Gauge, trophy: Trophy, moon: Moon,
  sunrise: Sunrise, rotate: RotateCw, crown: Crown, swords: Swords, rocket: Rocket,
};

type Size = "sm" | "md" | "lg";
const SIZE_PX: Record<Size, number> = { sm: 72, md: 120, lg: 200 };

type Theme = {
  c1: string;
  c2: string;
  outline: string;
  glow: string;
  star: string;
  emblemBg: string;
  emblemFg: string;
};

// Men's track: classic gold ladder.
const THEMES_MEN: Record<Rarity, Theme> = {
  bronze:   { c1: "#fbbf6b", c2: "#7a3a07", outline: "#2a1303", glow: "rgba(217,119,6,0.55)",  star: "#fde047", emblemBg: "#fff7e6", emblemFg: "#3a1d05" },
  silver:   { c1: "#f1f5f9", c2: "#475569", outline: "#0f172a", glow: "rgba(148,163,184,0.55)", star: "#e2e8f0", emblemBg: "#f8fafc", emblemFg: "#0f172a" },
  gold:     { c1: "#fff1a8", c2: "#a05a05", outline: "#2a1505", glow: "rgba(234,179,8,0.65)",  star: "#fde047", emblemBg: "#fff7d6", emblemFg: "#2a1505" },
  platinum: { c1: "#bef0ff", c2: "#7c3aed", outline: "#0f172a", glow: "rgba(217,70,239,0.7)",  star: "#f0abfc", emblemBg: "#ecfeff", emblemFg: "#0f172a" },
  mythic:   { c1: "#fde68a", c2: "#7f1d1d", outline: "#0a0000", glow: "rgba(220,38,38,0.85)",  star: "#fbbf24", emblemBg: "#1a0606", emblemFg: "#fde68a" },
};

// Angels track: rose-gold / champagne where gold means "earned".
// Bronze warms into champagne; silver + platinum + mythic keep their distinct
// high-tier palettes so the ladder still reads at a glance.
const THEMES_ANGELS: Record<Rarity, Theme> = {
  bronze:   { c1: "#f2d3c5", c2: "#8b5a44", outline: "#2a140a", glow: "rgba(201,140,120,0.55)", star: "#f5deda", emblemBg: "#fff2ec", emblemFg: "#3a1d10" },
  silver:   THEMES_MEN.silver,
  gold:     { c1: "#f5d1cb", c2: "#8b5049", outline: "#2a1010", glow: "rgba(217,150,141,0.65)", star: "#f0c9c2", emblemBg: "#fff2ee", emblemFg: "#2a1010" },
  platinum: THEMES_MEN.platinum,
  mythic:   THEMES_MEN.mythic,
};

function useCurrentTrack(): "men" | "angels" {
  const read = () =>
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-track") === "angels"
      ? "angels"
      : "men";
  const [track, setTrack] = useState<"men" | "angels">(read);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setTrack(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-track"] });
    return () => obs.disconnect();
  }, []);
  return track;
}

export function TrophyGraphic({
  rarity, icon, unlocked, size = "sm", animated = true, popOnMount = false, achievementKey,
}: {
  rarity: Rarity;
  icon: string | null;
  unlocked: boolean;
  size?: Size;
  animated?: boolean;
  popOnMount?: boolean;
  achievementKey?: string;
}) {
  const px = SIZE_PX[size];
  const track = useCurrentTrack();
  const t = (track === "angels" ? THEMES_ANGELS : THEMES_MEN)[rarity];
  const Emblem = (icon && ICON_MAP[icon]) || Award;
  const spriteSize = Math.round(px * 0.85);
  const palette: ArtPalette = { fg: t.c1, bg: t.emblemBg, outline: t.outline, accent: t.c2, deep: t.emblemFg };

  const wrapClass = [
    "relative inline-block trophy-hoverable",
    popOnMount ? "trophy-unlock" : "",
  ].filter(Boolean).join(" ");

  const bodyClass = [
    "trophy-body relative grid place-items-center",
    animated && unlocked && !popOnMount ? "trophy-idle" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapClass} style={{ width: px, height: px }} aria-hidden>
      {/* Glow halo */}
      {unlocked && (
        <div
          className={animated ? "trophy-glow absolute inset-0 rounded-full" : "absolute inset-0 rounded-full"}
          style={{
            background: `radial-gradient(circle at 50% 50%, ${t.glow} 0%, transparent 65%)`,
            filter: "blur(6px)",
          }}
        />
      )}

      {/* Sparkles */}
      {unlocked && animated && (
        <>
          <Star className="trophy-sparkle-1 absolute" style={{ top: `${px * 0.04}px`, right: `${px * 0.02}px`, width: px * 0.14, height: px * 0.14, color: t.star, fill: t.star }} />
          <Star className="trophy-sparkle-2 absolute" style={{ top: `${px * 0.34}px`, left: `${px * 0.0}px`, width: px * 0.1, height: px * 0.1, color: t.star, fill: t.star }} />
          <Star className="trophy-sparkle-3 absolute" style={{ bottom: `${px * 0.06}px`, right: `${px * 0.04}px`, width: px * 0.09, height: px * 0.09, color: t.star, fill: t.star }} />
        </>
      )}

      <div className={bodyClass} style={{ width: px, height: px }}>
        {achievementKey ? (
          <TrophyArt
            achievementKey={achievementKey}
            iconFallback={icon}
            palette={palette}
            size={spriteSize}
            unlocked={unlocked}
          />
        ) : (
          <Emblem
            className={unlocked ? "" : "opacity-50"}
            style={{ width: spriteSize * 0.6, height: spriteSize * 0.6, color: unlocked ? t.emblemFg : "#a1a1aa" }}
          />
        )}

        {/* Lock overlay */}
        {!unlocked && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="lock-pulse h-9 w-9 rounded-full bg-background/80 border border-border grid place-items-center">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Unlock burst sparkles */}
      {popOnMount && unlocked && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => {
            const angle = (i * 36 * Math.PI) / 180;
            const dist = px * 0.6;
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            return (
              <Star
                key={i}
                className="trophy-burst absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  width: px * 0.12,
                  height: px * 0.12,
                  marginTop: -px * 0.06,
                  marginLeft: -px * 0.06,
                  color: t.star,
                  fill: t.star,
                  // @ts-expect-error CSS custom properties
                  "--bx": `${bx}px`,
                  "--by": `${by}px`,
                  animationDelay: `${300 + i * 40}ms`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
