import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, RotateCcw, Sparkles, Flame, CheckCircle2, Volume2, VolumeX, ChevronRight } from "lucide-react";
import { RouteError } from "@/components/RouteError";
import { ImmersiveHeader } from "@/components/ImmersiveHeader";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { haptic } from "@/lib/haptics";
import { logBreathingSession, getBreathingStats } from "@/lib/breathing.functions";
import { celebrate } from "@/lib/celebrate";
import { useTrack } from "@/lib/track";



export const Route = createFileRoute("/app/breathe")({
  head: () => ({
    meta: [
      { title: "Breathe — REBUILT" },
      { name: "description", content: "Guided breathwork: box breathing, 4-7-8, and the physiological sigh. Two minutes to reset your nervous system." },
      { property: "og:title", content: "Breathe — REBUILT" },
      { property: "og:description", content: "Guided breathwork to calm, focus, and reset — in under five minutes." },
    ],
  }),
  component: BreathePage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

type PhaseLabel = "Inhale" | "Hold" | "Exhale" | "Sigh";
type Phase = { label: PhaseLabel; seconds: number; scale: number };
type PatternId = "box" | "relax_478" | "physio_sigh";
type Pattern = {
  id: PatternId;
  name: string;
  tag: string;
  benefit: string;
  phases: Phase[];
};

const IN = 1.0;
const OUT = 0.55;
const HALF = 0.78;

// Per-phase palette (H S L). Values interpolated by CSS transitions
// on the orb element because the surrounding gradient/box-shadow strings
// share identical shape between phases.
type Palette = { hue: number; sat: number; light: number; name: string };
// Track-aware orb palettes. Warm gold/ember for inhale/hold/sigh — cool tint
// only appears on exhale (release). Keeps orb on-brand; never generic blue.
const PALETTE: Record<PhaseLabel, Palette> = {
  Inhale: { hue: 42,  sat: 78, light: 62, name: "warm gold" },     // gold-amber
  Hold:   { hue: 30,  sat: 72, light: 58, name: "ember" },         // deeper ember
  Exhale: { hue: 205, sat: 55, light: 62, name: "cool teal" },     // cool release
  Sigh:   { hue: 45,  sat: 88, light: 68, name: "bright gold" },
};
// Angels track — rose-gold family; still cool only on exhale.
const PALETTE_ANGELS: Record<PhaseLabel, Palette> = {
  Inhale: { hue: 18,  sat: 55, light: 70, name: "rose gold" },
  Hold:   { hue: 12,  sat: 50, light: 62, name: "warm rose" },
  Exhale: { hue: 220, sat: 30, light: 72, name: "cool mauve" },
  Sigh:   { hue: 22,  sat: 62, light: 74, name: "champagne rose" },
};
function pickPalette(): Record<PhaseLabel, Palette> {
  if (typeof document === "undefined") return PALETTE;
  return document.documentElement.getAttribute("data-track") === "angels"
    ? PALETTE_ANGELS
    : PALETTE;
}


const PATTERNS: Pattern[] = [
  {
    id: "box",
    name: "Box Breathing",
    tag: "4·4·4·4",
    benefit: "Steady focus. Used by Navy SEALs to stay calm under pressure.",
    phases: [
      { label: "Inhale", seconds: 4, scale: IN },
      { label: "Hold", seconds: 4, scale: IN },
      { label: "Exhale", seconds: 4, scale: OUT },
      { label: "Hold", seconds: 4, scale: OUT },
    ],
  },
  {
    id: "relax_478",
    name: "4-7-8 Relax",
    tag: "4·7·8",
    benefit: "Deep calm. Great before sleep or when stress spikes.",
    phases: [
      { label: "Inhale", seconds: 4, scale: IN },
      { label: "Hold", seconds: 7, scale: IN },
      { label: "Exhale", seconds: 8, scale: OUT },
    ],
  },
  {
    id: "physio_sigh",
    name: "Physiological Sigh",
    tag: "double in · long out",
    benefit: "Fastest way to lower stress in real time (Huberman lab).",
    phases: [
      { label: "Inhale", seconds: 2, scale: HALF },
      { label: "Sigh", seconds: 1, scale: IN },
      { label: "Exhale", seconds: 6, scale: OUT },
    ],
  },
];

const DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 1, label: "1 min" },
  { minutes: 3, label: "3 min" },
  { minutes: 5, label: "5 min" },
];

const PATTERN_KEY = "rebuilt.breathe.pattern";
const DURATION_KEY = "rebuilt.breathe.duration";
const AUDIO_KEY = "rebuilt.breathe.audio";
const VOICE_KEY = "rebuilt.breathe.voice";
const INTRO_KEY = "rebuilt.breathe.introSeen";


// Short, always-visible instruction under the orb — 8th-grade copy.
const INSTRUCTION: Record<PhaseLabel, string> = {
  Inhale: "Breathe in slowly through your nose…",
  Hold:   "Hold. Stay still.",
  Exhale: "Slowly out through your mouth…",
  Sigh:   "One more sip of air, then let it all out.",
};

// Short spoken prompts — calm, 8th-grade, matches the phase.
const SPOKEN: Record<PhaseLabel, string> = {
  Inhale: "Breathe in",
  Hold:   "Hold",
  Exhale: "Let it out slow",
  Sigh:   "Sip more air, then out",
};

/* ------------------------------------------------------------------
 * Voice cues via Web Speech API — picks the best available male or
 * female voice, filters out robotic system voices, and falls back to
 * Web Audio tones when no premium voice for the chosen gender exists.
 * ---------------------------------------------------------------- */
type VoiceMode = "male" | "female" | "tones";
type Gender = "male" | "female";

// Names that are typically low-quality / novelty / robotic on macOS/iOS/Windows.
const ROBOTIC =
  /(espeak|compact|novelty|whisper|bells|bahh|deranged|hysterical|trinoids|zarvox|cellos|good news|bad news|boing|jester|bubbles|junior|kathy|princess|ralph|bruce|agnes|vicki|veena|pipe organ|organ)/i;
const FEMALE_HINT =
  /(female|samantha|karen|moira|fiona|tessa|serena|allison|ava|susan|victoria|zoe|zira|hazel|libby|jenny|aria|natasha|olivia|emma|amy|joanna|salli|kimberly|ivy|kendra|nova|shimmer|grace|siobhan|catherine)/i;
const MALE_HINT =
  /(\bmale\b|daniel|alex|fred|arthur|oliver|rishi|aaron|tom|guy|davis|brandon|matthew|justin|joey|david|mark|george|ryan|liam|thomas|gordon)/i;

function pickVoice(gender: Gender): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return null;
  const en = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : all;

  const scored = pool
    .filter((v) => !ROBOTIC.test(v.name))
    .map((v) => {
      let score = 0;
      if (/natural|neural|premium|enhanced|online/i.test(v.name)) score += 5;
      if (v.localService) score += 3;
      if (/google/i.test(v.name)) score += 2;
      if (/microsoft/i.test(v.name)) score += 1;
      if (v.default) score += 1;
      const isFemale = FEMALE_HINT.test(v.name);
      const isMale = MALE_HINT.test(v.name);
      if (gender === "female" && isFemale) score += 6;
      if (gender === "male" && isMale) score += 6;
      if (gender === "female" && isMale && !isFemale) score -= 8;
      if (gender === "male" && isFemale && !isMale) score -= 8;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  // Require a positive gender signal so we don't ship a robotic default.
  if (!best || best.score < 5) return null;
  return best.v;
}

function speakPhrase(voice: SpeechSynthesisVoice, gender: Gender, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const s = window.speechSynthesis;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang || "en-US";
  u.rate = 0.88;                    // slow, calm
  u.pitch = gender === "male" ? 0.92 : 1.05;
  u.volume = 0.9;
  s.speak(u);
}



/* ------------------------------------------------------------------
 * Audio cues — Web Audio soft tones, one per phase.
 * Inhale/Sigh: gentle rising sine (220→440Hz).
 * Hold: soft short tick.
 * Exhale: gentle falling sine (440→220Hz).
 * ---------------------------------------------------------------- */
type AudioBox = { ctx: AudioContext; master: GainNode };
function makeAudio(): AudioBox | null {
  try {
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.14; // gentle
    master.connect(ctx.destination);
    return { ctx, master };
  } catch {
    return null;
  }
}
function playPhaseCue(box: AudioBox, label: PhaseLabel, seconds: number) {
  const { ctx, master } = box;
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.connect(g);
  g.connect(master);

  if (label === "Inhale" || label === "Sigh") {
    const dur = Math.min(1.2, Math.max(0.6, seconds * 0.35));
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.linearRampToValueAtTime(440, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  } else if (label === "Exhale") {
    const dur = Math.min(1.4, Math.max(0.8, seconds * 0.35));
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.linearRampToValueAtTime(220, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  } else {
    // Hold — soft short tick
    const dur = 0.12;
    osc.frequency.setValueAtTime(660, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}



function BreathePage() {
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const logSession = useServerFn(logBreathingSession);
  const { track } = useTrack();


  const [patternId, setPatternId] = useState<PatternId>(() => {
    if (typeof window === "undefined") return "box";
    return (window.localStorage.getItem(PATTERN_KEY) as PatternId) || "box";
  });
  const [minutes, setMinutes] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    return Number(window.localStorage.getItem(DURATION_KEY)) || 3;
  });
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUDIO_KEY) === "1";
  });
  const [showIntro, setShowIntro] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(INTRO_KEY) !== "1") setShowIntro(true);
  }, []);
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    try { window.localStorage.setItem(INTRO_KEY, "1"); } catch { /* noop */ }
  }, []);
  const audioRef = useRef<AudioBox | null>(null);
  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(AUDIO_KEY, next ? "1" : "0"); } catch { /* noop */ }
      if (next && !audioRef.current) audioRef.current = makeAudio();
      if (next && audioRef.current?.ctx.state === "suspended") void audioRef.current.ctx.resume();
      return next;
    });
  }, []);

  // Voice mode — defaults follow the current track (angels → female, men → male).
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    if (typeof window === "undefined") return "male";
    const stored = window.localStorage.getItem(VOICE_KEY);
    if (stored === "male" || stored === "female" || stored === "tones") return stored;
    return track === "angels" ? "female" : "male";
  });
  // Reconcile if track hydrates after mount (and user hasn't chosen explicitly).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(VOICE_KEY)) return;
    setVoiceMode(track === "angels" ? "female" : "male");
  }, [track]);
  const pickVoiceMode = useCallback((next: VoiceMode) => {
    setVoiceMode(next);
    try { window.localStorage.setItem(VOICE_KEY, next); } catch { /* noop */ }
  }, []);

  // Keep the resolved SpeechSynthesisVoice in a ref so we don't re-pick per phase.
  const speechVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean>(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      speechVoiceRef.current = null;
      setVoiceAvailable(false);
      return;
    }
    if (voiceMode === "tones") { speechVoiceRef.current = null; setVoiceAvailable(true); return; }
    const resolve = () => {
      const v = pickVoice(voiceMode);
      speechVoiceRef.current = v;
      setVoiceAvailable(!!v);
    };
    resolve();
    const s = window.speechSynthesis;
    const handler = () => resolve();
    s.addEventListener?.("voiceschanged", handler);
    return () => s.removeEventListener?.("voiceschanged", handler);
  }, [voiceMode]);





  const pattern = useMemo(() => PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0], [patternId]);
  const totalSeconds = minutes * 60;

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const currentPhase = pattern.phases[phaseIdx];

  const stats = useQuery({
    queryKey: ["breathing-stats"],
    queryFn: () => getBreathingStats(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, done]);

  // Phase advancement
  useEffect(() => {
    if (!running || done) return;
    if (tick < currentPhase.seconds) return;
    setTick(0);
    setPhaseIdx((i) => (i + 1) % pattern.phases.length);
  }, [tick, currentPhase.seconds, running, done, pattern.phases.length]);

  // Cue on phase entry
  const cuedRef = useRef<string>("");
  useEffect(() => {
    if (!running || done) return;
    if (tick !== 0) return;
    const key = `${elapsed}-${phaseIdx}`;
    if (cuedRef.current === key) return;
    cuedRef.current = key;
    haptic(currentPhase.label === "Inhale" || currentPhase.label === "Sigh" ? "light" : "selection");
    if (audioEnabled) {
      const gender: Gender | null = voiceMode === "male" ? "male" : voiceMode === "female" ? "female" : null;
      const voice = speechVoiceRef.current;
      if (gender && voice) {
        speakPhrase(voice, gender, SPOKEN[currentPhase.label]);
      } else if (audioRef.current) {
        playPhaseCue(audioRef.current, currentPhase.label, currentPhase.seconds);
      }
    }
  }, [tick, phaseIdx, running, done, elapsed, currentPhase.label, currentPhase.seconds, audioEnabled, voiceMode]);



  // Finale + persist
  const savedRef = useRef(false);
  useEffect(() => {
    if (!running || done) return;
    if (elapsed < totalSeconds) return;
    setRunning(false);
    setDone(true);
    haptic("success");
    celebrate("sparkle");
    if (savedRef.current) return;
    savedRef.current = true;
    logSession({ data: { pattern: patternId, duration_seconds: totalSeconds } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["breathing-stats"] });
      })
      .catch((e: unknown) => {
        // Show but do not throw — keep completion screen calm.
        console.warn("[breathe] save failed", e);
        toast.error("Couldn't save session", { description: "Your rest still counts." });
      });
  }, [elapsed, totalSeconds, running, done, logSession, patternId, qc]);

  const start = useCallback(() => {
    if (done) reset(false);
    cuedRef.current = "";
    if (audioEnabled) {
      if (!audioRef.current) audioRef.current = makeAudio();
      if (audioRef.current?.ctx.state === "suspended") void audioRef.current.ctx.resume();
    }
    setRunning(true);
    haptic("light");
  }, [done, audioEnabled]);


  function reset(alsoStop = true) {
    if (alsoStop) setRunning(false);
    setDone(false);
    setPhaseIdx(0);
    setTick(0);
    setElapsed(0);
    savedRef.current = false;
    cuedRef.current = "";
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // Cancel speech on unmount so it doesn't keep talking after navigation.
  useEffect(() => () => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);



  function changePattern(id: PatternId) {
    if (id === patternId || running) return;
    setPatternId(id);
    window.localStorage.setItem(PATTERN_KEY, id);
    reset();
  }
  function changeMinutes(m: number) {
    if (running) return;
    setMinutes(m);
    window.localStorage.setItem(DURATION_KEY, String(m));
    reset();
  }

  const orbScale = done ? 0.9 : !running ? 0.7 : reduceMotion ? 0.9 : currentPhase.scale;
  const orbTransition =
    reduceMotion || !running
      ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
      : `transform ${currentPhase.seconds}s cubic-bezier(0.37, 0, 0.63, 1)`;

  const remaining = Math.max(0, totalSeconds - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const secondsLeft = Math.max(0, currentPhase.seconds - tick);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative">
        <ImmersiveHeader
          eyebrow="Reset"
          title="Breathe"
          subtitle="Two minutes to calm your nervous system."
          variant="dawn"
        />
        <Link
          to="/app"
          aria-label="Back"
          className="absolute top-4 left-4 h-10 w-10 inline-flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-foreground/85 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <main className="mx-auto max-w-md px-4 pb-32 pt-2">
        {/* Pattern picker */}
        <section aria-label="Pattern">
          <p className="label-mono text-[10px] text-[color:var(--text-tertiary)] mb-2">Pattern</p>
          <div className="space-y-2">
            {PATTERNS.map((p) => {
              const active = p.id === patternId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => changePattern(p.id)}
                  disabled={running}
                  aria-pressed={active}
                  className={[
                    "w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100",
                    active
                      ? "border-[color:var(--rebuilt-gold)]/60 bg-[color:var(--rebuilt-gold-dim)] shadow-[0_0_0_1px_var(--rebuilt-gold-glow)]"
                      : "border-[color:var(--border-default)] bg-[color:var(--bg-raised)] hover:border-[color:var(--border-strong)]",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base text-[color:var(--text-primary)]">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--rebuilt-gold)]">{p.tag}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-[color:var(--text-secondary)]">{p.benefit}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Duration picker */}
        <section aria-label="Length" className="mt-6">
          <p className="label-mono text-[10px] text-[color:var(--text-tertiary)] mb-2">Length</p>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[color:var(--bg-raised)] border border-[color:var(--border-default)]">
            {DURATIONS.map((d) => {
              const active = d.minutes === minutes;
              return (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => changeMinutes(d.minutes)}
                  disabled={running}
                  aria-pressed={active}
                  className={[
                    "h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60",
                    active
                      ? "bg-[color:var(--rebuilt-gold)] text-[color:var(--gold-foreground)] shadow-[0_4px_18px_-8px_var(--rebuilt-gold-glow)]"
                      : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </section>


        {/* Sound / voice-cue pill row */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleAudio}
              aria-pressed={audioEnabled}
              className={[
                "h-9 px-3 rounded-full border text-xs label-mono inline-flex items-center gap-1.5 transition-colors",
                audioEnabled
                  ? "border-gold/60 text-gold bg-gold/[0.08]"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {audioEnabled ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
              {audioEnabled ? "Voice cues on" : "Voice cues off"}
            </button>

            {audioEnabled && (
              <div
                role="radiogroup"
                aria-label="Voice"
                className="inline-flex items-center rounded-full border border-border bg-[color:var(--bg-raised,#141416)] p-0.5"
              >
                {(["male", "female", "tones"] as const).map((v) => {
                  const on = voiceMode === v;
                  const label = v === "male" ? "Male" : v === "female" ? "Female" : "Tones";
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pickVoiceMode(v)}
                      className={[
                        "h-8 px-3 rounded-full text-[11px] label-mono transition-colors",
                        on
                          ? "bg-gold/[0.12] text-gold"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {audioEnabled && voiceMode !== "tones" && !voiceAvailable && (
            <p className="text-[11px] text-muted-foreground text-center max-w-[32ch]">
              No premium {voiceMode} voice on this device — playing gentle tones instead.
            </p>
          )}
        </div>


        {/* Orb + player */}
        <section aria-label="Session" className="mt-4">
          <BreathVisual
            phaseIdx={phaseIdx}
            phaseLabel={currentPhase.label}
            phaseSeconds={currentPhase.seconds}
            phasesCount={pattern.phases.length}
            secondsLeft={secondsLeft}
            running={running}
            done={done}
            reduceMotion={!!reduceMotion}
            orbScale={orbScale}
            orbTransition={orbTransition}
            patternName={pattern.name}
            isBox={patternId === "box"}
          />

          {/* Always-visible instruction — tells you what to do RIGHT NOW */}
          <p
            className="mt-4 text-center text-sm sm:text-base text-foreground/90 min-h-[1.5em]"
            aria-live="polite"
          >
            {done
              ? "All done. Nice work."
              : running
                ? INSTRUCTION[currentPhase.label]
                : "Press Start when you're ready."}
          </p>




          {/* Progress + timer */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="h-1 w-56 rounded-full bg-[color:var(--border-subtle)] overflow-hidden">
              <div
                className="h-full bg-[color:var(--rebuilt-gold)] transition-[width] duration-500 ease-linear"
                style={{ width: `${Math.min(100, (elapsed / totalSeconds) * 100)}%` }}
                aria-hidden
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground" aria-label="Time remaining">
              {mm}:{ss} left
            </span>
          </div>

          {/* Controls */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {(elapsed > 0 || done) && (
              <button
                type="button"
                onClick={() => reset(true)}
                aria-label="Reset"
                className="h-12 w-12 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-raised)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] active:scale-[0.97] transition-all inline-flex items-center justify-center"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={running ? () => { setRunning(false); if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } : start}
              className="h-12 flex-1 max-w-[240px] rounded-xl bg-[color:var(--rebuilt-gold)] text-[color:var(--gold-foreground)] font-semibold text-sm active:scale-[0.98] transition-all shadow-[0_8px_28px_-10px_var(--rebuilt-gold-glow)] inline-flex items-center justify-center gap-2"
            >
              {running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {done ? "Again" : running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
            </button>
          </div>
        </section>

        {/* Completion summary */}
        {done && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8 rounded-2xl border border-[color:var(--rebuilt-gold)]/30 bg-[color:var(--rebuilt-gold-dim)] p-5 text-center"
            aria-live="polite"
          >
            <CheckCircle2 className="h-6 w-6 text-[color:var(--rebuilt-gold)] mx-auto" aria-hidden />
            <p className="mt-2 font-display text-xl text-[color:var(--text-primary)]">Nice work.</p>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">
              You gave yourself {minutes} minute{minutes === 1 ? "" : "s"} of quiet.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[color:var(--bg-raised)] border border-[color:var(--border-default)] p-3">
                <p className="label-mono text-[10px] text-[color:var(--text-tertiary)]">Sessions</p>
                <p className="mt-1 font-display text-2xl text-[color:var(--rebuilt-gold)] leading-none tabular-nums">{stats.data?.total ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-[color:var(--bg-raised)] border border-[color:var(--border-default)] p-3">
                <p className="label-mono text-[10px] text-[color:var(--text-tertiary)] inline-flex items-center gap-1">
                  <Flame className="h-3 w-3 text-[color:var(--rebuilt-gold)]" /> Daily streak
                </p>
                <p className="mt-1 font-display text-2xl text-[color:var(--rebuilt-gold)] leading-none tabular-nums">{stats.data?.streak ?? "—"}</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* Why it helps */}
        <p className="mt-6 text-center text-[12px] leading-snug text-muted-foreground max-w-[34ch] mx-auto">
          Slow breathing shifts your nervous system out of fight-or-flight. Two minutes is enough to feel it.
        </p>

        <AskCoachFooter prompt="Feeling anxious? Talk to your coach." />
      </main>

      <AnimatePresence>
        {showIntro && <BreatheIntro onDone={dismissIntro} />}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------
 * BreatheIntro — one-time 3-step overlay for first-time users.
 * ---------------------------------------------------------------- */
function BreatheIntro({ onDone }: { onDone: () => void }) {
  const steps = [
    {
      title: "Follow the orb.",
      body: "It grows when you breathe in. It shrinks when you breathe out.",
    },
    {
      title: "Match the count.",
      body: "Big numbers tell you how many seconds are left in this step.",
    },
    {
      title: "Rest on the corners.",
      body: "When it says Hold, stay still. Don't breathe in or out.",
    },
  ];
  const [i, setI] = useState(0);
  const next = () => (i < steps.length - 1 ? setI(i + 1) : onDone());
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="breathe-intro-title"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <p className="label-mono text-[10px] text-gold">How to breathe</p>
        <h2 id="breathe-intro-title" className="mt-2 font-display text-2xl text-foreground">
          {steps[i].title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{steps[i].body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {steps.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-gold" : "w-1.5 bg-foreground/25"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            className="h-10 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={next}
            className="h-10 flex-1 max-w-[180px] rounded-md bg-gold text-black font-semibold text-sm inline-flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
          >
            {i < steps.length - 1 ? "Next" : "Got it"}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


/* ------------------------------------------------------------------
 * BreathVisual — premium, phase-tinted orb + glass backdrop + BoxTracer.
 *
 * Performance:
 *  - Orb uses only transform (scale) + gradient/box-shadow transitions.
 *    Gradient strings share the same shape between phases, so browsers
 *    interpolate smoothly on the compositor.
 *  - Particles float via CSS keyframes (transform only) — no JS/frame.
 *  - BoxTracer runs a single rAF loop and writes strokeDashoffset
 *    directly to the SVG rect via ref (no React re-render per frame).
 * ---------------------------------------------------------------- */
function BreathVisual({
  phaseIdx,
  phaseLabel,
  phaseSeconds,
  phasesCount,
  secondsLeft,
  running,
  done,
  reduceMotion,
  orbScale,
  orbTransition,
  patternName,
  isBox,
}: {
  phaseIdx: number;
  phaseLabel: PhaseLabel;
  phaseSeconds: number;
  phasesCount: number;
  secondsLeft: number;
  running: boolean;
  done: boolean;
  reduceMotion: boolean;
  orbScale: number;
  orbTransition: string;
  patternName: string;
  isBox: boolean;
}) {
  const p = pickPalette()[phaseLabel];
  const hsl = (a: number) => `hsl(${p.hue} ${p.sat}% ${p.light}% / ${a})`;
  const hslDark = (a: number) =>
    `hsl(${p.hue} ${Math.max(30, p.sat - 15)}% ${Math.max(24, p.light - 24)}% / ${a})`;

  // Cross-fade duration for phase color swap (visual only).
  const hueSwap = reduceMotion ? "160ms" : "900ms";

  return (
    <div className="relative mx-auto w-[300px] h-[300px] flex items-center justify-center">
      {/* Ambient glass backdrop — phase-tinted, subtle */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[36px] overflow-hidden"
        style={{
          background: `radial-gradient(120% 90% at 50% 50%, ${hsl(0.18)} 0%, ${hslDark(0.08)} 55%, transparent 78%)`,
          transition: `background ${hueSwap} ease`,
          willChange: "background",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: "blur(24px) saturate(140%)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.02), transparent 60%)",
          }}
        />
      </div>

      {/* Outer ring */}
      <div
        aria-hidden
        className="absolute inset-4 rounded-full"
        style={{
          border: `1px solid ${hsl(0.22)}`,
          transition: `border-color ${hueSwap} ease, box-shadow ${hueSwap} ease`,
          boxShadow: `0 0 40px -12px ${hsl(0.35)}`,
        }}
      />

      {/* Aura */}
      <div
        aria-hidden
        className="absolute inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${hsl(0.42)} 0%, ${hsl(0.14)} 42%, ${hslDark(0.05)} 68%, transparent 82%)`,
          opacity: running && !reduceMotion ? 1 : 0.55,
          transition: `background ${hueSwap} ease, opacity 700ms ease`,
          willChange: "background, opacity",
          filter: "blur(6px)",
        }}
      />

      {/* Core orb — the breathing element */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: "72%",
          height: "72%",
          background: `radial-gradient(circle at 32% 28%, ${hsl(0.92)} 0%, ${hsl(0.55)} 28%, ${hsl(0.18)} 58%, ${hslDark(0.05)} 82%, transparent 100%)`,
          boxShadow: `
            0 0 80px -10px ${hsl(0.55)},
            0 0 32px -6px ${hsl(0.75)},
            inset 0 0 60px -18px ${hsl(0.75)},
            inset 0 -20px 40px -20px ${hslDark(0.7)}
          `,
          border: `1px solid ${hsl(0.55)}`,
          transform: `translateZ(0) scale(${orbScale})`,
          transition: `${orbTransition}, background ${hueSwap} ease, box-shadow ${hueSwap} ease, border-color ${hueSwap} ease`,
          willChange: "transform, background",
          backfaceVisibility: "hidden",
        }}
      />

      {/* Highlight sheen — sits atop the orb, doesn't scale with it */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "44%",
          height: "22%",
          top: "24%",
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.45), rgba(255,255,255,0.08) 55%, transparent 75%)",
          filter: "blur(6px)",
          opacity: running ? 0.85 : 0.55,
          transition: "opacity 600ms ease",
        }}
      />

      {/* Particles — pure CSS, transform only */}
      {!reduceMotion && running && <Particles hue={p.hue} sat={p.sat} light={p.light} />}

      {/* Box tracer overlay — only for Box Breathing */}
      {isBox && (
        <BoxTracer
          phaseIdx={phaseIdx}
          phasesCount={phasesCount}
          phaseSeconds={phaseSeconds}
          running={running}
          reduceMotion={reduceMotion}
          color={hsl(0.95)}
          trackColor={`hsl(${p.hue} 30% 70% / 0.14)`}
        />
      )}

      {/* Center content — big countdown + phase label */}
      <div className="relative text-center select-none pointer-events-none">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-1"
            >
              <Sparkles className="h-7 w-7" style={{ color: hsl(1) }} aria-hidden />
              <span className="font-display text-2xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">Done</span>
            </motion.div>
          ) : running ? (
            <motion.div
              key={phaseIdx}
              initial={{ opacity: 0.3, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.32em]"
                style={{ color: hsl(0.95), textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
              >
                {phaseLabel.toUpperCase()}
              </span>
              <span
                className="font-display leading-none tabular-nums"
                style={{
                  fontSize: 88,
                  color: "white",
                  textShadow: `0 2px 24px ${hsl(0.85)}, 0 1px 4px rgba(0,0,0,0.5)`,
                  marginTop: 4,
                }}
              >
                {Math.max(1, secondsLeft)}
              </span>
            </motion.div>
          ) : (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/70">Ready</span>
              <span
                className="font-display text-[28px] leading-none mt-2"
                style={{ color: "white", textShadow: `0 2px 16px ${hsl(0.5)}` }}
              >
                {patternName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* Box tracer — SVG rounded rect. Uses stroke-dasharray/offset with
 * pathLength normalized to phasesCount so each phase advances by 1 unit
 * clockwise: top → right → bottom → left. Own rAF loop updates
 * strokeDashoffset directly (no React re-render per frame). */
function BoxTracer({
  phaseIdx,
  phasesCount,
  phaseSeconds,
  running,
  reduceMotion,
  color,
  trackColor,
}: {
  phaseIdx: number;
  phasesCount: number;
  phaseSeconds: number;
  running: boolean;
  reduceMotion: boolean;
  color: string;
  trackColor: string;
}) {
  const rectRef = useRef<SVGRectElement | null>(null);
  const phaseStartRef = useRef<number>(0);
  const pausedProgressRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Set offset directly for perf.
  const applyOffset = useCallback((completedPhases: number, progress: number) => {
    if (!rectRef.current) return;
    const filled = Math.min(phasesCount, completedPhases + progress);
    // dasharray = phasesCount, offset 0 = fully drawn.
    rectRef.current.style.strokeDashoffset = String(phasesCount - filled);
  }, [phasesCount]);

  // On phase change / reset, reset timing.
  useEffect(() => {
    phaseStartRef.current = performance.now();
    pausedProgressRef.current = 0;
    applyOffset(phaseIdx, 0);
  }, [phaseIdx, applyOffset]);

  useEffect(() => {
    if (reduceMotion) {
      // Snap: just show fully-completed sides at each phase boundary.
      applyOffset(phaseIdx, running ? 1 : 0);
      return;
    }
    if (!running) {
      // Freeze at last known progress.
      const now = performance.now();
      const elapsed = (now - phaseStartRef.current) / 1000;
      pausedProgressRef.current = Math.min(1, elapsed / phaseSeconds);
      applyOffset(phaseIdx, pausedProgressRef.current);
      return;
    }
    // Adjust start so we resume from paused progress if any.
    phaseStartRef.current = performance.now() - pausedProgressRef.current * phaseSeconds * 1000;

    const loop = () => {
      const now = performance.now();
      const elapsed = (now - phaseStartRef.current) / 1000;
      const progress = Math.min(1, elapsed / phaseSeconds);
      applyOffset(phaseIdx, progress);
      if (progress < 1) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, reduceMotion, phaseSeconds, phaseIdx, applyOffset]);

  // Initial static snapshot on mount when not running.
  useEffect(() => {
    if (!running) applyOffset(phaseIdx, 0);
  }, [running, phaseIdx, applyOffset]);

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: "translateZ(0)" }}
    >
      {/* Track — full outline, faint */}
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="14"
        ry="14"
        fill="none"
        stroke={trackColor}
        strokeWidth="1.5"
        pathLength={phasesCount}
      />
      {/* Active tracer — clockwise from top-left */}
      <rect
        ref={rectRef}
        x="8"
        y="8"
        width="84"
        height="84"
        rx="14"
        ry="14"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={phasesCount}
        strokeDasharray={phasesCount}
        strokeDashoffset={phasesCount}
        style={{
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: "stroke 700ms ease, filter 700ms ease",
        }}
      />
    </svg>
  );
}

/* Particles — 8 dim dots orbiting via CSS keyframes. Transform-only. */
function Particles({ hue, sat, light }: { hue: number; sat: number; light: number }) {
  const dots = Array.from({ length: 8 });
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const radius = 118 + (i % 3) * 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const dur = 5.5 + (i % 4) * 0.9;
        const size = i % 2 === 0 ? 3 : 2;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: "50%",
              top: "50%",
              background: `hsl(${hue} ${sat}% ${light}% / 0.9)`,
              boxShadow: `0 0 8px hsl(${hue} ${sat}% ${light}% / 0.9)`,
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              animation: `rb-breath-shimmer ${dur}s ease-in-out ${i * 0.35}s infinite`,
              willChange: "opacity, transform",
            }}
          />
        );
      })}
      <style>{`
        @keyframes rb-breath-shimmer {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

