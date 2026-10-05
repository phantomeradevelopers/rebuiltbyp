import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playChime } from "@/lib/sound";

type Protocol = "4-7-8" | "box";
type Phase = { label: string; seconds: number; scale: number };

// Same phase-color language as /app/breathe so the two feel like one product.
const HUE: Record<string, number> = {
  Inhale: 205,
  Hold: 268,
  Exhale: 30,
};
// Angels: warmer/rosier orb tints.
const HUE_ANGELS: Record<string, number> = {
  Inhale: 350,
  Hold: 320,
  Exhale: 25,
};
function pickHue(label: string): number {
  const isAngels =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-track") === "angels";
  return (isAngels ? HUE_ANGELS[label] : HUE[label]) ?? 45;
}


const IN = 1.14;
const OUT = 0.86;

const PHASES: Record<Protocol, Phase[]> = {
  "4-7-8": [
    { label: "Inhale", seconds: 4, scale: IN },
    { label: "Hold", seconds: 7, scale: IN },
    { label: "Exhale", seconds: 8, scale: OUT },
  ],
  box: [
    { label: "Inhale", seconds: 4, scale: IN },
    { label: "Hold", seconds: 4, scale: IN },
    { label: "Exhale", seconds: 4, scale: OUT },
    { label: "Hold", seconds: 4, scale: OUT },
  ],
};

const CUE: Record<string, string> = {
  Inhale: "Breathe in",
  Hold: "Hold",
  Exhale: "Let it out slow",
};

const VOICE_KEY = "rebuilt.spirit.voice";
type VoiceMode = "male" | "female" | "tones";

function readVoicePref(): VoiceMode {
  if (typeof window === "undefined") return "male";
  const v = window.localStorage.getItem(VOICE_KEY);
  if (v === "male" || v === "female" || v === "tones") return v;
  return "tones";
}

function pickVoice(gender: "male" | "female"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const bad = /espeak|compact|zarvox|fred|vicki|ralph|albert|junior|kathy|bells|bahh|cellos|good news|bad news|bubbles|deranged|hysterical|pipe organ|trinoids|whisper|boing|bells/i;
  const maleNames = /(male|man|david|guy|mark|paul|daniel|thomas|alex|fred|matthew|reed|george|james|ryan|aaron|arthur|eric|liam|noah|tom|jack|oliver)/i;
  const femaleNames = /(female|woman|samantha|ava|susan|karen|zira|allison|kate|serena|victoria|moira|tessa|fiona|amelie|helena|joanna|sarah|kimberly|lisa|emma|olivia|sophia|isabella)/i;
  const scored = voices
    .filter((v) => !bad.test(v.name))
    .map((v) => {
      const isMale = maleNames.test(v.name);
      const isFemale = femaleNames.test(v.name);
      const wantsMale = gender === "male";
      if (wantsMale && !isMale) return null;
      if (!wantsMale && !isFemale) return null;
      let score = 0;
      if (/natural|neural|premium|enhanced|online/i.test(v.name)) score += 5;
      if (v.localService) score += 1;
      if (/google|microsoft/i.test(v.name)) score += 2;
      return { v, score };
    })
    .filter((x): x is { v: SpeechSynthesisVoice; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? null;
}

function speak(mode: VoiceMode, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (mode === "tones") return;
  const voice = pickVoice(mode);
  if (!voice) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.rate = 0.88;
    u.pitch = mode === "male" ? 0.92 : 1.05;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/**
 * Guided breathing — premium orb style, same visual DNA as /app/breathe.
 * Respects prefers-reduced-motion. Optional voice cues (male / female / tones).
 */
export function BreathExercise({ protocol = "4-7-8", cycles = 4, onComplete }: { protocol?: Protocol; cycles?: number; onComplete?: () => void }) {
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(PHASES[protocol][0].seconds);
  const [cycleNo, setCycleNo] = useState(0);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => readVoicePref());
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const tickRef = useRef<number | null>(null);
  const reducedMotion = useRef(false);
  const finishedRef = useRef(false);
  const lastCueRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const check = () => setVoiceAvailable(!!pickVoice("male") || !!pickVoice("female"));
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VOICE_KEY, voiceMode);
  }, [voiceMode]);

  useEffect(() => {
    if (cycleNo >= cycles && !finishedRef.current) {
      finishedRef.current = true;
      playChime("singing_bowl");
      onComplete?.();
    }
  }, [cycleNo, cycles, onComplete]);

  const phase = PHASES[protocol][phaseIdx];

  // Speak the cue once per new phase while running.
  useEffect(() => {
    if (!running || finishedRef.current) return;
    const key = `${cycleNo}-${phaseIdx}`;
    if (lastCueRef.current === key) return;
    lastCueRef.current = key;
    const text = CUE[phase.label] ?? phase.label;
    if (voiceMode !== "tones" && voiceAvailable) speak(voiceMode, text);
    else playChime(phase.label === "Exhale" ? "singing_bowl" : "singing_bowl");
  }, [running, phaseIdx, cycleNo, phase.label, voiceMode, voiceAvailable]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        setPhaseIdx((idx) => {
          const next = idx + 1;
          if (next >= PHASES[protocol].length) {
            setCycleNo((n) => {
              const nn = n + 1;
              if (nn >= cycles) { setRunning(false); return nn; }
              return nn;
            });
            return 0;
          }
          return next;
        });
        return PHASES[protocol][(phaseIdx + 1) % PHASES[protocol].length].seconds;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [running, protocol, cycles, phaseIdx]);

  function reset() {
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    setRunning(false); setPhaseIdx(0); setCycleNo(0); setSecondsLeft(PHASES[protocol][0].seconds);
    finishedRef.current = false;
    lastCueRef.current = "";
  }

  const finished = cycleNo >= cycles;
  const hue = pickHue(phase.label);
  const scale = finished ? 0.95 : phase.scale;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <div className="flex items-center justify-between mb-2">
        <p className="label-mono text-gold">Breath · {protocol}</p>
        <button
          type="button"
          onClick={() => setVoiceMode(voiceMode === "tones" ? "male" : "tones")}
          className="inline-flex items-center gap-1 text-[11px] label-mono text-muted-foreground hover:text-gold"
          aria-label="Toggle voice cues"
        >
          {voiceMode === "tones" ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {voiceMode === "tones" ? "Silent" : "Voice"}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <div className="relative h-40 w-40 flex items-center justify-center">
          {/* Outer glow */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, hsla(${hue}, 85%, 62%, 0.35) 0%, hsla(${hue}, 85%, 62%, 0) 70%)`,
              transform: `scale(${scale * 1.3})`,
              transition: reducedMotion.current ? "none" : "transform 1.6s ease-in-out, background 1.6s ease-in-out",
              filter: "blur(12px)",
            }}
          />
          {/* Core orb */}
          <div
            className="relative h-32 w-32 rounded-full flex items-center justify-center border"
            style={{
              background: `radial-gradient(circle at 35% 30%, hsla(${hue}, 90%, 78%, 0.9), hsla(${hue}, 85%, 45%, 0.6) 70%, hsla(${hue}, 85%, 30%, 0.4))`,
              borderColor: `hsla(${hue}, 85%, 68%, 0.55)`,
              boxShadow: `0 0 40px hsla(${hue}, 85%, 55%, 0.35), inset 0 0 20px hsla(${hue}, 85%, 80%, 0.25)`,
              transform: `scale(${scale})`,
              opacity: finished ? 0.75 : 1,
              transition: reducedMotion.current ? "none" : "transform 1.6s cubic-bezier(0.4, 0, 0.2, 1), background 1.6s ease-in-out, box-shadow 1.6s ease-in-out",
            }}
          >
            <div className="text-center">
              <p className="font-display text-2xl text-white drop-shadow" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                {finished ? "Done" : phase.label}
              </p>
              {!finished && (
                <p className="label-mono text-xs mt-1 text-white/85 tabular-nums">{secondsLeft}s</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!finished && (
        <p className="mt-4 text-xs text-muted-foreground">
          {CUE[phase.label] ?? phase.label}… · Cycle {Math.min(cycleNo + (running ? 1 : 0), cycles)} of {cycles}
        </p>
      )}

      <div className="mt-4 flex gap-2 justify-center">
        {!running && cycleNo < cycles && (
          <button onClick={() => setRunning(true)} className="btn-gold h-11 px-6 rounded-md text-sm font-medium">
            {cycleNo === 0 ? "Start" : "Resume"}
          </button>
        )}
        {running && (
          <button onClick={() => setRunning(false)} className="h-11 px-6 rounded-md border border-border text-sm">
            Pause
          </button>
        )}
        {cycleNo > 0 && (
          <button onClick={reset} className="h-11 px-6 rounded-md border border-border text-sm">
            Reset
          </button>
        )}
      </div>

      {/* Voice picker — only when voice is chosen */}
      {voiceMode !== "tones" && (
        <div className="mt-4 inline-flex rounded-full border border-border p-0.5 text-[11px] label-mono" role="radiogroup" aria-label="Voice">
          {(["male", "female", "tones"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={voiceMode === m}
              onClick={() => setVoiceMode(m)}
              className={`px-3 h-7 rounded-full transition-colors ${voiceMode === m ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "tones" ? "Silent" : m === "male" ? "Male" : "Female"}
            </button>
          ))}
        </div>
      )}
      {voiceMode !== "tones" && !voiceAvailable && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          No premium voice on this device — playing gentle tones instead.
        </p>
      )}

      {finished && !running && (
        <p className="mt-4 font-display text-base text-gold">
          Done. Carry that with you.
        </p>
      )}
    </div>
  );
}
