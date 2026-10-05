import { useEffect, useState } from "react";
import {
  COACH_VOICES_MEN,
  COACH_VOICES_ANGELS,
  DEFAULT_COACH_VOICE,
  DEFAULT_COACH_VOICE_ANGELS,
  type CoachVoice,
} from "@/lib/tts.functions";
import {
  COACH_VOICE_STORAGE_KEY,
  COACH_VOICE_ANGELS_STORAGE_KEY,
  COACH_VOICE_MUTED_KEY,
  getStoredCoachVoice,
  isCoachVoiceMuted,
  CoachSpeakerButton,
} from "@/components/CoachSpeakerButton";
import { useTrack } from "@/lib/track";

const VOICE_DESC: Record<CoachVoice, string> = {
  onyx: "Deep, commanding",
  ash: "Rich baritone",
  echo: "Smooth, steady",
  ballad: "Warm mentor",
  nova: "Warm, luminous",
  shimmer: "Bright, uplifting",
  coral: "Soft, grounded",
  sage: "Wise, calm",
};

const SAMPLE_LINE_MEN = "Show up daily. I do the rest.";
const SAMPLE_LINE_ANGELS = "You are stronger than yesterday. One rep at a time.";

export function CoachVoiceSection() {
  const { track } = useTrack();
  const isAngels = track === "angels";
  const key = isAngels ? COACH_VOICE_ANGELS_STORAGE_KEY : COACH_VOICE_STORAGE_KEY;
  const defaultVoice = isAngels ? DEFAULT_COACH_VOICE_ANGELS : DEFAULT_COACH_VOICE;
  const voices = isAngels ? COACH_VOICES_ANGELS : COACH_VOICES_MEN;
  const sampleLine = isAngels ? SAMPLE_LINE_ANGELS : SAMPLE_LINE_MEN;
  const coachName = isAngels ? "Coach Grace" : "Coach P";

  const [voice, setVoice] = useState<CoachVoice>(defaultVoice);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setVoice(getStoredCoachVoice(track));
    setMuted(isCoachVoiceMuted());
  }, [track]);

  function pickVoice(v: CoachVoice) {
    setVoice(v);
    try { localStorage.setItem(key, v); } catch { /* ignore */ }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(COACH_VOICE_MUTED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-mono text-gold">{coachName}'s voice</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAngels ? "Grace" : "P"} speaks key lines aloud. Tap the speaker on any message to hear it.
          </p>
        </div>
        <button
          onClick={toggleMute}
          className={`h-9 px-3 rounded-full text-xs label-mono border ${
            muted
              ? "border-border bg-background text-muted-foreground"
              : "border-gold/50 bg-gold/5 text-gold"
          }`}
        >
          {muted ? "Muted" : "On"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {voices.map((v) => {
          const active = v === voice;
          return (
            <button
              key={v}
              onClick={() => pickVoice(v)}
              className={`rounded-md border p-3 text-left transition-colors ${
                active
                  ? "border-gold bg-gold/5"
                  : "border-border bg-background hover:border-gold/40"
              }`}
            >
              <p className={`text-sm font-medium capitalize ${active ? "text-gold" : "text-foreground"}`}>
                {v}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {VOICE_DESC[v]}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background/40 p-3">
        <CoachSpeakerButton text={sampleLine} voice={voice} />
        <p className="text-xs text-foreground/80 italic">"{sampleLine}"</p>
      </div>
    </section>
  );
}
