// Unique 16-bit pixel-art character per achievement.
// Drawn into a 120x120 viewBox, centered. Frames around it come from TrophyGraphic.
// All characters are colored via `palette` so they inherit the trophy's rarity treatment.
//
// Sprites are authored as 20x20 string grids and rendered via `Pix()`.
// Each character maps to a palette slot:
//   . = empty   O = outline   S = skin    A = armor (fg)   H = highlight (rim/light)
//   D = deep shadow           F = flame/accent              E = emblem plate / glow
//   M = metal mid (between A and H)
// Optional path-based overlays (flames, capes, swords, auras) layered on top.

import type React from "react";

export type ArtPalette = {
  fg: string;       // armor / dominant tone
  bg: string;       // emblem plate background
  outline: string;  // line color
  accent: string;   // bright accent (flames, sparks, gems)
  deep: string;     // deep shadow tone
};

type Props = {
  achievementKey: string;
  iconFallback: string | null;
  palette: ArtPalette;
  size: number;
  unlocked: boolean;
};

export function TrophyArt({ achievementKey, palette, size, unlocked, iconFallback }: Props) {
  const p = unlocked ? palette : {
    fg: "#71717a", bg: "#3f3f46", outline: "#18181b", accent: "#a1a1aa", deep: "#27272a",
  };
  const Art = ART_MAP[achievementKey] ?? FALLBACKS[iconFallback ?? ""] ?? GenericHero;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} shapeRendering="crispEdges" style={{ display: "block" }}>
      <Art p={p} />
    </svg>
  );
}

type Art = (props: { p: ArtPalette }) => React.ReactElement;

// ─────────────── pixel DSL ───────────────

const CELL = 4;                // px per cell at 120 viewBox
const COLS = 20;
const OFFX = (120 - COLS * CELL) / 2; // 20
const OFFY = (120 - COLS * CELL) / 2; // 20

function colorFor(ch: string, p: ArtPalette): string | null {
  switch (ch) {
    case ".": case " ": return null;
    case "O": return p.outline;
    case "A": return p.fg;
    case "H": return p.accent;
    case "D": return p.deep;
    case "F": return p.accent;
    case "E": return p.bg;
    case "M": return mix(p.fg, p.accent, 0.5);
    case "S": return "#f5d6b3";              // skin
    case "s": return "#c79a72";              // skin shadow
    case "W": return "#ffffff";              // white
    case "K": return "#0a0612";              // black/shadow
    case "R": return "#ef4444";              // red (banners, blood)
    case "G": return "#22c55e";              // green (laurel, life)
    case "B": return "#3b82f6";              // blue (water/runes)
    case "Y": return "#fde047";              // bright yellow (lightning, gold accents)
    case "P": return "#a855f7";              // purple (magic)
    case "X": return "#fb923c";              // orange (fire)
    default: return null;
  }
}

function mix(a: string, b: string, t: number): string {
  const ah = parseHex(a), bh = parseHex(b);
  if (!ah || !bh) return a;
  const r = Math.round(ah[0] + (bh[0] - ah[0]) * t);
  const g = Math.round(ah[1] + (bh[1] - ah[1]) * t);
  const bl = Math.round(ah[2] + (bh[2] - ah[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseHex(s: string): [number, number, number] | null {
  if (s.startsWith("rgb")) {
    const m = s.match(/\d+/g); if (!m) return null;
    return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])];
  }
  if (!s.startsWith("#")) return null;
  const h = s.slice(1);
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function Pix({ rows, p }: { rows: string[]; p: ArtPalette }) {
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = colorFor(row[x], p);
      if (!c) continue;
      cells.push(
        <rect key={`${x}-${y}`} x={OFFX + x * CELL} y={OFFY + y * CELL} width={CELL} height={CELL} fill={c} />,
      );
    }
  }
  return <g>{cells}</g>;
}

// ─────────────── shared overlays ───────────────

function FlameAura({ p, intensity = 1 }: { p: ArtPalette; intensity?: number }) {
  return (
    <g opacity={0.85 * intensity}>
      <path d="M30 86 Q 24 70 30 56 Q 28 76 38 82 Z" fill={p.accent} />
      <path d="M90 86 Q 96 70 90 56 Q 92 76 82 82 Z" fill={p.accent} />
      <path d="M22 100 Q 12 84 22 70 Q 18 92 30 96 Z" fill="#fb923c" opacity="0.7" />
      <path d="M98 100 Q 108 84 98 70 Q 102 92 90 96 Z" fill="#fb923c" opacity="0.7" />
    </g>
  );
}

function Lightning({ p }: { p: ArtPalette }) {
  return (
    <g>
      <path d="M86 30 L78 56 L88 56 L72 90 L82 64 L72 64 Z" fill="#fde047" stroke={p.outline} strokeWidth="0.8" />
      <path d="M34 30 L26 56 L36 56 L20 90 L30 64 L20 64 Z" fill="#fde047" stroke={p.outline} strokeWidth="0.8" opacity="0.7" />
    </g>
  );
}

function Halo({ p, color }: { p: ArtPalette; color?: string }) {
  return <circle cx="60" cy="30" r="10" fill="none" stroke={color ?? "#fde047"} strokeWidth="2" opacity="0.85" />;
}

function Sparkles({ p, n = 6 }: { p: ArtPalette; n?: number }) {
  const pts = [
    [22, 26], [98, 28], [16, 60], [104, 62], [26, 100], [96, 102],
    [12, 84], [108, 88], [60, 12], [60, 110],
  ].slice(0, n);
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 1} y={y - 3} width="2" height="6" fill={p.accent} />
          <rect x={x - 3} y={y - 1} width="6" height="2" fill={p.accent} />
        </g>
      ))}
    </g>
  );
}

// ─────────────── character library ───────────────
// All rows are 20 chars wide. Build from torso up.

// shared base: front-facing warrior silhouette
const TORCHBEARER: Art = ({ p }) => (
  <g>
    <g opacity="0.9">
      <path d="M58 14 Q52 6 56 2 Q60 8 62 4 Q66 10 62 14 Z" fill="#fde047" />
      <path d="M58 18 Q54 12 58 8 Q62 14 60 18 Z" fill="#fb923c" />
    </g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      ".......OOOO.........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "........OO..........",
      "......OAAAAO........",
      ".....OAHHHHAO.......",
      ".....OAHAAHAO.......",
      ".....OAAAAAAO.......",
      "......OAAAAOO.......",
      "......OAOOAO........",
      "......OA..AO........",
      "......OA..AO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* torch in hand */}
    <rect x="76" y="44" width="3" height="22" fill={p.deep} />
    <path d="M70 44 Q74 32 78 44 Q82 32 86 44 Q82 40 78 38 Q74 40 70 44 Z" fill={p.accent} />
    <path d="M74 42 Q76 36 78 42 Q80 36 82 42 Z" fill="#fde047" />
  </g>
);

const FLAME_KNIGHT: Art = ({ p }) => (
  <g>
    <FlameAura p={p} />
    <Pix p={p} rows={[
      "....................",
      "........FF..........",
      "......OOOOOO........",
      ".....OAAAAAAO.......",
      ".....OASSSSAO.......",
      ".....OAWSSWAO.......",
      ".....OASSSSAO.......",
      "......OAOOAO........",
      "....OAAOOAAAO.......",
      "...OAHHHHHHHHAO.....",
      "...OAHAAAAAAHAO.....",
      "...OAAAAAAAAAO......",
      "....OAFFFFFFAO......",
      "....OAFAAFFAO.......",
      "....OAAAAAAO........",
      "....OA....AO........",
      "....OO....OO........",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* flaming shield */}
    <rect x="22" y="56" width="14" height="20" fill={p.fg} stroke={p.outline} strokeWidth="1.5" rx="3" />
    <path d="M22 56 Q28 50 36 56 L36 60 L22 60 Z" fill={p.accent} opacity="0.7" />
    <circle cx="29" cy="66" r="3" fill={p.accent} />
    {/* sword */}
    <rect x="86" y="46" width="2" height="26" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
    <rect x="82" y="70" width="10" height="2" fill={p.accent} />
  </g>
);

const TWIN_BLADE: Art = ({ p }) => (
  <g>
    <FlameAura p={p} intensity={1.2} />
    <Pix p={p} rows={[
      "....................",
      "......OO...OO.......",
      "......OFOOOFOO......",
      "....OOOAAAAOOOO.....",
      "....OAWWAAAWWAO.....",
      "....OASSSSSSSAO.....",
      ".....OASKKKSAO......",
      "......OASSSAO.......",
      "....OAAOOOOAAO......",
      "...OAHHHHHHHHAO.....",
      "...OAHFAAAAFHAO.....",
      "...OAAAAAAAAAO......",
      "....OAA....AAO......",
      "....OA......AO......",
      "....OO......OO......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* two swords */}
    <g>
      <rect x="14" y="42" width="2" height="40" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
      <rect x="10" y="80" width="10" height="2" fill={p.accent} />
      <path d="M11 42 L19 42 L15 32 Z" fill={p.accent} />
    </g>
    <g>
      <rect x="104" y="42" width="2" height="40" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
      <rect x="100" y="80" width="10" height="2" fill={p.accent} />
      <path d="M101 42 L109 42 L105 32 Z" fill={p.accent} />
    </g>
  </g>
);

const BERSERKER: Art = ({ p }) => (
  <g>
    <FlameAura p={p} intensity={1.3} />
    {/* horns */}
    <path d="M44 30 Q38 18 46 16 Q46 24 48 28 Z" fill={p.outline} />
    <path d="M76 30 Q82 18 74 16 Q74 24 72 28 Z" fill={p.outline} />
    <Pix p={p} rows={[
      "....................",
      "......OOOOOO........",
      ".....OAFFFFFAO......",
      ".....OAFFFFFAO......",
      ".....OASSSSSAO......",
      ".....OASRSRSAO......",
      ".....OASSSSSAO......",
      "......OAOOOAO.......",
      "....OAAHHHHHAAO.....",
      "...OAFHAAAAAHFAO....",
      "...OAFHAAAAAHFAO....",
      "...OAAFFFFFFAAO.....",
      "....OAAFAAFAAO......",
      "....OA.OOOO.AO......",
      "....OO.O..O.OO......",
      ".......O..O.........",
      ".......O..O.........",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* axe */}
    <rect x="92" y="48" width="2" height="32" fill={p.deep} />
    <path d="M86 44 L102 44 L106 56 L82 56 Z" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
    <path d="M86 44 L102 44 L100 50 L88 50 Z" fill={p.accent} opacity="0.6" />
  </g>
);

const FLAME_RIDER: Art = ({ p }) => (
  <g>
    {/* flame mount body */}
    <path d="M20 92 Q40 70 60 78 Q80 70 100 92 Q90 100 80 96 Q70 100 60 96 Q50 100 40 96 Q30 100 20 92 Z"
      fill="#f97316" stroke={p.outline} strokeWidth="1.5" />
    <path d="M30 88 Q40 78 50 84 Q60 78 70 84 Q80 78 90 88" fill="none" stroke="#fde047" strokeWidth="2" />
    {/* mane flames */}
    <path d="M14 86 Q4 78 10 70 Q12 80 22 84 Z" fill={p.accent} />
    <path d="M106 86 Q116 78 110 70 Q108 80 98 84 Z" fill={p.accent} />
    {/* rider */}
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....................",
      "....................",
      "........OOOO........",
      ".......OASSAO.......",
      ".......OSWSWO.......",
      ".......OASSAO........".slice(0, 20),
      "........OOOO........",
      "......OAAAAAO.......",
      ".....OAHHHHHAO......",
      ".....OAHAAAHAO......",
      ".....OAAAAAAAO......",
      "......OAAAAAO.......",
      ".......OOOO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* lance */}
    <rect x="92" y="36" width="2" height="38" fill={p.deep} />
    <path d="M88 36 L96 36 L92 26 Z" fill={p.accent} />
  </g>
);

const PHOENIX_HERO: Art = ({ p }) => (
  <g>
    {/* phoenix wings */}
    <path d="M60 50 Q24 38 8 60 Q22 56 38 66 Q22 70 14 86 Q34 76 50 80 Z"
      fill={p.accent} stroke={p.outline} strokeWidth="1.2" />
    <path d="M60 50 Q96 38 112 60 Q98 56 82 66 Q98 70 106 86 Q86 76 70 80 Z"
      fill={p.accent} stroke={p.outline} strokeWidth="1.2" />
    <path d="M60 50 Q40 46 30 56" fill="none" stroke="#fde047" strokeWidth="1.5" />
    <path d="M60 50 Q80 46 90 56" fill="none" stroke="#fde047" strokeWidth="1.5" />
    <Pix p={p} rows={[
      "....................",
      "........OO..........",
      ".......OFFFO........",
      ".......OSSSO........",
      "......OSWSWSO.......",
      "......OSSSSSO.......",
      ".......OAAAO........",
      "....OAAAAAAAAAO.....",
      "....OAHHHHHHAAO.....",
      "....OAHFFFFHAO......",
      ".....OAFFFFAO.......",
      "......OAAAAAO.......",
      "......OOAAAOO.......",
      "........OOOO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
  </g>
);

const WARLORD: Art = ({ p }) => (
  <g>
    {/* dark aura */}
    <circle cx="60" cy="60" r="46" fill="#7f1d1d" opacity="0.25" />
    {/* horned crown */}
    <path d="M38 22 L42 6 L48 22 Z" fill={p.outline} />
    <path d="M82 22 L78 6 L72 22 Z" fill={p.outline} />
    <path d="M60 18 L56 4 L64 4 Z" fill={p.accent} />
    <Pix p={p} rows={[
      "....................",
      "....................",
      ".....OOOOOOOO.......",
      "....OAFFFFFFAO......",
      "....OAFRRRRFAO......",
      "....OASSSSSSAO......",
      "....OAYRRRRYAO......",
      "....OASKKKKSAO......",
      ".....OAOOOOAO.......",
      "....OAAHHHHHAAO.....",
      "...OAHHFFFFHHAO.....",
      "...OAHFAAAAFHAO.....",
      "...OAAFFFFFFAAO.....",
      "....OAFOOOFAO.......",
      "....OAOO..OOAO......",
      "....OA.O..O.AO......",
      "....OO.O..O.OO......",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* greatsword */}
    <rect x="90" y="20" width="3" height="76" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.8" />
    <path d="M88 96 L96 96 L92 110 Z" fill={p.accent} />
    <rect x="84" y="92" width="14" height="3" fill={p.accent} />
    <path d="M91 20 Q91 6 95 6 Q95 18 91 20 Z" fill="#fde047" />
    {/* sword flames */}
    <path d="M89 30 Q86 22 91 18 Q94 24 91 30 Z" fill={p.accent} opacity="0.8" />
  </g>
);

const VALHALLA: Art = ({ p }) => (
  <g>
    {/* throne */}
    <path d="M16 110 L16 70 Q16 60 24 60 L96 60 Q104 60 104 70 L104 110 Z"
      fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    <path d="M16 70 L8 50 L20 56 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    <path d="M104 70 L112 50 L100 56 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    {/* throne flames */}
    <path d="M14 60 Q8 48 14 38 Q12 52 22 56 Z" fill={p.accent} opacity="0.85" />
    <path d="M106 60 Q112 48 106 38 Q108 52 98 56 Z" fill={p.accent} opacity="0.85" />
    {/* god sprite */}
    <g>
      <Halo p={p} color="#fde047" />
      <Pix p={p} rows={[
        "....................",
        "....................",
        "....................",
        "....................",
        "......OOOOOO........",
        ".....OAYYYYAO.......",
        ".....OASSSSAO.......",
        ".....OASWSWAO.......",
        ".....OASSSSAO.......",
        "......OAOOAO........",
        ".....OAAHHAAO.......",
        "....OAHHFHHAO.......",
        "....OAFFFFFAO.......",
        ".....OAAAAAO........",
        "......OOAAOO........",
        "........OO..........",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
    {/* Mjolnir raised */}
    <rect x="92" y="34" width="2" height="20" fill={p.deep} />
    <rect x="84" y="22" width="18" height="14" fill="#94a3b8" stroke={p.outline} strokeWidth="1.2" />
    <rect x="86" y="24" width="14" height="3" fill="#e2e8f0" />
    {/* lightning */}
    <path d="M82 8 L78 22 L86 22 L80 36 L86 26 L80 26 Z" fill="#fde047" stroke={p.outline} strokeWidth="0.6" />
  </g>
);

// ─────────────── training ───────────────

const ROOKIE: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".......OOOO.........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "......OAAAAO........",
      ".....OAHHHHAO.......",
      ".....OAAAAAAO.......",
      ".....OAAAAAAO.......",
      "......OOAAOO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* dumbbell */}
    <rect x="38" y="58" width="44" height="4" fill={p.deep} />
    <rect x="30" y="52" width="10" height="16" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
    <rect x="80" y="52" width="10" height="16" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
  </g>
);

const GLADIATOR: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".......OOOO.........",
      "......OAAAAO........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      "......OASSAO........",
      ".......OOOO.........",
      "....OAAAAAAAAAO.....",
      "....OAHHHHHHAAO.....",
      "....OAHAAAAHAO......",
      ".....OAAAAAAO.......",
      "......OO..OO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* barbell overhead */}
    <rect x="14" y="20" width="92" height="3" fill={p.deep} />
    <rect x="10" y="14" width="10" height="14" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <rect x="100" y="14" width="10" height="14" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <rect x="22" y="14" width="6" height="14" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <rect x="92" y="14" width="6" height="14" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    {/* arms up */}
    <rect x="36" y="28" width="4" height="20" fill={p.fg} stroke={p.outline} strokeWidth="0.8" />
    <rect x="80" y="28" width="4" height="20" fill={p.fg} stroke={p.outline} strokeWidth="0.8" />
  </g>
);

const CENTURION: Art = ({ p }) => (
  <g>
    {/* plumed helmet crest */}
    <path d="M52 12 Q60 4 68 12 L66 22 L54 22 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    <Pix p={p} rows={[
      "....................",
      "......OOOOOO........",
      ".....OAAAAAAO.......",
      ".....OASSSSAO.......",
      ".....OASWSWAO.......",
      ".....OASSSSAO.......",
      "......OASSAO........",
      ".......OOOO.........",
      "....OAAAAAAAAAO.....",
      "...OAHHHHHHHHAO.....",
      "...OAHRRRRRRHAO.....",
      "...OAHRHHHHRHAO.....",
      "...OAAAAAAAAAO......",
      "....OAFFFFFAO.......",
      "....OAA..AAO........",
      "....OA....AO........",
      "....OO....OO........",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* gladius + scutum */}
    <rect x="14" y="42" width="14" height="32" fill={p.fg} stroke={p.outline} strokeWidth="1.2" rx="2" />
    <path d="M18 50 L24 50 L21 70 Z" fill={p.accent} />
    <rect x="94" y="44" width="2" height="34" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
    <rect x="90" y="76" width="10" height="3" fill={p.accent} />
  </g>
);

const COLOSSUS: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....OOOOOOOOOO......",
      "...OAAFFFFFFAAO.....",
      "...OASSSSSSSSAO.....",
      "...OASKWSSKWSAO.....",
      "...OASSSSSSSSAO.....",
      "....OAOOOOOOAO......",
      "..OAAAHHHHHHAAAO....",
      ".OAHHAAAAAAAAAHHAO..",
      ".OAHAAAHHHHAAAAHAO..",
      ".OAAAAHFFFFHAAAAAO..",
      "..OAAAFFAAFFAAAAO...",
      "...OAAAAOOOOAAAO....",
      "....OAA....AAO......",
      "....OA......AO......",
      "....OA......AO......",
      "....OO......OO......",
      "....................",
      "....................",
    ]} />
    {/* shoulder spikes */}
    <path d="M16 50 L24 56 L22 64 Z" fill={p.outline} />
    <path d="M104 50 L96 56 L98 64 Z" fill={p.outline} />
  </g>
);

const TEMPLE_GUARDIAN: Art = ({ p }) => (
  <g>
    {/* temple pillars behind */}
    <rect x="10" y="20" width="8" height="80" fill={p.deep} opacity="0.7" />
    <rect x="102" y="20" width="8" height="80" fill={p.deep} opacity="0.7" />
    <rect x="6" y="18" width="16" height="4" fill={p.fg} />
    <rect x="98" y="18" width="16" height="4" fill={p.fg} />
    <Pix p={p} rows={[
      "....................",
      "....................",
      "......OOOOOO........",
      ".....OAYYYYAO.......",
      ".....OASSSSAO.......",
      ".....OASWSWAO.......",
      ".....OASSSSAO.......",
      "......OAOOAO........",
      "....OAAHHHHAAO......",
      "...OAHHAAAAHHAO.....",
      "...OAHAAAAAAHAO.....",
      "....OAAAAAAAO.......",
      "....OOA..AOO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* barbell staff */}
    <rect x="58" y="18" width="3" height="90" fill={p.deep} />
    <rect x="50" y="14" width="20" height="10" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <rect x="50" y="98" width="20" height="10" fill={p.fg} stroke={p.outline} strokeWidth="1" />
  </g>
);

const SPRINTER: Art = ({ p }) => (
  <g>
    <Lightning p={p} />
    {/* speed trails */}
    <g opacity="0.7">
      <rect x="6" y="56" width="14" height="2" fill="#fde047" />
      <rect x="4" y="62" width="20" height="2" fill="#fde047" />
      <rect x="8" y="68" width="12" height="2" fill="#fde047" />
    </g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      "........OOOO........",
      ".......OASSAO.......",
      ".......OSWSWO.......",
      ".......OASSAO........".slice(0, 20),
      "........OOOO........",
      "......OAAAAAO.......",
      ".....OAHYYHAO.......",
      ".....OAHAAHAO.......",
      ".....OAAAAAAO.......",
      "....OAA....AO.......",
      "...OA......AAO......",
      "..OA........AO......",
      ".OO..........O......",
      "..............OO....",
      "................OO..",
      "....................",
      "....................",
      "....................",
    ]} />
  </g>
);

// ─────────────── mindset / spirit ───────────────

const MONK_LOTUS: Art = ({ p }) => (
  <g>
    <Halo p={p} color={p.accent} />
    {/* aura */}
    <circle cx="60" cy="60" r="36" fill={p.accent} opacity="0.12" />
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....................",
      "........OOOO........",
      ".......OSSSSO.......",
      ".......OSPSWO.......",
      ".......OSSSSO.......",
      "........OOOO........",
      "......OAAAAAAO......",
      ".....OAHHHHHAO......",
      "....OAAHHHHHAAO.....",
      "....OAAAAAAAAO......",
      "...OA.OOAOOO.AO.....",
      "..OA..A....A..AO....",
      ".OA...A....A...AO...",
      ".OO...O....O...OO...",
      ".......OOOOOO.......",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* lotus petals */}
    <g opacity="0.85">
      <path d="M40 86 Q34 96 44 100" fill="none" stroke={p.accent} strokeWidth="2" />
      <path d="M80 86 Q86 96 76 100" fill="none" stroke={p.accent} strokeWidth="2" />
    </g>
  </g>
);

const SAMURAI: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....OOOOOOOOOO......",
      "...OAARRRRRRAAO.....",
      "...OARRRRRRRRAO.....",
      "....OASSSSSSAO......",
      "....OASKWSKWAO......",
      "....OASSSSSSAO......",
      ".....OAOOOOAO.......",
      "....OAAAAAAAAO......",
      "....OAHHRRHHAO......",
      "....OAHAAAAHAO......",
      "....OAAAAAAAO.......",
      ".....OAOOAO.........",
      ".....OA..AO.........",
      ".....OO..OO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* katana */}
    <rect x="90" y="46" width="2" height="40" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
    <rect x="86" y="84" width="10" height="3" fill={p.deep} />
    <rect x="90" y="40" width="2" height="6" fill={p.accent} />
  </g>
);

const ASTRAL_MONK: Art = ({ p }) => (
  <g>
    {/* chakra orbs */}
    <circle cx="22" cy="40" r="5" fill={p.accent} opacity="0.85" />
    <circle cx="98" cy="40" r="5" fill={p.accent} opacity="0.85" />
    <circle cx="14" cy="78" r="4" fill="#a855f7" opacity="0.85" />
    <circle cx="106" cy="78" r="4" fill="#a855f7" opacity="0.85" />
    <Halo p={p} color={p.accent} />
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....................",
      "........OOOO........",
      ".......OSPPPO.......",
      ".......OSWPWO.......",
      ".......OSSSSO.......",
      "........OOOO........",
      "......OAAAAAAO......",
      ".....OAHHHHHHAO.....",
      ".....OAHAAAAHAO.....",
      ".....OAAPPAAAO......",
      "......OAAAAAO.......",
      ".......OOOO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* hover wisp */}
    <path d="M44 86 Q60 92 76 86" stroke={p.accent} strokeWidth="2" fill="none" opacity="0.7" />
  </g>
);

const MIRROR_MAGE: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "......OOOOOO........",
      ".....OAAAAAAO.......",
      ".....OASSSSAO.......",
      ".....OASWSWAO.......",
      ".....OASSSSAO.......",
      "......OAOOAO........",
      "....OAAAAAAAAO......",
      "....OAHHHHHHAO......",
      "....OAHAAAAHAO......",
      "....OAAAAAAAO.......",
      ".....OAOOAO.........",
      ".....OA..AO.........",
      ".....OO..OO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* mirror in hand */}
    <ellipse cx="90" cy="58" rx="10" ry="14" fill={p.bg} stroke={p.outline} strokeWidth="1.5" />
    <ellipse cx="87" cy="54" rx="3" ry="6" fill="#ffffff" opacity="0.6" />
    <rect x="88" y="72" width="4" height="14" fill={p.deep} />
  </g>
);

// ─────────────── nutrition / weight ───────────────

const CHEF: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".....OOOOOOOO.......",
      "....OWWWWWWWWO......",
      "....OWWWWWWWWO......",
      ".....OWWWWWWO.......",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      "......OASSAO........",
      ".....OWWWWWWO.......",
      "....OWWWWWWWWO......",
      "....OWWWWWWWWO......",
      "....OWWWWWWWWO......",
      "....OO......OO......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* plate */}
    <ellipse cx="60" cy="100" rx="32" ry="6" fill={p.bg} stroke={p.outline} strokeWidth="1.5" />
    <ellipse cx="60" cy="98" rx="20" ry="3" fill={p.accent} opacity="0.6" />
  </g>
);

const MASTER_CHEF: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....OOOOOOOOOOOO....",
      "...OWWWWWWWWWWWWO...",
      "...OWWWWWWWWWWWWO...",
      "....OWWWWWWWWWWO....",
      "......OSSSSSSO......",
      "......OSWSSWO.......".slice(0, 20),
      "......OSSSSSO.......".slice(0, 20),
      "......OASSSAO.......".slice(0, 20),
      ".....OWWWWWWWO......",
      "....OWWWWWWWWWO.....",
      "....OWWWWWWWWWO.....",
      "....OO........OO....",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* cleaver */}
    <rect x="14" y="58" width="22" height="14" fill="#e2e8f0" stroke={p.outline} strokeWidth="1.2" />
    <rect x="36" y="62" width="14" height="6" fill={p.deep} />
    {/* plate */}
    <ellipse cx="60" cy="100" rx="38" ry="7" fill={p.bg} stroke={p.outline} strokeWidth="1.5" />
    <circle cx="50" cy="98" r="4" fill={p.accent} />
    <circle cx="62" cy="98" r="4" fill="#22c55e" />
    <circle cx="74" cy="98" r="4" fill={p.accent} />
  </g>
);

const ARCHER: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      ".......OOOO.........",
      "......OAAAAO........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "....OAAAAAAAAAO.....",
      "...OAHHHHHHHHAO.....",
      "...OAHAAAAAAHAO.....",
      "....OAAAAAAAO.......",
      "....OAA..AAO........",
      "....OA....AO........",
      "....OO....OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* bow */}
    <path d="M22 28 Q12 60 22 92" fill="none" stroke={p.fg} strokeWidth="3" />
    <line x1="22" y1="28" x2="22" y2="92" stroke={p.deep} strokeWidth="1" />
    {/* arrow */}
    <line x1="22" y1="60" x2="92" y2="60" stroke={p.outline} strokeWidth="1.5" />
    <path d="M92 60 L86 56 L86 64 Z" fill={p.accent} />
    {/* target */}
    <circle cx="104" cy="60" r="6" fill="#ffffff" stroke={p.outline} strokeWidth="1" />
    <circle cx="104" cy="60" r="3" fill="#ef4444" />
  </g>
);

const SNIPER_ARCHER: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      "......OOOOOOOO......",
      ".....OAAAAAAAAO.....",
      ".....OASSSSSSAO.....",
      ".....OASWKKWSAO.....",
      ".....OASSSSSSAO.....",
      "......OASSSAO.......",
      "....OAAAAAAAAAO.....",
      "...OAHHHHHHHHAO.....",
      "...OAHAAAAAAHAO.....",
      "....OAAAAAAAO.......",
      "....OAA..AAO........",
      "....OA....AO........",
      "....OO....OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* bow + reticle */}
    <path d="M16 16 Q6 60 16 104" fill="none" stroke={p.fg} strokeWidth="3" />
    <line x1="16" y1="16" x2="16" y2="104" stroke={p.deep} strokeWidth="1" />
    <line x1="16" y1="60" x2="100" y2="60" stroke={p.outline} strokeWidth="1" />
    <circle cx="100" cy="60" r="10" fill="none" stroke={p.accent} strokeWidth="1.5" />
    <line x1="92" y1="60" x2="108" y2="60" stroke={p.accent} strokeWidth="1" />
    <line x1="100" y1="52" x2="100" y2="68" stroke={p.accent} strokeWidth="1" />
    <circle cx="100" cy="60" r="2" fill="#ef4444" />
  </g>
);

const GIGACHAD: Art = ({ p }) => (
  <g>
    {/* golden aura */}
    <circle cx="60" cy="60" r="44" fill="#fde047" opacity="0.18" />
    <Sparkles p={{ ...p, accent: "#fde047" }} n={6} />
    <Pix p={p} rows={[
      "....................",
      "......OOOOOO........",
      ".....OASSSSSAO......",
      ".....OASSSSSAO......",
      ".....OASKWKSAO......",
      "......OASSSAO.......",
      "......OAAAAAO.......",
      ".......OOOO.........",
      "...OAAAAAAAAAAO.....",
      "..OAHHHHHHHHHHAO....",
      ".OAHHAAAAAAAAHHAO...",
      ".OAHAAAAAAAAAAHAO...",
      ".OAAAAAAAAAAAAAO....",
      "..OAAAAAAAAAAAO.....",
      "...OAA......AAO.....",
      "...OA........AO.....",
      "...OO........OO.....",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* jawline glint */}
    <rect x="56" y="34" width="3" height="3" fill="#ffffff" />
  </g>
);

// ─────────────── streaks helpers / weekly / weight ───────────────

const SCRIBE: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".......OOOO.........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "......OAAAAAO.......",
      ".....OAHHHHHAO......",
      ".....OAAAAAAAO......",
      "......OOAAOO........",
      "........OO..........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* scroll */}
    <rect x="18" y="74" width="84" height="22" fill={p.bg} stroke={p.outline} strokeWidth="1.5" />
    <circle cx="18" cy="85" r="6" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <circle cx="102" cy="85" r="6" fill={p.fg} stroke={p.outline} strokeWidth="1" />
    <line x1="28" y1="82" x2="92" y2="82" stroke={p.outline} strokeWidth="0.8" />
    <line x1="28" y1="88" x2="80" y2="88" stroke={p.outline} strokeWidth="0.8" />
    {/* quill */}
    <line x1="78" y1="40" x2="92" y2="20" stroke={p.outline} strokeWidth="1.5" />
    <path d="M92 20 L96 16 L90 24 Z" fill={p.accent} />
  </g>
);

const JUDGE: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....OOOOOOOOOO......",
      "...OAAAAAAAAAAO.....",
      "....OASSSSSSAO......",
      "....OASWSSWSAO......",
      "....OASSSSSSAO......",
      ".....OASSSSAO.......",
      "......OAOOAO........",
      "....OAAAAAAAAO......",
      "....OAHHHHHHAO......",
      "....OAAAAAAAAO......",
      ".....OA....AO.......",
      ".....OO....OO.......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* gavel */}
    <rect x="80" y="40" width="22" height="12" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
    <rect x="88" y="52" width="4" height="22" fill={p.deep} />
    {/* base */}
    <rect x="30" y="92" width="60" height="6" fill={p.deep} stroke={p.outline} strokeWidth="1" />
  </g>
);

const CLIMBER: Art = ({ p }) => (
  <g>
    {/* mountain */}
    <path d="M10 110 L40 50 L60 80 L80 40 L110 110 Z" fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    <path d="M40 50 L46 60 L52 56 L60 80" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
    {/* climber */}
    <g transform="translate(38,42)">
      <Pix p={p} rows={[
        "....................",
        "...OSSO.............",
        "...OSWO.............",
        "...OAAO.............",
        "..OAAAAO............",
        "...OAAOO............",
        "...OA.O.............",
        "...OOOO.............",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
    {/* rope */}
    <path d="M48 50 Q40 30 60 20" fill="none" stroke={p.accent} strokeWidth="2" />
  </g>
);

const SUMMIT: Art = ({ p }) => (
  <g>
    {/* mountain */}
    <path d="M6 112 L60 16 L114 112 Z" fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    <path d="M40 60 L60 32 L80 60 L70 60 L60 46 L50 60 Z" fill="#ffffff" opacity="0.85" />
    {/* flag */}
    <rect x="58" y="14" width="2" height="40" fill={p.outline} />
    <path d="M60 16 L84 22 L60 30 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    {/* person */}
    <g transform="translate(52,36)">
      <Pix p={p} rows={[
        "....................",
        "..OSSO..............",
        "..OSWO..............",
        "..OAAO..............",
        ".OAAAAO.............",
        "..OA.AO.............",
        "..OO.OO.............",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
  </g>
);

// ─────────────── time of day / hidden / comeback ───────────────

const OWL_MAGE: Art = ({ p }) => (
  <g>
    {/* crescent moon */}
    <path d="M96 24 A14 14 0 1 0 96 52 A10 10 0 1 1 96 24" fill="#fde047" opacity="0.85" />
    {/* cloak hood */}
    <path d="M30 50 Q60 18 90 50 L86 80 L34 80 Z" fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....................",
      "....................",
      "........OOOO........",
      ".......OFFFFO.......",
      ".......OWKKWO.......",
      ".......OYKYKO........".slice(0, 20),
      "........OOOO........",
      "......OAAAAAO.......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* wings */}
    <path d="M30 70 Q14 86 30 100" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
    <path d="M90 70 Q106 86 90 100" fill={p.fg} stroke={p.outline} strokeWidth="1.2" />
    {/* stars */}
    <Sparkles p={{ ...p, accent: "#fde047" }} n={4} />
  </g>
);

const DAWN_ARCHER: Art = ({ p }) => (
  <g>
    {/* sunrise */}
    <circle cx="60" cy="96" r="32" fill="#fde047" opacity="0.5" />
    <rect x="0" y="96" width="120" height="24" fill={p.deep} opacity="0.4" />
    <g opacity="0.85">
      <line x1="60" y1="60" x2="60" y2="50" stroke="#fde047" strokeWidth="2" />
      <line x1="40" y1="70" x2="32" y2="62" stroke="#fde047" strokeWidth="2" />
      <line x1="80" y1="70" x2="88" y2="62" stroke="#fde047" strokeWidth="2" />
    </g>
    <ArcherSilhouette p={p} />
  </g>
);

const ArcherSilhouette: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "....................",
      ".......OO...........",
      "......OAAO..........",
      "......OAAO..........",
      ".....OAAAAO.........",
      "....OAAAAAAO........",
      "...OAA....AAO.......",
      "...OA......AO.......",
      "...OO......OO.......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    <path d="M30 28 Q20 56 30 84" fill="none" stroke={p.outline} strokeWidth="2" />
    <line x1="30" y1="56" x2="98" y2="56" stroke={p.outline} strokeWidth="1.5" />
    <path d="M98 56 L92 52 L92 60 Z" fill={p.accent} />
  </g>
);

const COMEBACK: Art = ({ p }) => (
  <g>
    {/* sword in ground */}
    <rect x="22" y="60" width="3" height="38" fill="#e2e8f0" stroke={p.outline} strokeWidth="0.6" />
    <rect x="16" y="56" width="15" height="3" fill={p.accent} />
    <rect x="22" y="52" width="3" height="6" fill={p.deep} />
    <ellipse cx="24" cy="100" rx="14" ry="3" fill={p.outline} opacity="0.4" />
    {/* rising knight (right side) */}
    <Pix p={p} rows={[
      "....................",
      "....................",
      "....................",
      "..........OOOO......",
      ".........OAAAAO.....",
      ".........OSSSSO.....",
      ".........OSWSWO.....",
      ".........OSSSSO.....",
      "..........OOOO......",
      ".......OAAAAAAAO....",
      "......OAHHHHHHAO....",
      "......OAAAAAAAO.....",
      ".......OAA..AO......",
      "........OA..AO......",
      "........OO..OO......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* sun rays of return */}
    <g opacity="0.6">
      <line x1="60" y1="14" x2="60" y2="6" stroke={p.accent} strokeWidth="2" />
      <line x1="40" y1="20" x2="34" y2="14" stroke={p.accent} strokeWidth="2" />
      <line x1="80" y1="20" x2="86" y2="14" stroke={p.accent} strokeWidth="2" />
    </g>
  </g>
);

// ─────────────── anchors ───────────────

const SAILOR: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".....OWWWWWWWO......",
      "....OWWWWWWWWWO.....",
      ".....OWWWWWWWO......",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      ".....OAAAAAAO.......",
      "....OAHHHHHHAO......",
      "....OAAAAAAAO.......",
      ".....OOA..AOO.......",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* anchor */}
    <g>
      <circle cx="92" cy="60" r="4" fill={p.fg} stroke={p.outline} strokeWidth="1" />
      <rect x="91" y="64" width="2" height="22" fill={p.fg} stroke={p.outline} strokeWidth="0.6" />
      <path d="M80 80 Q92 96 104 80" fill="none" stroke={p.fg} strokeWidth="3" />
      <rect x="84" y="68" width="16" height="2" fill={p.fg} />
    </g>
  </g>
);

const CAPTAIN: Art = ({ p }) => (
  <g>
    {/* hat */}
    <path d="M40 30 L80 30 L72 18 L48 18 Z" fill={p.outline} />
    <Pix p={p} rows={[
      "....................",
      "....................",
      "......OOOOOO........",
      "......OWWWWWO.......",
      ".......OSSSSO.......",
      ".......OSWSWO.......",
      ".......OSSSSO.......",
      "........OOOO........",
      "....OAAAAAAAAO......",
      "....OAYYYYYYAO......",
      "....OAYAAAAYAO......",
      "....OAAAAAAAO.......",
      "....OAA..AAO........",
      ".....OA..AO.........",
      ".....OO..OO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* helm wheel */}
    <circle cx="92" cy="74" r="14" fill="none" stroke={p.fg} strokeWidth="2" />
    <g stroke={p.fg} strokeWidth="2">
      <line x1="92" y1="60" x2="92" y2="88" />
      <line x1="78" y1="74" x2="106" y2="74" />
      <line x1="82" y1="64" x2="102" y2="84" />
      <line x1="102" y1="64" x2="82" y2="84" />
    </g>
    <circle cx="92" cy="74" r="3" fill={p.accent} />
  </g>
);

const LIGHTHOUSE: Art = ({ p }) => (
  <g>
    {/* lighthouse */}
    <rect x="50" y="34" width="20" height="60" fill={p.fg} stroke={p.outline} strokeWidth="1.5" />
    <rect x="50" y="44" width="20" height="6" fill="#ef4444" />
    <rect x="50" y="64" width="20" height="6" fill="#ef4444" />
    <path d="M46 34 L74 34 L70 22 L50 22 Z" fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    <rect x="54" y="22" width="12" height="8" fill="#fde047" stroke={p.outline} strokeWidth="1" />
    {/* light beams */}
    <path d="M60 26 L30 12 L30 22 Z" fill="#fde047" opacity="0.5" />
    <path d="M60 26 L90 12 L90 22 Z" fill="#fde047" opacity="0.5" />
    {/* base / rocks */}
    <path d="M30 110 L40 94 L50 100 L60 92 L70 100 L80 94 L90 110 Z" fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    {/* waves */}
    <path d="M10 112 Q20 108 30 112 T 50 112 T 70 112 T 90 112 T 110 112" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.7" />
  </g>
);

// ─────────────── referrals ───────────────

function MiniHero({ x, p, color }: { x: number; p: ArtPalette; color?: string }) {
  const c = color ?? p.fg;
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0" y="0" width="8" height="8" fill={p.outline} />
      <rect x="1" y="1" width="6" height="6" fill="#f5d6b3" />
      <rect x="0" y="9" width="8" height="14" fill={c} stroke={p.outline} strokeWidth="0.6" />
      <rect x="0" y="23" width="3" height="6" fill={p.outline} />
      <rect x="5" y="23" width="3" height="6" fill={p.outline} />
    </g>
  );
}

const BANNER: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".......OOOO.........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "......OAAAAO........",
      ".....OAHHHHAO.......",
      ".....OAAAAAAO.......",
      "......OA..AO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* banner pole */}
    <rect x="86" y="22" width="2" height="80" fill={p.deep} />
    <path d="M88 24 L112 28 L108 44 L88 40 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    <circle cx="100" cy="34" r="3" fill={p.bg} />
  </g>
);

const SQUAD_3: Art = ({ p }) => (
  <g transform="translate(36,48)">
    <MiniHero x={0} p={p} />
    <MiniHero x={20} p={p} color={p.accent} />
    <MiniHero x={40} p={p} />
  </g>
);

const SQUAD_5: Art = ({ p }) => (
  <g>
    <g transform="translate(20,42)">
      <MiniHero x={0} p={p} />
      <MiniHero x={20} p={p} color={p.accent} />
      <MiniHero x={40} p={p} />
      <MiniHero x={60} p={p} color={p.accent} />
      <MiniHero x={80} p={p} />
    </g>
  </g>
);

const COMMANDER: Art = ({ p }) => (
  <g>
    {/* horn */}
    <path d="M84 56 Q104 50 108 64 Q98 66 92 72 Z" fill={p.accent} stroke={p.outline} strokeWidth="1.2" />
    <Pix p={p} rows={[
      "....................",
      ".....OOOOOO.........",
      "....OAFFFFAO........",
      "....OASSSSAO........",
      "....OASWSWAO........",
      "....OASSSSAO........",
      ".....OAOOAO.........",
      "...OAAAAAAAO........",
      "...OAHHHHHAO........",
      "...OAAAAAAO.........",
      "....OA..AO..........",
      "....OO..OO..........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* mini squad below */}
    <g transform="translate(20,82)">
      <MiniHero x={0} p={p} />
      <MiniHero x={14} p={p} />
      <MiniHero x={28} p={p} />
      <MiniHero x={56} p={p} />
      <MiniHero x={70} p={p} />
    </g>
  </g>
);

const GENERAL_HORSE: Art = ({ p }) => (
  <g>
    {/* horse */}
    <path d="M16 96 L24 70 Q36 60 60 64 Q80 60 96 70 L100 96 L90 96 L86 80 L74 78 L74 96 L66 96 L66 78 L54 78 L54 96 L44 96 L40 78 L30 78 L26 96 Z"
      fill={p.deep} stroke={p.outline} strokeWidth="1.5" />
    {/* mane */}
    <path d="M86 62 L96 58 L92 72" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    <circle cx="98" cy="68" r="2" fill={p.outline} />
    {/* general */}
    <g transform="translate(0,-12)">
      <Pix p={p} rows={[
        "....................",
        "......OOOOOO........",
        ".....OAYYYYAO.......",
        ".....OASSSSAO.......",
        ".....OASWSWAO.......",
        ".....OASSSSAO.......",
        "......OAOOAO........",
        "....OAAHHHHAAO......",
        "....OAHAAAAHAO......",
        "....OAAAAAAAO.......",
        "....OO....OO........",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
  </g>
);

const KING_CROWN: Art = ({ p }) => (
  <g>
    {/* throne hint */}
    <rect x="14" y="98" width="92" height="6" fill={p.deep} />
    {/* successor (left) */}
    <g transform="translate(-6,8)">
      <Pix p={p} rows={[
        "....................",
        "....................",
        ".......OOOO.........",
        "......OSSSSO........",
        "......OSWSWO........",
        "......OSSSSO........",
        ".......OOOO.........",
        "......OAAAAO........",
        ".....OAHHHHAO.......",
        ".....OAAAAAAO.......",
        "......OO..OO........",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
    {/* king (right) */}
    <g transform="translate(28,8)">
      <Pix p={p} rows={[
        "....................",
        "......OYOYOYO.......",
        ".....OYYYYYYYO......",
        "......OOOOOO........",
        ".....OAAAAAAO.......",
        ".....OASSSSAO.......",
        ".....OASWSWAO.......",
        ".....OASSSSAO.......",
        "......OAOOAO........",
        "....OAAAAAAAAO......",
        "....OAHHHHHHAO......",
        "....OAAAAAAAO.......",
        "....OO....OO........",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ]} />
    </g>
    {/* floating crown handed over */}
    <g transform="translate(34,8)">
      <path d="M0 0 L4 -6 L8 0 L12 -6 L16 0 L16 4 L0 4 Z" fill={p.accent} stroke={p.outline} strokeWidth="1" />
    </g>
  </g>
);

// ─────────────── extras (vacation/back at it/streak saves) ───────────────

const TRAVELER: Art = ({ p }) => (
  <g>
    {/* sun + palm hint */}
    <circle cx="96" cy="24" r="8" fill="#fde047" opacity="0.85" />
    <path d="M14 100 Q40 80 70 100" stroke={p.deep} strokeWidth="2" fill="none" />
    <Pix p={p} rows={[
      "....................",
      "....................",
      ".....OWWWWWWWO......",
      "....OWWWWWWWWWO.....",
      ".....OWWWWWWWO......",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "....OAAAAAAAAO......",
      "....OABBBBBBAO......",
      "....OABAAAABAO......",
      "....OAAAAAAAO.......",
      ".....OO..OO.........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* suitcase */}
    <rect x="86" y="60" width="18" height="14" fill={p.fg} stroke={p.outline} strokeWidth="1.2" rx="2" />
    <rect x="92" y="56" width="6" height="4" fill={p.deep} />
  </g>
);

const SHIELD_BEARER: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      "......OOOOOO........",
      ".....OAAAAAAO.......",
      ".....OASSSSAO.......",
      ".....OASWSWAO.......",
      ".....OASSSSAO.......",
      "......OAOOAO........",
      "....OAAAAAAAAO......",
      "....OAHHHHHHAO......",
      "....OAAAAAAAO.......",
      "....OOA..AOO........",
      "......OO..OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
    {/* big shield */}
    <path d="M82 36 L106 36 L106 76 Q106 90 94 96 Q82 90 82 76 Z"
      fill={p.fg} stroke={p.outline} strokeWidth="1.5" />
    <path d="M86 40 L102 40 L102 72 Q102 84 94 90 Q86 84 86 72 Z" fill={p.accent} opacity="0.4" />
    <circle cx="94" cy="60" r="4" fill={p.accent} />
  </g>
);

// ─────────────── fallback ───────────────

const GenericHero: Art = ({ p }) => (
  <g>
    <Pix p={p} rows={[
      "....................",
      ".......OOOO.........",
      "......OSSSSO........",
      "......OSWSWO........",
      "......OSSSSO........",
      ".......OOOO.........",
      "....OAAAAAAAAO......",
      "....OAHHHHHHAO......",
      "....OAAAAAAAO.......",
      "....OA....AO........",
      "....OO....OO........",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ]} />
  </g>
);

// ─────────────── map ───────────────

const ART_MAP: Record<string, Art> = {
  // streaks — ladder of warriors
  streak_3: TORCHBEARER,
  streak_7: FLAME_KNIGHT,
  streak_14: TWIN_BLADE,
  streak_30: BERSERKER,
  streak_60: FLAME_RIDER,
  streak_100: PHOENIX_HERO,
  streak_200: WARLORD,
  streak_365: VALHALLA,
  warlord: WARLORD,
  valhalla_bound: VALHALLA,

  // training
  workouts_10: ROOKIE,
  workouts_50: GLADIATOR,
  workouts_100: CENTURION,
  workouts_250: COLOSSUS,
  workouts_500: COLOSSUS,
  iron_temple: TEMPLE_GUARDIAN,
  lambo_legs: SPRINTER,

  // mindset / spirit
  mindset_streak_7: MONK_LOTUS,
  mindset_streak_30: MONK_LOTUS,
  mindset_25: SAMURAI,
  mindset_100: ASTRAL_MONK,
  checkin_streak_7: MIRROR_MAGE,
  anchor_first: SAILOR,
  anchor_streak_7: CAPTAIN,
  anchor_count_30: LIGHTHOUSE,

  // nutrition
  meals_100: CHEF,
  meals_500: MASTER_CHEF,
  macro_hit_1: ARCHER,
  macro_hit_30: SNIPER_ARCHER,
  gigachad_protocol: GIGACHAD,

  // weekly + weight
  weekly_1: SCRIBE,
  weekly_12: JUDGE,
  weight_50: CLIMBER,
  weight_100: SUMMIT,

  // hidden / time of day
  night_owl: OWL_MAGE,
  early_bird: DAWN_ARCHER,

  // comeback / resilience
  comeback: COMEBACK,
  vacation_planner: TRAVELER,
  back_at_it: COMEBACK,
  streak_saver: SHIELD_BEARER,
  streak_guardian: SHIELD_BEARER,

  // referrals
  referrals_1: BANNER,
  first_convert: BANNER,
  referrals_3: SQUAD_3,
  squad_forming: SQUAD_3,
  referrals_5: SQUAD_5,
  movement: SQUAD_5,
  referrals_10: COMMANDER,
  recruiter: COMMANDER,
  referrals_25: GENERAL_HORSE,
  force_multiplier: GENERAL_HORSE,
  referrals_50: KING_CROWN,
  legacy_builder: KING_CROWN,
};

// icon-name fallbacks (used when achievement key doesn't match but icon name exists)
const FALLBACKS: Record<string, Art> = {
  flame: TORCHBEARER,
  brain: MONK_LOTUS,
  heart: MIRROR_MAGE,
  dumbbell: ROOKIE,
  utensils: CHEF,
  target: ARCHER,
  trophy: GIGACHAD,
  moon: OWL_MAGE,
  sunrise: DAWN_ARCHER,
  rotate: COMEBACK,
  crown: KING_CROWN,
  swords: TWIN_BLADE,
  rocket: SPRINTER,
};
