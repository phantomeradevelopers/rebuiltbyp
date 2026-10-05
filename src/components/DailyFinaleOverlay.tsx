import { useEffect, useMemo, useState } from "react";
import { playChime } from "@/lib/sound";

// Session-scoped dedupe: fires once per page load when all tasks are done.
let firedThisSession = false;

export function maybeFireDailyFinale(allDone: boolean) {
  if (typeof window === "undefined") return;
  if (!allDone) {
    firedThisSession = false;
    return;
  }
  if (firedThisSession) return;
  firedThisSession = true;
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("rebuilt:daily-finale"));
  }, 150);
}

type Flake = {
  angle: number; // radians
  dist: number; // vmin
  delay: number; // ms
  size: number; // px
  spin: number; // deg
  dur: number; // s
};

function buildFlakes(count: number): Flake[] {
  const flakes: Flake[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const dist = 30 + Math.random() * 40; // 30–70vmin
    flakes.push({
      angle,
      dist,
      delay: Math.random() * 220,
      size: 2 + Math.random() * 4,
      spin: (Math.random() - 0.5) * 1080,
      dur: 2.4 + Math.random() * 1.4,
    });
  }
  return flakes;
}

export function DailyFinaleOverlay() {
  const [open, setOpen] = useState(false);
  const flakes = useMemo(() => buildFlakes(120), []);

  useEffect(() => {
    function onFire() {
      setOpen(true);
      playChime("singing_bowl");
      setTimeout(() => playChime("victory"), 900);
    }
    window.addEventListener("rebuilt:daily-finale", onFire);
    return () => window.removeEventListener("rebuilt:daily-finale", onFire);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 5200);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md finale-fade overflow-hidden"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-live="assertive"
    >
      {/* Ambient warm haze */}
      <div className="absolute inset-0 finale-godrays pointer-events-none opacity-40" />

      {/* Afterglow bath */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="dust-afterglow" />
      </div>

      {/* Gold shockwave rings + flake burst */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-0 h-0">
          <div className="dust-shockwave" />
          <div className="dust-shockwave dust-shockwave-2" />
          {flakes.map((f, i) => {
            const dx = Math.cos(f.angle) * f.dist;
            const dy = Math.sin(f.angle) * f.dist;
            return (
              <span
                key={i}
                className="gold-flake"
                style={{
                  ["--dx" as string]: `${dx}vmin`,
                  ["--dy" as string]: `${dy}vmin`,
                  ["--delay" as string]: `${f.delay}ms`,
                  ["--size" as string]: `${f.size}px`,
                  ["--spin" as string]: `${f.spin}deg`,
                  ["--dur" as string]: `${f.dur}s`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Stamp */}
      <div className="absolute top-[14%] left-1/2 -translate-x-1/2 text-center finale-stamp z-10">
        <p className="label-mono text-gold tracking-[0.4em] text-xs">ASCENDED</p>
        <p className="font-display text-4xl sm:text-7xl text-gold-shimmer mt-2 leading-none drop-shadow-[0_0_30px_rgba(201,168,76,0.8)]">
          LEGENDARY
        </p>
        <p className="mt-3 text-xs text-foreground/70">
          Four for four. The gods have noticed.
        </p>
      </div>

      <button
        onClick={() => setOpen(false)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 h-11 px-8 rounded-full bg-gradient-to-r from-gold via-yellow-300 to-gold text-gold-foreground text-xs font-bold label-mono shadow-[0_0_30px_rgba(201,168,76,0.8)] hover:scale-105 transition-transform z-20"
      >
        Continue
      </button>
    </div>
  );
}
