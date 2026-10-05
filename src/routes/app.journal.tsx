import { createFileRoute, Link } from "@tanstack/react-router";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Mic, Square, Loader2, MessageCircle, Info, Search, Wind, ChevronDown } from "lucide-react";
import { saveVoiceJournal, listVoiceJournals, generateJournalReply, markJournalReplyRead } from "@/lib/journal.functions";
import { MarkdownLite } from "@/components/MarkdownLite";
import { BreathingSheet } from "@/components/BreathingSheet";

import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/app/journal")({
  head: () => ({ meta: [{ title: "Journal — REBUILT" },{ name: "description", content: "Voice or text journal — reflect and stay honest." },{ property: "og:title", content: "Journal — REBUILT" },{ property: "og:description", content: "Voice or text journal — reflect and stay honest." },] }),
  component: JournalPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

type JournalReply = { id: string; journal_id: string; content: string; is_read: boolean; created_at: string; recommend_breathing: boolean };


type JournalRow = {
  id: string;
  created_at: string;
  summary: string | null;
  emotion_tags: string[] | null;
  duration_seconds: number | null;
};

// Web Speech API typings (browser-specific, not in lib.dom)
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function JournalPage() {
  const smartBack = useSmartBack("/app");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [replies, setReplies] = useState<JournalReply[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [breathingOpen, setBreathingOpen] = useState(false);
  

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);

  async function load() {
    try {
      const res = await listVoiceJournals();
      setJournals(res.journals as JournalRow[]);
      setReplies((res.replies ?? []) as JournalReply[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => { void load(); }, []);

  async function start() {
    setTranscript("");
    setInterim("");
    blobRef.current = null;
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(500);
      mediaRecorderRef.current = mr;

      const SR = getSpeechRecognition();
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (e) => {
          let finalText = "";
          let interimText = "";
          for (const r of e.results) {
            if (r.isFinal) finalText += r[0].transcript;
            else interimText += r[0].transcript;
          }
          if (finalText) setTranscript((t) => (t + " " + finalText).trim());
          setInterim(interimText);
        };
        rec.onerror = () => { /* swallow; user can still type */ };
        rec.start();
        recognitionRef.current = rec;
      }

      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 250);
      setRecording(true);
    } catch (e) {
      toast.error("Microphone permission denied.");
      console.error(e);
    }
  }

  function stop() {
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
  }

  async function save() {
    const fullTranscript = (transcript + " " + interim).trim();
    if (!fullTranscript) { toast.error("Nothing to save. Speak or type something."); return; }
    setBusy(true);
    try {
      const blob = blobRef.current;
      let audio_base64: string | undefined;
      let audio_mime: string | undefined;
      // Cap audio upload at ~4MB raw to keep request size reasonable
      if (blob && blob.size < 4 * 1024 * 1024) {
        const buf = await blob.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        audio_base64 = btoa(bin);
        audio_mime = blob.type || "audio/webm";
      }
      const res = await saveVoiceJournal({
        data: {
          transcript: fullTranscript,
          duration_seconds: elapsed || undefined,
          audio_base64,
          audio_mime,
        },
      });
      toast.success("Journal saved. P is reading it…");
      setTranscript("");
      setInterim("");
      setElapsed(0);
      blobRef.current = null;
      void load();
      // Fire off coach reply generation, then refresh
      if (res?.id) {
        generateJournalReply({ data: { journalId: res.id } })
          .then(() => { void load(); })
          .catch((e) => { console.warn("journal reply failed", e); });
      }
      return res;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const SR = getSpeechRecognition();

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-8">
      <header>
        <button onClick={smartBack} className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="label-mono text-primary mt-3 text-xs uppercase tracking-[0.18em] font-semibold">Voice journal</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight font-semibold">What's on your mind?</h1>
        <button
          type="button"
          onClick={() => setShowIntro((s) => !s)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" /> {showIntro ? "Hide" : "What is this?"}
        </button>
      </header>

      {(showIntro || journals.length < 3) && (
        <section className="card-elevated p-5 border border-primary/30 bg-primary/5 space-y-2">
          <p className="font-semibold text-base">Your private voice journal.</p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            Talk for 30 seconds to 5 minutes about anything — what's on your mind,
            what's working, what's not. P (your coach) reads every entry and writes
            back, usually within a minute. Nobody else sees it. Over time these
            entries help P spot patterns and adjust your plan.
          </p>
        </section>
      )}

      <section className="card-elevated p-6 text-center space-y-4">
        <button
          onClick={recording ? stop : start}
          disabled={busy}
          className={`mx-auto h-24 w-24 rounded-full inline-flex items-center justify-center transition-all ${
            recording ? "bg-destructive shadow-[0_0_40px_-6px_rgba(239,68,68,0.6)] animate-pulse" : "btn-gold"
          }`}
        >
          {recording ? <Square className="h-8 w-8" fill="currentColor" /> : <Mic className="h-9 w-9" />}
        </button>
        <p className="label-mono text-2xl">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </p>
        {!SR && (
          <p className="text-xs text-muted-foreground">
            Live transcription not supported on this browser — type below or save the audio.
          </p>
        )}
      </section>

      <section className="card-elevated p-5 space-y-3">
        <label className="text-xs text-muted-foreground">Transcript {interim && <span className="text-gold/60">· listening…</span>}</label>
        <textarea
          rows={6}
          value={transcript + (interim ? " " + interim : "")}
          onChange={(e) => { setTranscript(e.target.value); setInterim(""); }}
          placeholder="Speak or type. Anything on your mind."
          className="w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
        />
        <button
          onClick={save}
          disabled={busy || recording || !(transcript.trim() || interim.trim())}
          className="btn-gold h-12 w-full rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving</> : "Save journal"}
        </button>
      </section>

      {journals.length > 0 && <ArchiveSection
        journals={journals}
        replies={replies}
        search={search}
        setSearch={setSearch}
        expanded={expanded}
        setExpanded={setExpanded}


        setReplies={setReplies}
        onOpenBreathing={() => setBreathingOpen(true)}
      />}

      {breathingOpen && <BreathingSheet onClose={() => setBreathingOpen(false)} />}
    </div>
  );

}

type JournalRowFull = JournalRow;

function groupBucket(d: Date): "Today" | "Yesterday" | "This week" | "Earlier" {
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86_400_000;
  const diff = Math.floor((start(now) - start(d)) / dayMs);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

function ArchiveSection({
  journals, replies, search, setSearch, expanded, setExpanded, setReplies, onOpenBreathing,
}: {
  journals: JournalRowFull[];
  replies: JournalReply[];
  search: string;
  setSearch: (s: string) => void;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  setReplies: React.Dispatch<React.SetStateAction<JournalReply[]>>;
  onOpenBreathing: () => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return journals;
    return journals.filter((j) => {
      const inSummary = (j.summary ?? "").toLowerCase().includes(q);
      const inTags = (j.emotion_tags ?? []).some((t) => t.toLowerCase().includes(q));
      return inSummary || inTags;
    });
  }, [journals, search]);

  // Group by bucket while preserving server order (already desc by created_at)
  const groups = useMemo(() => {
    const m = new Map<string, JournalRowFull[]>();
    for (const j of filtered) {
      const k = groupBucket(new Date(j.created_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(j);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="label-mono text-primary text-xs uppercase tracking-[0.18em] font-semibold">Archive</p>
        <p className="text-xs text-foreground/60">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/50" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your journals…"
          className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-input text-sm focus:border-gold focus:outline-none"
        />
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-foreground/60 italic px-1">No entries match.</p>
      )}

      {groups.map(([bucket, items]) => (
        <div key={bucket} className="space-y-2">
          <p className="label-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55 font-semibold px-1">{bucket}</p>
          {items.map((j) => {
            const reply = replies.find((r) => r.journal_id === j.id);
            const isOpen = expanded[j.id] ?? false;
            return (
              <article key={j.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((e) => ({ ...e, [j.id]: !isOpen }));
                    if (reply && !reply.is_read) {
                      markJournalReplyRead({ data: { replyId: reply.id } }).catch(() => {});
                      setReplies((rs) => rs.map((r) => r.id === reply.id ? { ...r, is_read: true } : r));
                    }
                  }}
                  className="w-full text-left p-4 active:bg-card/70 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="label-mono text-[11px] text-foreground/70 font-semibold">
                        {new Date(j.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {j.duration_seconds ? ` · ${j.duration_seconds}s` : ""}
                        {reply && !reply.is_read && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" aria-label="unread" />}
                      </p>
                      <p className="mt-1.5 text-sm leading-snug line-clamp-2">{j.summary || "(no summary)"}</p>
                      {j.emotion_tags && j.emotion_tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {j.emotion_tags.slice(0, 4).map((t) => (
                            <span key={t} className="px-1.5 h-5 inline-flex items-center rounded-full bg-primary/10 border border-primary/30 text-[10px] text-primary font-medium">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-foreground/60 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/60 pt-3 space-y-3">
                    {reply ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-primary" />
                          <span className="label-mono text-xs uppercase tracking-[0.14em] text-primary font-semibold">P</span>
                        </div>
                        <MarkdownLite className="mt-2 text-sm text-foreground/90 space-y-2">
                          {reply.content}
                        </MarkdownLite>
                        {reply.recommend_breathing && (
                          <button
                            type="button"
                            onClick={onOpenBreathing}
                            className="mt-3 w-full h-11 rounded-md border border-gold/50 bg-primary/5 text-sm font-medium text-primary inline-flex items-center justify-center gap-2 hover:bg-primary/10"
                          >
                            <Wind className="h-4 w-4" /> Start 2-min breathing
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/60 italic">P is reading this — reply usually within a minute.</p>
                    )}

                  </div>
                )}
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}


