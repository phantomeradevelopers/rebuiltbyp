import { useRef, useState } from "react";
import { useTimeFormat } from "@/lib/time-format";

/**
 * Horizontal time scrubber, snapped to 15-min increments.
 * Same look/feel as the intake check-in time picker.
 *
 * Value: "HH:mm" string (24h). Display honors the user's 12/24h preference.
 */
export function TimeDial({
  value,
  onChange,
  ariaLabel = "Time",
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const isSet = !!value;

  const parse = (v: string): number => {
    const [h, m] = (v || "06:00").split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return 6 * 60;
    return Math.min(24 * 60 - 5, Math.max(0, h * 60 + m));
  };
  const format = (mins: number): string => {
    const snapped = Math.round(mins / 15) * 15;
    const clamped = Math.min(24 * 60 - 5, Math.max(0, snapped));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const totalMins = isSet ? parse(value!) : 0;
  const pct = (totalMins / (24 * 60 - 5)) * 100;
  const { format: formatDisplay } = useTimeFormat();
  const label = isSet ? formatDisplay(value!, "") : "";

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(format(ratio * (24 * 60 - 5)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 60 : 15;
    const base = isSet ? totalMins : 6 * 60;
    if (e.key === "ArrowLeft") { e.preventDefault(); onChange(format(base - step)); }
    if (e.key === "ArrowRight") { e.preventDefault(); onChange(format(base + step)); }
  };

  const ticks = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={24 * 60 - 5}
        aria-valuenow={totalMins}
        aria-valuetext={label || "unset"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative h-14 w-full rounded-md border border-border bg-input cursor-pointer touch-none focus:outline-none focus:border-gold"
      >
        {/* center baseline */}
        <div className="absolute left-3 right-3 top-1/2 h-px bg-border" />
        {/* ticks */}
        {ticks.map((h) => {
          const tpct = (h / 24) * 100;
          return (
            <div key={h} className="absolute top-1/2 -translate-x-1/2" style={{ left: `calc(${tpct}% + ${(1 - tpct / 100) * 12 - 6}px)` }}>
              <div className="h-2 w-px bg-muted-foreground/40 -translate-y-1" />
              <div className="mt-2 text-[9px] font-mono text-muted-foreground -translate-y-1">{String(h).padStart(2, "0")}</div>
            </div>
          );
        })}
        {isSet ? (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-gold pointer-events-none"
              style={{ left: `calc(${pct}% + ${(1 - pct / 100) * 12 - 0.5}px)` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold pointer-events-none"
              style={{ left: `calc(${pct}% + ${(1 - pct / 100) * 12 - 0}px)`, boxShadow: "0 0 12px color-mix(in oklab, var(--gold) 60%, transparent)" }}
            />
            <div
              className="absolute -top-7 -translate-x-1/2 rounded-md border border-gold/60 bg-card px-2 py-0.5 text-[11px] font-mono text-gold pointer-events-none whitespace-nowrap"
              style={{ left: `calc(${pct}% + ${(1 - pct / 100) * 12 - 0}px)` }}
            >
              {label}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] font-mono text-muted-foreground">
            Tap anywhere to set your time
          </div>
        )}
      </div>
    </div>
  );
}
