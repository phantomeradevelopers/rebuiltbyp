import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Coach voices (gpt-4o-mini-tts supported voices).
// Men's track (Coach P) uses MALE-leaning voices. Angels track (Coach Grace)
// uses FEMALE-leaning voices. All voices are valid targets for the TTS call
// so the CoachSpeakerButton can pass any of them regardless of track.
export type CoachVoice =
  | "onyx" | "ash" | "echo" | "ballad"       // male — Coach P
  | "nova" | "shimmer" | "coral" | "sage";   // female — Coach Grace
export const COACH_VOICES_MEN: CoachVoice[] = ["onyx", "ash", "echo", "ballad"];
export const COACH_VOICES_ANGELS: CoachVoice[] = ["nova", "shimmer", "coral", "sage"];
export const COACH_VOICES: CoachVoice[] = [...COACH_VOICES_MEN, ...COACH_VOICES_ANGELS];
export const DEFAULT_COACH_VOICE: CoachVoice = "onyx";
export const DEFAULT_COACH_VOICE_ANGELS: CoachVoice = "nova";

/**
 * Text-to-speech for Coach P via the Lovable AI Gateway (openai/gpt-4o-mini-tts).
 *
 * INTEGRATION POINT (TTS provider):
 * - Endpoint: https://ai.gateway.lovable.dev/v1/audio/speech
 * - Auth:     LOVABLE_API_KEY (auto-provisioned; NEVER expose to client)
 * - Model:    openai/gpt-4o-mini-tts
 * - To use a different provider, swap the fetch below. Keep the return shape
 *   `{ audio: dataUrl | null, voice }` so callers/cache stay compatible.
 *
 * Returns a base64 data URL the browser can play directly. Browser memoizes
 * per `${voice}:${text}` so a line is generated at most once per voice.
 */
export const speakCoachLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string; voice?: CoachVoice }) => {
    const text = (data.text ?? "").toString().trim().slice(0, 1000);
    const voice = (COACH_VOICES.includes(data.voice as CoachVoice)
      ? data.voice
      : DEFAULT_COACH_VOICE) as CoachVoice;
    if (!text) throw new Error("No text to speak.");
    return { text, voice };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { audio: null as string | null, voice: data.voice };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        voice: data.voice,
        input: data.text,
        response_format: "mp3",
      }),
    });
    if (!r.ok) {
      console.error("tts gateway", r.status, await r.text().catch(() => ""));
      return { audio: null, voice: data.voice };
    }
    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return { audio: `data:audio/mpeg;base64,${b64}`, voice: data.voice };
  });
