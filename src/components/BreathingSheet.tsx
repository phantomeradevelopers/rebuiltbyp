import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, Vibrate, Sparkles } from "lucide-react";
import { springConfig } from "@/lib/motion-rebuilt";
import { haptic } from "@/lib/haptics";
import { playChime } from "@/lib/sound";

/**
 * BreathingSheet — guided breathwork.
 *
 * Performance notes:
 *  - The orb animates via `transform: scale()` and `opacity` only — both are
 *    compositor-only properties, so no layout/paint work happens per frame.
 *  - `will-change: transform` hints the browser to promote the orb to its own
 *    GPU layer. Combined with a CSS transition, the browser interpolates on
 *    the compositor thread — no JS per frame.
 *  - Countdown ticks 1×/s via setInterval, not rAF. No re-render churn.
 *  - Respects prefers-reduced-motion (static orb + text only).
 */

type Phase = { label: "Inhale" | "Hold" | "Exhale"; seconds: number; scale: number };
type PresetId = "box" | "calm" | "relax";
type Preset = { id: PresetId; name: string; tag: string; phases: Phase[] };

const IN = 1.0;   // orb scale on full inhale
const OUT = 0.6;  // orb scale on full exhale

const PRESETS: Preset[] = [
  {
    id: "box",
    name: "Box",
    tag: "4·4·4·4",
    phases: [
      { label: "Inhale", seconds: 4, scale: IN },
      { label: "Hold",   seconds: 4, scale: IN },
      { label: "Exhale", seconds: 4, scale: OUT },
      { label: "Hold",   seconds: 4, scale: OUT },
    ],
  },
  {
    id: "calm",
    name: "Calm",
    tag: "4·7·8",
    phases: [
      { label: "Inhale", seconds: 4, scale: IN },
      { label: "Hold",   seconds: 7, scale: IN },
      { label: "Exhale", seconds: 8, scale: OUT },
    ],
  },
  {
    id: "relax",
    name: "Relax",
    tag: "4·6",
    phases: [
      { label: "Inhale", seconds: 4, scale: IN },
      { label: "Exhale", seconds: 6, scale: OUT },
    ],
  },
];

const TOTAL_ROUNDS = 4;
const HAPTICS_KEY = "rebuilt.breath.haptics";
const AUDIO_KEY = "rebuilt.breath.audio";
const PRESET_KEY = "rebuilt.breath.preset";

function readBool(key: string, fallback = false) {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v == null ? fallback : v === "1";
}
function writeBool(key: string, v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, v ? "1" : "0");
}

export function BreathingSheet({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  const [presetId, setPresetId] = useState<PresetId>(() => {
    if (typeof window === "undefined") return "box";
    return (window.localStorage.getItem(PRESET_KEY) as PresetId) || "box";
  });
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId) ?? PRESETS[0], [presetId]);

  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0); // total seconds engaged
  const [hapticsOn, setHapticsOn] = useState(() => readBool(HAPTICS_KEY, false));
  const [audioOn, setAudioOn] = useState(() => readBool(AUDIO_KEY, false));

  const done = round >= TOTAL_ROUNDS;
  const current = preset.phases[phaseIdx];

  // Lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Reset when preset changes (only if not started)
  useEffect(() => {
    if (round > 0 || tick > 0 || running) return;
    setPhaseIdx(0);
    setTick(0);
    // preset-only reset does not clear elapsed
  }, [presetId, round, tick, running]);

  // 1 Hz clock: drives countdown and elapsed
  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, done]);

  // Advance phase / round when tick reaches phase length
  useEffect(() => {
    if (!running || done) return;
    if (tick < current.seconds) return;
    setTick(0);
    const next = phaseIdx + 1;
    if (next >= preset.phases.length) {
      setPhaseIdx(0);
      setRound((r) => r + 1);
    } else {
      setPhaseIdx(next);
    }
  }, [tick, current.seconds, phaseIdx, preset.phases.length, running, done]);

  // Cue on phase entry
  const cuedRef = useRef<string>("");
  useEffect(() => {
    if (!running || done) return;
    if (tick !== 0) return;
    const key = `${round}-${phaseIdx}`;
    if (cuedRef.current === key) return;
    cuedRef.current = key;
    if (hapticsOn) haptic(current.label === "Inhale" ? "light" : "selection");
    if (audioOn && current.label === "Inhale") playChime("ding");
  }, [tick, round, phaseIdx, running, done, hapticsOn, audioOn, current.label]);

  // Finale
  useEffect(() => {
    if (!done) return;
    if (hapticsOn) haptic("success");
    if (audioOn) playChime("singing_bowl");
    toast.success("Session complete.", { description: "Carry that calm with you." });
  }, [done, hapticsOn, audioOn]);

  const start = useCallback(() => {
    cuedRef.current = "";
    setRunning(true);
    if (hapticsOn) haptic("light");
  }, [hapticsOn]);

  const pause = useCallback(() => {
    setRunning(false);
    if (hapticsOn) haptic("selection");
  }, [hapticsOn]);

  const reset = useCallback(() => {
    setRunning(false);
    setRound(0);
    setPhaseIdx(0);
    setTick(0);
    setElapsed(0);
    cuedRef.current = "";
  }, []);

  const changePreset = useCallback((id: PresetId) => {
    if (id === presetId) return;
    setPresetId(id);
    window.localStorage.setItem(PRESET_KEY, id);
    reset();
  }, [presetId, reset]);

  const toggleHaptics = () => setHapticsOn((v) => { writeBool(HAPTICS_KEY, !v); return !v; });
  const toggleAudio = () => setAudioOn((v) => { writeBool(AUDIO_KEY, !v); return !v; });

  // Orb scale: static when paused/idle/reduce-motion; CSS transition handles smoothness.
  const orbScale = done
    ? 0.85
    : !running
      ? 0.75
      : reduceMotion
        ? 0.9
        : current.scale;

  // Transition duration = the current phase's seconds → orb glides in sync.
  const orbTransition = reduceMotion || !running
    ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease"
    : `transform ${current.seconds}s cubic-bezier(0.37, 0, 0.63, 1), opacity 400ms ease`;

  const secondsLeft = Math.max(0, current.seconds - tick);
  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

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
          className="w-full sm:max-w-md max-h-[94vh] flex flex-col rounded-t-[24px] sm:rounded-[24px] border-t sm:border border-[color:var(--border-strong,rgba(255,255,255,0.10))] bg-[color:var(--bg-raised,#141416)] shadow-2xl overflow-hidden"
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
                Breathwork
              </p>
              <p className="mt-1 font-display text-lg leading-tight text-[color:var(--text-primary,#fff)]">
                {done
                  ? "Complete"
                  : running
                    ? `Round ${Math.min(round + 1, TOTAL_ROUNDS)} of ${TOTAL_ROUNDS}`
                    : "Pick a pattern"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-11 w-11 -mr-1 inline-flex items-center justify-center rounded-full text-[color:var(--text-secondary,rgba(255,255,255,0.6))] hover:text-[color:var(--text-primary,#fff)] hover:bg-white/5 active:scale-95 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-5">
            {/* Preset selector */}
            <div
              role="tablist"
              aria-label="Breathing pattern"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[color:var(--bg-elevated,#1c1c1f)] border border-[color:var(--border-hairline,rgba(255,255,255,0.06))]"
            >
              {PRESETS.map((p) => {
                const active = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => changePreset(p.id)}
                    className={[
                      "h-12 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]",
                      active
                        ? "bg-[color:var(--rebuilt-gold,#d4af37)] text-black shadow-[0_4px_18px_-8px_rgba(212,175,55,0.6)]"
                        : "text-[color:var(--text-secondary,rgba(255,255,255,0.7))] hover:text-[color:var(--text-primary,#fff)]",
                    ].join(" ")}
                  >
                    <span className="block leading-tight">{p.name}</span>
                    <span className={`block leading-tight font-mono text-[10px] ${active ? "text-black/70" : "text-white/40"}`}>
                      {p.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Orb */}
            <div className="relative mx-auto mt-8 w-[264px] h-[264px] flex items-center justify-center">
              {/* Static rim — no animation, no repaint */}
              <div
                className="absolute inset-0 rounded-full border border-[color:var(--rebuilt-gold,#d4af37)]/20"
                aria-hidden
              />
              {/* Ambient glow — animates only opacity when running (compositor-only) */}
              <div
                className="absolute inset-6 rounded-full pointer-events-none"
                aria-hidden
                style={{
                  background: "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.28), rgba(212,175,55,0.05) 55%, transparent 72%)",
                  opacity: running && !reduceMotion ? 1 : 0.55,
                  transition: "opacity 800ms ease",
                  willChange: "opacity",
                }}
              />
              {/* Orb — transform + opacity only */}
              <div
                aria-hidden
                className="absolute rounded-full border border-[color:var(--rebuilt-gold,#d4af37)]/45"
                style={{
                  width: "78%",
                  height: "78%",
                  background:
                    "radial-gradient(circle at 35% 30%, rgba(212,175,55,0.42), rgba(212,175,55,0.08) 58%, transparent 78%)",
                  boxShadow: "0 0 60px -12px rgba(212,175,55,0.4), inset 0 0 40px -12px rgba(212,175,55,0.25)",
                  transform: `translateZ(0) scale(${orbScale})`,
                  transition: orbTransition,
                  willChange: "transform, opacity",
                  backfaceVisibility: "hidden",
                }}
              />

              {/* Center label */}
              <div className="relative text-center pointer-events-none select-none">
                {done ? (
                  <div className="flex flex-col items-center gap-1">
                    <Sparkles className="h-7 w-7 text-[color:var(--rebuilt-gold,#d4af37)]" aria-hidden />
                    <span className="font-display text-2xl text-[color:var(--text-primary,#fff)]">Done</span>
                  </div>
                ) : running ? (
                  <>
                    <span
                      key={`${round}-${phaseIdx}`}
                      className="font-display text-[40px] leading-none text-[color:var(--text-primary,#fff)] animate-[breathLabel_260ms_ease-out]"
                    >
                      {current.label}
                    </span>
                    <span className="block mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)]/85 tabular-nums">
                      {secondsLeft}s
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-[26px] leading-none text-[color:var(--text-primary,#fff)]">
                      Ready
                    </span>
                    <span className="block mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                      {preset.name} · {preset.tag}
                    </span>
                  </>
                )}
              </div>

              <style>{`
                @keyframes breathLabel {
                  0% { opacity: 0.35; transform: translateY(3px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
              `}</style>
            </div>

            {/* Round dots + timer */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i < round
                        ? "w-6 bg-[color:var(--rebuilt-gold,#d4af37)]"
                        : i === round && running
                          ? "w-6 bg-[color:var(--rebuilt-gold,#d4af37)]/50"
                          : "w-1.5 bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] tabular-nums text-white/40" aria-label="Session time">
                {mm}:{ss}
              </span>
            </div>

            {/* Why-it-helps */}
            <p className="mt-5 text-center text-[13px] leading-snug text-[color:var(--text-secondary,rgba(255,255,255,0.65))] max-w-[32ch] mx-auto">
              Slow breathing calms your nerves and steadies your focus in about a minute.
            </p>

            {/* Toggles */}
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={toggleHaptics}
                aria-pressed={hapticsOn}
                aria-label={hapticsOn ? "Turn off haptics" : "Turn on haptics"}
                className={[
                  "h-10 px-3.5 rounded-full inline-flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.97] border",
                  hapticsOn
                    ? "bg-[color:var(--rebuilt-gold,#d4af37)]/12 text-[color:var(--rebuilt-gold,#d4af37)] border-[color:var(--rebuilt-gold,#d4af37)]/35"
                    : "bg-[color:var(--bg-elevated,#1c1c1f)] text-white/60 border-white/8 hover:text-white",
                ].join(" ")}
              >
                <Vibrate className="h-3.5 w-3.5" aria-hidden />
                Haptics {hapticsOn ? "on" : "off"}
              </button>
              <button
                type="button"
                onClick={toggleAudio}
                aria-pressed={audioOn}
                aria-label={audioOn ? "Turn off sound" : "Turn on sound"}
                className={[
                  "h-10 px-3.5 rounded-full inline-flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.97] border",
                  audioOn
                    ? "bg-[color:var(--rebuilt-gold,#d4af37)]/12 text-[color:var(--rebuilt-gold,#d4af37)] border-[color:var(--rebuilt-gold,#d4af37)]/35"
                    : "bg-[color:var(--bg-elevated,#1c1c1f)] text-white/60 border-white/8 hover:text-white",
                ].join(" ")}
              >
                {audioOn ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
                Sound {audioOn ? "on" : "off"}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pt-3 pb-4 border-t border-[color:var(--border-hairline,rgba(255,255,255,0.06))] flex gap-2">
            {done ? (
              <>
                <button
                  type="button"
                  onClick={reset}
                  className="h-12 flex-1 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-white/80 hover:text-white active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 flex-[1.4] rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-black font-semibold text-sm active:scale-[0.98] transition-all shadow-[0_8px_28px_-10px_rgba(212,175,55,0.5)]"
                >
                  Finish
                </button>
              </>
            ) : (
              <>
                {(round > 0 || tick > 0) && (
                  <button
                    type="button"
                    onClick={reset}
                    aria-label="Reset"
                    className="h-12 w-12 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-white/70 hover:text-white active:scale-[0.97] transition-all inline-flex items-center justify-center"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={running ? pause : start}
                  className="h-12 flex-1 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-black font-semibold text-sm active:scale-[0.98] transition-all shadow-[0_8px_28px_-10px_rgba(212,175,55,0.5)] inline-flex items-center justify-center gap-2"
                >
                  {running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                  {running ? "Pause" : round === 0 && tick === 0 ? "Start" : "Resume"}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
