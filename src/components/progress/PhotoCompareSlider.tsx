import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { haptic } from "@/lib/haptics";

type Photo = { id: string; url: string; logged_at: string };

const SNAP_POINTS = [0, 25, 50, 75, 100];
const SNAP_THRESHOLD = 3;

export function PhotoCompareSlider({ before, after }: { before: Photo; after: Photo }) {
  const pos = useMotionValue(50);
  const [, force] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastEdgeHaptic = useRef<number | null>(null);
  const lastSnap = useRef<number | null>(50);

  const clipWidth = useTransform(pos, (p) => `${p}%`);
  const handleLeft = useTransform(pos, (p) => `${p}%`);

  const setPos = useCallback((next: number, animated = false) => {
    const clamped = Math.min(100, Math.max(0, next));

    // Edge haptic
    if (clamped <= 0.5 || clamped >= 99.5) {
      const edge = clamped <= 0.5 ? 0 : 100;
      if (lastEdgeHaptic.current !== edge) {
        haptic("medium");
        lastEdgeHaptic.current = edge;
      }
    } else {
      lastEdgeHaptic.current = null;
    }

    // Snap-point selection haptic
    const snap = SNAP_POINTS.find((s) => Math.abs(clamped - s) < SNAP_THRESHOLD) ?? null;
    if (snap !== null && snap !== lastSnap.current && snap !== 0 && snap !== 100) {
      haptic("selection");
    }
    lastSnap.current = snap;

    if (animated) {
      animate(pos, clamped, { type: "spring", stiffness: 320, damping: 28 });
    } else {
      pos.set(clamped);
    }
    force((n) => n + 1);
  }, [pos]);

  const fromClientX = useCallback((clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(((clientX - rect.left) / rect.width) * 100);
  }, [setPos]);

  const onDown = (clientX: number) => {
    dragging.current = true;
    haptic("light");
    fromClientX(clientX);
  };
  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    fromClientX(clientX);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    // Snap-to-center release
    const current = pos.get();
    const nearest = SNAP_POINTS.reduce((a, b) =>
      Math.abs(b - current) < Math.abs(a - current) ? b : a
    );
    if (Math.abs(nearest - current) < SNAP_THRESHOLD) {
      setPos(nearest, true);
    }
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-border select-none touch-none bg-[color:var(--bg-sunken)]"
      onMouseDown={(e) => onDown(e.clientX)}
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={(e) => onDown(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onTouchEnd={onUp}
      role="slider"
      aria-label="Compare progress photos"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos.get())}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos(pos.get() - 4, true);
        if (e.key === "ArrowRight") setPos(pos.get() + 4, true);
        if (e.key === "Home") setPos(0, true);
        if (e.key === "End") setPos(100, true);
      }}
    >
      {/* After (background) */}
      <img
        src={after.url}
        alt="After"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Before (clipped) */}
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
        style={{ width: clipWidth }}
      >
        <img
          src={before.url}
          alt="Before"
          className="absolute inset-0 h-full w-auto object-cover pointer-events-none"
          style={{ width: "100vw", maxWidth: "none" }}
          draggable={false}
        />
      </motion.div>

      {/* Captions */}
      <span className="absolute top-2 left-2 label-mono text-[10px] px-2 py-1 rounded-md bg-black/60 text-white">
        Before · {before.logged_at.slice(0, 10)}
      </span>
      <span className="absolute top-2 right-2 label-mono text-[10px] px-2 py-1 rounded-md bg-black/60 text-white">
        After · {after.logged_at.slice(0, 10)}
      </span>

      {/* Divider */}
      <motion.div
        className="absolute top-0 bottom-0 w-px bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none"
        style={{ left: handleLeft }}
      />

      {/* Handle */}
      <motion.div
        className="absolute top-1/2 h-11 w-11 rounded-full bg-gold text-gold-foreground grid place-items-center shadow-lg pointer-events-none"
        style={{
          left: handleLeft,
          x: "-50%",
          y: "-50%",
        }}
        animate={{ scale: dragging.current ? 1.12 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M5 2L1 7l4 5M9 2l4 5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </div>
  );
}
