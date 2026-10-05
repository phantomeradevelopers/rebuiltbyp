import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  getOrCreateConversation,
  getMessages,
  sendCoachMessage,
  type CoachMessage,
} from "@/lib/coach.functions";
import { BackToTodayPill } from "@/components/BackToTodayPill";
import { VacationBanner } from "@/components/VacationBanner";
import { CoachProposalCard, parseCoachProposal } from "@/components/coach/CoachProposalCard";
import { CoachSpeakerButton } from "@/components/CoachSpeakerButton";
import { CoachMicButton } from "@/components/CoachMicButton";
import { getWelcomeStatus } from "@/lib/welcome.functions";
import { nextWelcomeStep, isWelcomeFlagged, WELCOME_FLAG } from "@/lib/welcome-flow";
import { useIdleNudge } from "@/hooks/useIdleNudge";
import { RouteError } from "@/components/RouteError";
import { useTrack } from "@/lib/track";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

// EXCEPTION: We keep the existing `sendCoachMessage` serverFn streaming transport
// (async-iterable of `{ delta }`) instead of swapping to AI SDK's `useChat` +
// HTTP `/api/chat` route. The streaming endpoint, system prompt, and persisted
// conversations live behind the serverFn and migrating would break existing
// conversations. AI Elements primitives are used for every visible surface
// (Conversation, Message, MessageResponse, PromptInput, Shimmer).

export const Route = createFileRoute("/app/coach")({
  head: () => ({ meta: [{ title: "Coach — REBUILT" },{ name: "description", content: "Talk with your coach for guidance and daily direction." },{ property: "og:title", content: "Coach — REBUILT" },{ property: "og:description", content: "Talk with your coach for guidance and daily direction." },] }),
  component: Coach,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

const SUGGESTED_PROMPTS_MEN: string[] = [
  "My energy and drive are tanking — could it be low T?",
  "I want to lose 20 lb. Is a GLP-1 like semaglutide right for me?",
  "ED is creeping in — what are my real options?",
  "What does NAD+ actually do, and is it worth it?",
  "I'm losing hair. What actually works?",
  "I can't fall asleep — what should I try first?",
];

const SUGGESTED_PROMPTS_ANGELS: string[] = [
  "I want to lose 15 lb without wrecking my energy — where do I start?",
  "How do I know if he's a green flag or a red flag?",
  "Perimenopause is hitting hard — what should I actually ask my doctor?",
  "My skin is dull and breaking out — what actually works?",
  "I keep losing hair after my last baby — real options?",
  "How do I hold my standards without being harsh?",
];

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

function Coach() {
  const navigate = useNavigate();
  const { track } = useTrack();
  const isAngels = track === "angels";
  const coachName = isAngels ? "Grace" : "P";
  const coachTitle = isAngels ? "Coach Grace" : "Coach P";
  const suggestedPrompts = isAngels ? SUGGESTED_PROMPTS_ANGELS : SUGGESTED_PROMPTS_MEN;
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [streaming, setStreaming] = useState<string>("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const composerRef = useRef<HTMLDivElement>(null);
  const getTextarea = () =>
    composerRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="message"]') ?? null;
  const sendFn = useServerFn(sendCoachMessage);

  useIdleNudge({
    active: messages.length === 0 && !streaming && !isWelcomeFlagged(),
    message: "Type one thing on your mind, or tap a suggested prompt.",
    ctaSelector: "textarea",
  });

  function skipForNow() {
    try { localStorage.setItem(WELCOME_FLAG, "1"); } catch { /* ignore */ }
    navigate({ to: "/app/welcome" as never });
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { conversationId } = await getOrCreateConversation({ data: {} });
        if (ignore) return;
        setConvId(conversationId);
        const msgs = await getMessages({ data: { conversationId } });
        if (ignore) return;
        setMessages(msgs);
      } catch (e) {
        if (!ignore) toast.error((e as Error).message);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Keep composer focused for normal chat use (initial + after sends/thread switches).
  useEffect(() => {
    if (status === "ready") {
      requestAnimationFrame(() => getTextarea()?.focus());
    }
  }, [status, convId]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!convId || !trimmed || status !== "ready") return;
    const wasFirst = messages.length === 0;
    const optimistic: CoachMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setStatus("submitted");
    setStreaming("");
    try {
      const stream = await sendFn({ data: { conversationId: convId, content: trimmed } });
      let acc = "";
      let started = false;
      for await (const chunk of stream as AsyncIterable<{ delta: string }>) {
        acc += chunk.delta;
        if (!started) {
          started = true;
          setStatus("streaming");
        }
        setStreaming(acc);
      }
      setMessages((m) => [...m, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: acc,
        created_at: new Date().toISOString(),
      }]);
      setStreaming("");
      setStatus("ready");
      if (wasFirst && !isWelcomeFlagged()) {
        try {
          const s = await getWelcomeStatus();
          const next = nextWelcomeStep(s, "coach");
          navigate({ to: (next ?? "/app/welcome") as never });
        } catch {
          navigate({ to: "/app/welcome" as never });
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FREE_LIMIT_REACHED") {
        toast.error(`You've used today's 5 free ${coachTitle} messages.`, {
          action: {
            label: "Upgrade",
            onClick: () => { window.location.href = "/app/upgrade?feature=coach_unlimited"; },
          },
        });
      } else {
        toast.error(msg);
      }
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setStatus("ready");
    }
  }

  async function newConvo() {
    try {
      const { conversationId } = await getOrCreateConversation({ data: { forceNew: true } });
      setConvId(conversationId);
      setMessages([]);
      setStreaming("");
      setStatus("ready");
    } catch (e) { toast.error((e as Error).message); }
  }

  function pickPrompt(p: string) {
    const ta = getTextarea();
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(ta, p);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
    }
  }

  function handleSubmit(message: PromptInputMessage) {
    const text = (message.text ?? "").trim();
    if (!text) return;
    const ta = getTextarea();
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(ta, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    void send(text);
  }

  const isEmpty = messages.length === 0 && !streaming && status === "ready";

  return (
    <div className="flex flex-col h-dvh">
      <div className="w-full max-w-2xl mx-auto px-4 pt-3">
        <VacationBanner />
        <BackToTodayPill />
      </div>

      <header className="w-full max-w-2xl mx-auto px-6 pt-6 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">
            Coach
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-[color:var(--text-primary)] leading-tight">
            Talk to {coachName}
          </h1>
        </div>
        <button
          onClick={newConvo}
          title="New conversation"
          className="h-11 w-11 shrink-0 rounded-full border border-[color:var(--rebuilt-gold)]/40 text-[color:var(--text-secondary)] flex items-center justify-center hover:border-[color:var(--rebuilt-gold)] hover:text-[color:var(--rebuilt-gold)] active:scale-95 transition-all"
          aria-label="New conversation"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>
      <div
        className="w-full max-w-2xl mx-auto h-px bg-[color:var(--border-strong,rgba(255,255,255,0.06))]"
        style={{ width: "calc(100% - 3rem)" }}
      />

      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="w-full max-w-2xl mx-auto px-4 py-5 space-y-4">
          {isEmpty && (
            <div className="text-center py-10">
              <p className="font-display text-3xl font-semibold text-[color:var(--text-primary)]">
                What's on your mind?
              </p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                Training. Food. Faith. Recovery. The bad day. Ask.
              </p>
              {!isWelcomeFlagged() && (
                <button
                  type="button"
                  onClick={skipForNow}
                  className="mt-5 text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--text-tertiary)] hover:text-[color:var(--rebuilt-gold)] underline-offset-4 hover:underline"
                >
                  Skip for now
                </button>
              )}
            </div>
          )}

          {messages.map((m) => (
            <CoachBubble
              key={m.id}
              role={m.role}
              content={m.content}
              conversationId={convId}
              messageId={m.id}
              track={track}
            />
          ))}

          {streaming && <CoachBubble role="assistant" content={streaming} streaming track={track} />}

          {status === "submitted" && !streaming && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        className="px-4 pt-3 bg-background/95 backdrop-blur border-t border-border/40"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-full max-w-2xl mx-auto">
          {/* Suggested prompts — always visible */}
          <div className="mb-2 -mx-1 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => pickPrompt(p)}
                aria-label={`Use suggestion: ${p}`}
                className="snap-start shrink-0 max-w-[280px] text-left text-xs px-3 py-2 rounded-full border border-[color:var(--border-strong,rgba(255,255,255,0.08))] bg-[color:var(--bg-raised)] text-[color:var(--text-secondary)] hover:border-[color:var(--rebuilt-gold)] hover:text-[color:var(--rebuilt-gold-bright)] active:scale-[0.98] transition-all whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {p}
              </button>
            ))}
          </div>

          <div ref={composerRef}>
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea placeholder={`Ask ${coachName}…`} autoCapitalize="sentences" disabled={!convId} />
              <PromptInputFooter className="justify-between">
                <CoachMicButton onTranscript={pickPrompt} disabled={!convId || status !== "ready"} />
                <PromptInputSubmit status={status} disabled={!convId || status !== "ready"} />
              </PromptInputFooter>
            </PromptInput>
          </div>

          <p className="mt-2 text-[10px] text-center text-muted-foreground">
            {coachName} is a coach, not a doctor. <a href="/legal" className="underline hover:text-foreground">Disclaimer</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function CoachBubble({
  role,
  content,
  streaming,
  conversationId,
  messageId,
  track,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  conversationId?: string | null;
  messageId?: string | null;
  track?: import("@/lib/track.functions").Track | null;
}) {
  const isUser = role === "user";
  const { prose, proposal } = !isUser && !streaming
    ? parseCoachProposal(content)
    : { prose: content, proposal: null };

  return (
    <Message from={role}>
      <MessageContent>
        {isUser ? (
          <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">{prose}</span>
        ) : (
          <MessageResponse>{prose}</MessageResponse>
        )}
        {streaming && (
          <span
            aria-hidden
            className="inline-block w-1.5 h-3.5 ml-1 bg-[color:var(--rebuilt-gold)] animate-pulse align-middle"
          />
        )}
      </MessageContent>

      {!isUser && !streaming && prose.trim().length > 0 && (
        <div className="ml-1">
          <CoachSpeakerButton text={prose} track={track} />
        </div>
      )}

      {proposal && (
        <CoachProposalCard
          proposal={proposal}
          conversationId={conversationId ?? null}
          messageId={messageId ?? null}
        />
      )}
    </Message>
  );
}
