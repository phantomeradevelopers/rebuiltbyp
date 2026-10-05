import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Speech-to-text for Coach P via the Lovable AI Gateway (openai/gpt-4o-mini-transcribe).
 *
 * INTEGRATION POINT (STT provider):
 * - Endpoint: https://ai.gateway.lovable.dev/v1/audio/transcriptions
 * - Auth:     LOVABLE_API_KEY (auto-provisioned; NEVER expose to client)
 * - Model:    openai/gpt-4o-mini-transcribe
 * - Client sends a base64 data URL (e.g. `data:audio/webm;base64,...`).
 *   The mime tells us the container so we name the upload correctly
 *   (OpenAI infers format from extension).
 * - To swap providers, replace the fetch below and keep the return shape
 *   `{ text }` so the coach composer stays compatible.
 */
export const transcribeCoachAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audio: string }) => {
    const audio = (data.audio ?? "").toString();
    if (!audio.startsWith("data:")) throw new Error("Bad audio payload.");
    return { audio };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Voice input is not configured.");

    // Parse `data:audio/webm;base64,....`
    const match = /^data:([^;]+);base64,(.*)$/.exec(data.audio);
    if (!match) throw new Error("Bad audio payload.");
    const mime = match[1];
    const b64 = match[2];
    const bytes = Buffer.from(b64, "base64");
    if (bytes.byteLength < 2048) {
      throw new Error("That recording was empty — please try again.");
    }
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
      "audio/m4a": "m4a",
    };
    const baseMime = mime.split(";")[0];
    const ext = extMap[baseMime] ?? "webm";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append(
      "file",
      new Blob([new Uint8Array(bytes)], { type: baseMime }),
      `recording.${ext}`,
    );

    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("stt gateway", r.status, err);
      throw new Error("Could not transcribe that. Try again.");
    }
    const json = (await r.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
