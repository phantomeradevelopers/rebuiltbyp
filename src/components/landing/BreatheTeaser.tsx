import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/landing/Reveal";
import { ArrowRight, Volume2, VolumeX, Wind } from "lucide-react";

/**
 * Landing "Breathe first. Try it now." — interactive box-breathing widget that
 * mirrors the in-app /app/breathe experience: same orb visuals, same 4-4-4-4
 * cadence, same voice/tones cue system. Persists voice preferences.
 */

type PhaseLabel = "Inhale" | "Hold" | "Exhale";
type Phase = { label: PhaseLabel; spoken: string; seconds: number; scale: number };
type VoiceMode = "male" | "female" | "tones";
type Length = 1 | 3 | 5;

const IN = 1.14;
const OUT = 0.86;

const PHASES: Phase[] = [
  { label: "Inhale", spoken: "Breathe in", seconds: 4, scale: IN },
  { label: "Hold", spoken: "Hold", seconds: 4, scale: IN },
  { label: "Exhale", spoken: "Breathe out", seconds: 4, scale: OUT },
  { label: "Hold", spoken: "Hold", seconds: 4, scale: OUT },
];

const HUE: Record<PhaseLabel, number> = { Inhale: 205, Hold: 268, Exhale: 30 };

const CYCLE_SECONDS = 16;
const VOICE_ON_KEY = "rebuilt.landing.voice.enabled";
const VOICE_MODE_KEY = "rebuilt.landing.voice.mode";

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === "1") return true;
  if (v === "0") return false;
  return fallback;
}

function readMode(fallback: VoiceMode): VoiceMode {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(VOICE_MODE_KEY);
  return v === "male" || v === "female" || v === "tones" ? v : fallback;
}

function pickVoice(gender: "male" | "female"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const bad = /espeak|compact|zarvox|fred|vicki|ralph|albert|junior|kathy|bells|bahh|cellos|good news|bad news|bubbles|deranged|hysterical|pipe organ|trinoids|whisper|boing/i;
  const maleNames = /(male|man|david|guy|mark|paul|daniel|thomas|alex|matthew|reed|george|james|ryan|aaron|arthur|eric|liam|noah|tom|jack|oliver)/i;
  const femaleNames = /(female|woman|samantha|ava|susan|karen|zira|allison|kate|serena|victoria|moira|tessa|fiona|amelie|helena|joanna|sarah|kimberly|lisa|emma|olivia|sophia|isabella)/i;
  const scored = voices
    .filter((v) => !bad.test(v.name))
    .map((v) => {
      const isMale = maleNames.test(v.name);
      const isFemale = femaleNames.test(v.name);
      if (gender === "male" && !isMale) return null;
      if (gender === "female" && !isFemale) return null;
      let s = 0;
      if (/natural|neural|premium|enhanced|online/i.test(v.name)) s += 5;
      if (/google|microsoft/i.test(v.name)) s += 2;
      if (v.localService) s += 1;
      if (/en[-_]/i.test(v.lang)) s += 2;
      return { v, s };
    })
    .filter((x): x is { v: SpeechSynthesisVoice; s: number } => x !== null)
    .sort((a, b) => b.s - a.s);
  return scored[0]?.v ?? null;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function BreatheTeaser() {
  const [length, setLength] = useState<Length>(1);
  const totalSeconds = length * 60;

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(PHASES[0].seconds);
  const [elapsed, setElapsed] = useState(0);

  const [voiceOn, setVoiceOn] = useState<boolean>(() => readBool(VOICE_ON_KEY, false));
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => readMode("female"));
  const [voiceReady, setVoiceReady] = useState(false);

  const reducedMotion = useRef(false);
  const tickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCueRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const check = () => setVoiceReady(!!pickVoice("male") || !!pickVoice("female"));
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VOICE_ON_KEY, voiceOn ? "1" : "0");
  }, [voiceOn]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VOICE_MODE_KEY, voiceMode);
  }, [voiceMode]);

  const speakCue = useCallback(
    (phase: Phase) => {
      if (!voiceOn) return;
      if (voiceMode === "tones") {
        try {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
          const ctx = audioCtxRef.current;
          if (ctx.state === "suspended") void ctx.resume();
          const freq = phase.label === "Inhale" ? 528 : phase.label === "Exhale" ? 432 : 396;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.05, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1);
        } catch { /* noop */ }
        return;
      }
      if (!window.speechSynthesis) return;
      const v = pickVoice(voiceMode);
      if (!v) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(phase.spoken);
        u.voice = v;
        u.rate = 0.75;
        u.pitch = voiceMode === "male" ? 0.85 : 0.95;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
      } catch { /* noop */ }
    },
    [voiceOn, voiceMode],
  );

  // Speak on each new phase while running.
  useEffect(() => {
    if (!running) return;
    const key = `${elapsed}-${phaseIdx}`;
    if (lastCueRef.current === key) return;
    lastCueRef.current = key;
    speakCue(PHASES[phaseIdx]);
  }, [running, phaseIdx, elapsed, speakCue]);

  // Ticker.
  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => {
        const ne = e + 1;
        if (ne >= totalSeconds) {
          setRunning(false);
          setDone(true);
          try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
          return totalSeconds;
        }
        return ne;
      });
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        setPhaseIdx((idx) => (idx + 1) % PHASES.length);
        return PHASES[(phaseIdx + 1) % PHASES.length].seconds;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [running, phaseIdx, totalSeconds]);

  function start() {
    if (done) reset();
    setStarted(true);
    setRunning(true);
  }
  function pause() {
    setRunning(false);
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }
  function reset() {
    setRunning(false);
    setStarted(false);
    setDone(false);
    setPhaseIdx(0);
    setSecondsLeft(PHASES[0].seconds);
    setElapsed(0);
    lastCueRef.current = "";
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }
  function changeLength(next: Length) {
    if (next === length) return;
    setLength(next);
    reset();
  }

  const phase = PHASES[phaseIdx];
  const hue = HUE[phase.label];
  const orbScale = done ? 0.95 : !started ? 0.9 : phase.scale;
  const orbTransition = reducedMotion.current
    ? "none"
    : "transform 1.6s cubic-bezier(0.4, 0, 0.2, 1), background 1.6s ease-in-out, box-shadow 1.6s ease-in-out";
  const glowTransition = reducedMotion.current
    ? "none"
    : "transform 1.6s ease-in-out, background 1.6s ease-in-out, opacity 0.6s ease-in-out";

  const remaining = Math.max(0, totalSeconds - elapsed);
  const progress = Math.min(100, (elapsed / totalSeconds) * 100);

  const paused = started && !running && !done;

  const lengths: Length[] = useMemo(() => [1, 3, 5], []);
  const voiceModes: { id: VoiceMode; label: string }[] = [
    { id: "female", label: "Female" },
    { id: "male", label: "Male" },
    { id: "tones", label: "Tones" },
  ];

  return (
    <section
      id="breathe"
      className="border-y border-foreground/10 bg-gradient-to-b from-transparent via-gold/[0.03] to-transparent"
    >
      <Reveal className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-24 text-center">
        <p className="label-mono text-gold inline-flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5" /> Breathe first. Try it now.
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-5xl leading-[1.05]">
          Box breathing. Right here.
        </h2>
        <p className="mt-3 text-foreground/70 max-w-xl mx-auto">
          From the REBUILT app &mdash; faith, fitness, accountability.
        </p>

        <div className="mt-8 rounded-3xl border border-foreground/10 bg-card/70 backdrop-blur p-6 sm:p-10 shadow-[0_20px_80px_-40px_rgba(212,175,55,0.35)]">
          {/* Length pills */}
          <div className="flex items-center justify-center gap-2">
            <span className="sr-only">Session length</span>
            <div className="inline-flex rounded-full border border-foreground/15 p-1 bg-background/40">
              {lengths.map((n) => {
                const active = length === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changeLength(n)}
                    className={`h-9 px-4 rounded-full text-xs label-mono transition ${
                      active ? "bg-gold text-black" : "text-foreground/70 hover:text-foreground"
                    }`}
                    aria-pressed={active}
                  >
                    {n} min
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice cues */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setVoiceOn((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[11px] label-mono transition ${
                voiceOn ? "border-gold/50 text-gold" : "border-foreground/15 text-foreground/60 hover:text-foreground"
              }`}
              aria-pressed={voiceOn}
            >
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              Voice cues {voiceOn ? "on" : "off"}
            </button>
            <div className={`inline-flex rounded-full border border-foreground/15 p-1 bg-background/40 transition ${voiceOn ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              {voiceModes.map((m) => {
                const active = voiceMode === m.id;
                const disabled = (m.id === "male" || m.id === "female") && !voiceReady;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVoiceMode(m.id)}
                    disabled={disabled}
                    className={`h-8 px-3 rounded-full text-[11px] label-mono transition ${
                      active ? "bg-foreground/10 text-foreground" : "text-foreground/60 hover:text-foreground"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    title={disabled ? "Voice not available in this browser" : undefined}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orb + orbiting dot */}
          <div className="mt-8 flex flex-col items-center">
            <div className="relative h-56 w-56 sm:h-72 sm:w-72 flex items-center justify-center">
              {/* Box path + orbiting dot */}
              <div
                aria-hidden
                className={`absolute inset-2 rounded-[28%] border border-gold/15 transition-opacity duration-500 ${
                  started && !done ? "opacity-100" : "opacity-0"
                }`}
              >
                <div
                  className="absolute h-3 w-3 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.9)]"
                  style={{
                    top: -6,
                    left: -6,
                    animation: running && !reducedMotion.current ? "rebuilt-box-orbit 16s linear infinite" : "none",
                  }}
                />
              </div>

              {/* Outer glow */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, hsla(${hue}, 85%, 62%, 0.35) 0%, hsla(${hue}, 85%, 62%, 0) 70%)`,
                  transform: `scale(${orbScale * 1.3})`,
                  transition: glowTransition,
                  filter: "blur(12px)",
                  opacity: started || done ? 1 : 0.5,
                }}
              />
              {/* Core orb */}
              <div
                className="relative h-40 w-40 sm:h-52 sm:w-52 rounded-full flex items-center justify-center border"
                style={{
                  background: `radial-gradient(circle at 35% 30%, hsla(${hue}, 90%, 78%, 0.9), hsla(${hue}, 85%, 45%, 0.6) 70%, hsla(${hue}, 85%, 30%, 0.4))`,
                  borderColor: `hsla(${hue}, 85%, 68%, 0.55)`,
                  boxShadow: `0 0 40px hsla(${hue}, 85%, 55%, 0.35), inset 0 0 20px hsla(${hue}, 85%, 80%, 0.25)`,
                  transform: `scale(${orbScale})`,
                  opacity: done ? 0.8 : 1,
                  transition: orbTransition,
                }}
              >
                <div className="text-center px-2 min-h-[3.75rem] flex flex-col items-center justify-center">
                  {!started && !done && (
                    <>
                      <p className="label-mono text-[10px] text-white/80 tracking-[0.3em]">READY</p>
                      <p className="font-display text-lg sm:text-xl text-white mt-1" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                        Box Breathing
                      </p>
                    </>
                  )}
                  {started && !done && (
                    <>
                      <p className="font-display text-2xl sm:text-3xl text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                        {phase.spoken}
                      </p>
                      <p className="mt-1 label-mono text-xs text-white/85 tabular-nums">{secondsLeft}s</p>
                    </>
                  )}
                  {done && (
                    <>
                      <p className="font-display text-2xl text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>Done.</p>
                      <p className="mt-1 label-mono text-xs text-white/85">Feel that?</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-6 w-full max-w-sm">
              <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-gold transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 label-mono text-[11px] text-foreground/60 tabular-nums">
                {fmt(remaining)} left
              </p>
            </div>

            {/* Buttons */}
            <div className="mt-6 flex flex-wrap gap-3 justify-center min-h-[3rem]">
              {!started && !done && (
                <button
                  type="button"
                  onClick={start}
                  className="h-12 px-10 rounded-full bg-gold text-black font-semibold text-sm shadow-[0_10px_40px_-10px_rgba(212,175,55,0.7)] hover:scale-[1.02] transition"
                >
                  Start
                </button>
              )}
              {running && (
                <button
                  type="button"
                  onClick={pause}
                  className="h-12 px-8 rounded-full border border-foreground/20 text-sm hover:border-foreground/40 transition"
                >
                  Pause
                </button>
              )}
              {paused && (
                <>
                  <button
                    type="button"
                    onClick={start}
                    className="h-12 px-8 rounded-full bg-gold text-black font-semibold text-sm shadow-[0_10px_40px_-10px_rgba(212,175,55,0.7)] hover:scale-[1.02] transition"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="h-12 px-6 rounded-full border border-foreground/20 text-sm hover:border-foreground/40 transition"
                  >
                    Reset
                  </button>
                </>
              )}
              {done && (
                <>
                  <button
                    type="button"
                    onClick={reset}
                    className="h-12 px-6 rounded-full border border-foreground/20 text-sm hover:border-foreground/40 transition"
                  >
                    Do it again
                  </button>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-gold text-black font-semibold text-sm shadow-[0_10px_40px_-10px_rgba(212,175,55,0.7)]"
                  >
                    Get the app <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>

            <p className="mt-6 max-w-md text-xs sm:text-sm text-foreground/60 leading-relaxed">
              Slow breathing shifts your nervous system out of fight-or-flight. Two minutes is enough to feel it.
            </p>
          </div>
        </div>

        {!done && (
          <div className="mt-6">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-gold transition"
            >
              Get the REBUILT app <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Reveal>

      <style>{`
        @keyframes rebuilt-box-orbit {
          0%   { top: -6px; left: -6px; }
          25%  { top: -6px; left: calc(100% - 6px); }
          50%  { top: calc(100% - 6px); left: calc(100% - 6px); }
          75%  { top: calc(100% - 6px); left: -6px; }
          100% { top: -6px; left: -6px; }
        }
      `}</style>
    </section>
  );
}
