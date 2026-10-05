import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, Pause, Play, SkipForward, Check, Sparkles, Timer } from "lucide-react";
import { springConfig } from "@/lib/motion-rebuilt";
import { haptic } from "@/lib/haptics";
import { playChime } from "@/lib/sound";

type Movement = {
  name: string;
  seconds: number;
  cue: string;
  side?: "Both" | "Left → Right" | "Hold";
};

const MOVEMENTS: Movement[] = [
  { name: "Cat-cow", seconds: 60, cue: "Hands and knees. Arch and round slowly with the breath.", side: "Both" },
  { name: "World's greatest stretch", seconds: 60, cue: "Lunge, hand to floor, rotate. 30s each side.", side: "Left → Right" },
  { name: "Hip openers (90/90)", seconds: 60, cue: "Seated 90/90. Switch sides at 30s.", side: "Left → Right" },
  { name: "Shoulder rolls + neck", seconds: 60, cue: "10 rolls each direction. Gentle neck circles.", side: "Both" },
  { name: "Standing reach + breath", seconds: 60, cue: "Reach overhead on inhale, fold on exhale.", side: "Hold" },
];

const REST_SECONDS = 15;

type Phase = "move" | "rest" | "done";

export function MobilityResetSheet({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("move");
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState<boolean[]>(() => MOVEMENTS.map(() => false));
  const reduceMotion = useReducedMotion();

  const total = MOVEMENTS.length;
  const done = phase === "done";
  const isResting = phase === "rest";
  const current = MOVEMENTS[Math.min(idx, total - 1)];
  const nextMove = MOVEMENTS[idx + 1];

  const targetSeconds = done ? 0 : isResting ? REST_SECONDS : current.seconds;
  const remaining = Math.max(0, targetSeconds - tick);
  const progress = targetSeconds === 0 ? 1 : Math.min(1, tick / targetSeconds);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Tick
  useEffect(() => {
    if (done || paused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [idx, phase, done, paused]);

  // Phase advance
  useEffect(() => {
    if (done) return;
    if (tick < targetSeconds) return;

    if (phase === "move") {
      setCompleted((prev) => {
        if (prev[idx]) return prev;
        const next = [...prev]; next[idx] = true; return next;
      });
      setTick(0);
      if (idx + 1 >= total) {
        setPhase("done");
      } else {
        setPhase("rest");
      }
    } else if (phase === "rest") {
      setTick(0);
      setIdx((i) => i + 1);
      setPhase("move");
    }
  }, [tick, targetSeconds, phase, idx, total, done]);

  // Finale
  useEffect(() => {
    if (!done) return;
    toast.success("Mobility reset done.", { description: "Joints warm. Body ready." });
    const t = setTimeout(onClose, 1600);
    return () => clearTimeout(t);
  }, [done, onClose]);

  // Rest-phase cues: start, halfway, ready
  const cuedRef = useRef<{ phase: Phase; idx: number; marks: Set<string> }>({
    phase: "move", idx: 0, marks: new Set(),
  });
  useEffect(() => {
    const c = cuedRef.current;
    if (c.phase !== phase || c.idx !== idx) {
      c.phase = phase; c.idx = idx; c.marks = new Set();
    }
    if (done || paused || phase !== "rest") return;
    const half = Math.floor(REST_SECONDS / 2);
    if (tick === 0 && !c.marks.has("start")) {
      c.marks.add("start");
      haptic("light");
      playChime("ding");
    } else if (tick === half && !c.marks.has("half")) {
      c.marks.add("half");
      haptic("selection");
    } else if (tick === REST_SECONDS - 1 && !c.marks.has("ready")) {
      c.marks.add("ready");
      haptic("medium");
      playChime("chime");
    }
  }, [phase, idx, tick, paused, done]);


  function skip() {
    if (done) return;
    setTick(targetSeconds);
  }

  function complete() {
    if (done || phase !== "move") return;
    setTick(current.seconds);
  }

  function skipRest() {
    if (phase !== "rest") return;
    setTick(REST_SECONDS);
  }

  const ringCircumference = useMemo(() => 2 * Math.PI * 92, []);
  const ringOffset = ringCircumference * (1 - progress);
  const ringColor = isResting
    ? "rgba(255,255,255,0.55)"
    : "var(--rebuilt-gold, #d4af37)";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-[24px] sm:rounded-[24px] border-t sm:border border-[color:var(--border-strong,rgba(255,255,255,0.10))] bg-[color:var(--bg-raised,#141416)] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          initial={{ y: reduceMotion ? 0 : "100%" }}
          animate={{ y: 0 }}
          exit={{ y: reduceMotion ? 0 : "100%" }}
          transition={springConfig}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/15" />
          </div>

          {/* Header */}
          <header className="flex items-start justify-between px-5 pt-3 pb-3 border-b border-[color:var(--border-hairline,rgba(255,255,255,0.06))]">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
                {isResting ? "Rest" : "Mobility reset"}
              </p>
              <p className="mt-1 font-display text-lg leading-tight text-[color:var(--text-primary,#fff)]">
                {done
                  ? "Complete"
                  : isResting
                  ? `Next: ${nextMove?.name ?? ""}`
                  : `Move ${idx + 1} of ${total}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-10 w-10 -mr-1 inline-flex items-center justify-center rounded-full text-[color:var(--text-secondary,rgba(255,255,255,0.6))] hover:text-[color:var(--text-primary,#fff)] hover:bg-white/5 active:scale-95 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-5">
            {/* Big ring */}
            <div className="relative mx-auto w-[220px] h-[220px] flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
                <circle
                  cx="100" cy="100" r="92" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="6"
                />
                <motion.circle
                  cx="100" cy="100" r="92" fill="none"
                  stroke={ringColor} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={done ? 0 : ringOffset}
                  animate={{ strokeDashoffset: done ? 0 : ringOffset }}
                  transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
                  style={isResting ? { strokeDasharray: "4 6" } : undefined}
                />
              </svg>
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    className="relative flex flex-col items-center gap-1"
                  >
                    <Sparkles className="h-7 w-7 text-[color:var(--rebuilt-gold,#d4af37)]" />
                    <span className="font-display text-2xl text-[color:var(--text-primary,#fff)]">Done</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${phase}-${idx}`}
                    initial={{ opacity: 0.3, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.18 }}
                    className="relative text-center"
                  >
                    {isResting && (
                      <Timer className="h-4 w-4 mx-auto mb-1 text-[color:var(--text-tertiary,rgba(255,255,255,0.45))]" />
                    )}
                    <span className={`font-display text-[64px] leading-none tabular-nums ${isResting ? "text-[color:var(--text-secondary,rgba(255,255,255,0.75))]" : "text-[color:var(--text-primary,#fff)]"}`}>
                      {remaining}
                    </span>
                    <span className="block mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary,rgba(255,255,255,0.4))]">
                      {isResting ? "rest" : "seconds"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Current state */}
            {!done && (
              <motion.div
                key={`label-${phase}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="mt-6 text-center"
              >
                {isResting ? (
                  <>
                    <p className="font-display text-2xl text-[color:var(--text-primary,#fff)] leading-tight">
                      Breathe.
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.65))] max-w-[28ch] mx-auto leading-snug">
                      Up next: <span className="text-[color:var(--text-primary,#fff)] font-medium">{nextMove?.name}</span>
                    </p>
                    {nextMove?.side && (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)]/80">
                        {nextMove.side}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-display text-2xl text-[color:var(--text-primary,#fff)] leading-tight">
                      {current.name}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.65))] max-w-[28ch] mx-auto leading-snug">
                      {current.cue}
                    </p>
                    {current.side && (
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)]/80">
                        {current.side}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Sequence dots / step list */}
            <ol className="mt-6 space-y-1.5">
              {MOVEMENTS.map((m, i) => {
                const isDone = completed[i];
                const isActive = !done && i === idx && phase === "move";
                const isNext = !done && i === idx + 1 && phase === "rest";
                const isUpcoming = !done && phase === "rest" && i === idx; // just-finished still rendered as done via completed[]
                void isUpcoming;
                return (
                  <li
                    key={m.name}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-[color:var(--rebuilt-gold,#d4af37)]/[0.08] border border-[color:var(--rebuilt-gold,#d4af37)]/30"
                        : isNext
                        ? "bg-white/[0.03] border border-white/10"
                        : "border border-transparent"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isDone
                          ? "bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)]"
                          : isActive
                          ? "border border-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--rebuilt-gold,#d4af37)]"
                          : isNext
                          ? "border border-white/30 text-[color:var(--text-secondary,rgba(255,255,255,0.7))]"
                          : "border border-white/10 text-[color:var(--text-tertiary,rgba(255,255,255,0.4))]"
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span
                      className={`text-sm flex-1 truncate ${
                        isActive
                          ? "text-[color:var(--text-primary,#fff)] font-medium"
                          : isDone
                          ? "text-[color:var(--text-tertiary,rgba(255,255,255,0.45))] line-through"
                          : "text-[color:var(--text-secondary,rgba(255,255,255,0.6))]"
                      }`}
                    >
                      {m.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary,rgba(255,255,255,0.4))] tabular-nums">
                      {isNext ? `rest ${REST_SECONDS}s` : `${m.seconds}s`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Footer controls */}
          {!done && (
            <div className="px-5 pt-3 pb-4 border-t border-[color:var(--border-hairline,rgba(255,255,255,0.06))] grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="h-11 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-[color:var(--text-secondary,rgba(255,255,255,0.7))] hover:text-[color:var(--text-primary,#fff)] active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 text-xs font-medium"
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "Resume" : "Pause"}
              </button>
              {isResting ? (
                <button
                  type="button"
                  onClick={skipRest}
                  className="h-11 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 text-xs font-semibold shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
                >
                  <Play className="h-4 w-4" />
                  Start next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={complete}
                  className="h-11 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 text-xs font-semibold shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
                >
                  <Check className="h-4 w-4" />
                  Done
                </button>
              )}
              <button
                type="button"
                onClick={skip}
                className="h-11 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-[color:var(--text-secondary,rgba(255,255,255,0.7))] hover:text-[color:var(--text-primary,#fff)] active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 text-xs font-medium"
                aria-label="Skip"
              >
                <SkipForward className="h-4 w-4" />
                Skip
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
