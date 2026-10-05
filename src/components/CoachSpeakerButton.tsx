import { useEffect, useRef, useState } from "react";
import { Volume2, Loader2, Pause } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  speakCoachLine,
  DEFAULT_COACH_VOICE,
  DEFAULT_COACH_VOICE_ANGELS,
  type CoachVoice,
  COACH_VOICES,
} from "@/lib/tts.functions";
import type { Track } from "@/lib/track.functions";

export const COACH_VOICE_STORAGE_KEY = "rebuilt_coach_voice_v1";
export const COACH_VOICE_ANGELS_STORAGE_KEY = "rebuilt_coach_voice_angels_v1";
export const COACH_VOICE_MUTED_KEY = "rebuilt_coach_voice_muted_v1";

export function getStoredCoachVoice(track?: Track | null): CoachVoice {
  const isAngels = track === "angels";
  const key = isAngels ? COACH_VOICE_ANGELS_STORAGE_KEY : COACH_VOICE_STORAGE_KEY;
  const fallback = isAngels ? DEFAULT_COACH_VOICE_ANGELS : DEFAULT_COACH_VOICE;
  if (typeof localStorage === "undefined") return fallback;
  const v = localStorage.getItem(key) as CoachVoice | null;
  return v && COACH_VOICES.includes(v) ? v : fallback;
}

export function isCoachVoiceMuted(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(COACH_VOICE_MUTED_KEY) === "1";
}

// Browser-side memo: same voice+text → one server call ever.
const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

/**
 * Speaker icon next to a Coach P line. Click to generate + play via OpenAI
 * TTS (user's chosen voice). Falls back silently when no API key is set —
 * button shows but produces no audio so text remains the source of truth.
 */
export function CoachSpeakerButton({
  text,
  voice,
  track,
  className = "",
}: {
  text: string;
  voice?: CoachVoice;
  track?: Track | null;
  className?: string;
}) {
  const fn = useServerFn(speakCoachLine);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (currentAudio === audioRef.current) currentAudio = null;
  }, []);

  async function onClick() {
    if (isCoachVoiceMuted()) return;
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    const v = voice ?? getStoredCoachVoice(track);
    const key = `${v}:${text}`;
    setState("loading");
    try {
      let url = audioCache.get(key);
      if (!url) {
        const res = await fn({ data: { text, voice: v } });
        if (!res.audio) {
          // No API key on server — text-only mode. Do nothing visible.
          setState("idle");
          return;
        }
        url = res.audio;
        audioCache.set(key, url);
      }
      // Stop any other line that's currently speaking.
      currentAudio?.pause();
      const a = new Audio(url);
      audioRef.current = a;
      currentAudio = a;
      a.onended = () => {
        setState("idle");
        if (currentAudio === a) currentAudio = null;
      };
      a.onpause = () => setState("idle");
      await a.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }

  const Icon = state === "loading" ? Loader2 : state === "playing" ? Pause : Volume2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={state === "playing" ? "Pause Coach P" : "Hear Coach P"}
      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-gold transition-colors ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
    </button>
  );
}
