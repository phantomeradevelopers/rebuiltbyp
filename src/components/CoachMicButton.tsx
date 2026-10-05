import { useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { transcribeCoachAudio } from "@/lib/stt.functions";

type State = "idle" | "recording" | "transcribing";

/**
 * Mic button for the Coach P composer. Records mic audio via MediaRecorder,
 * uploads a self-contained webm/mp4 blob to the server-side STT function
 * (Lovable AI Gateway → openai/gpt-4o-mini-transcribe), and hands the
 * transcribed text back through onTranscript so the composer can prefill.
 *
 * INTEGRATION POINT (STT): swap the provider inside
 * `src/lib/stt.functions.ts` — this component stays the same.
 */
export function CoachMicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const fn = useServerFn(transcribeCoachAudio);
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    if (state !== "idle") return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed to talk to P.");
      return;
    }
    streamRef.current = stream;
    const mime =
      MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 2048) {
        toast.error("That was too short — try again.");
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const dataUrl = await blobToDataUrl(blob);
        const { text } = await fn({ data: { audio: dataUrl } });
        if (text) onTranscript(text);
        else toast.error("Didn't catch that. Try again.");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setState("idle");
      }
    };
    recorderRef.current = rec;
    rec.start();
    setState("recording");
  }

  function stop() {
    recorderRef.current?.stop();
  }

  const label =
    state === "recording" ? "Stop recording" : state === "transcribing" ? "Transcribing…" : "Talk to P";
  const Icon = state === "recording" ? Square : state === "transcribing" ? Loader2 : Mic;

  return (
    <button
      type="button"
      onClick={state === "recording" ? stop : start}
      disabled={disabled || state === "transcribing"}
      aria-label={label}
      title={label}
      className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${
        state === "recording"
          ? "bg-red-500/15 text-red-400 border border-red-500/40 animate-pulse"
          : "border border-[color:var(--rebuilt-gold)]/40 text-[color:var(--text-secondary)] hover:text-[color:var(--rebuilt-gold)] hover:border-[color:var(--rebuilt-gold)]"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Icon className={`h-4 w-4 ${state === "transcribing" ? "animate-spin" : ""}`} />
    </button>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read audio."));
    r.readAsDataURL(blob);
  });
}
