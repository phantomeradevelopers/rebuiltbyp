import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ScrollText, RotateCcw, Sparkles, Shuffle } from "lucide-react";
import { getActiveContract, signContract } from "@/lib/identity.functions";
import { getIdentitySuggestions, getIdentityStarter } from "@/lib/identity-suggestions";
import { getBecomingTitle, type Gender } from "@/lib/identity-copy";
import { ContractSignedOverlay } from "@/components/ContractSignedOverlay";
import { PageSkeleton } from "@/components/skeletons";
import { getWelcomeStatus } from "@/lib/welcome.functions";
import { nextWelcomeStep, isWelcomeFlagged, WELCOME_FLAG } from "@/lib/welcome-flow";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useIdleNudge } from "@/hooks/useIdleNudge";

export const Route = createFileRoute("/app/identity")({
  head: () => ({ meta: [{ title: "Identity — REBUILT" },{ name: "description", content: "Anchor to who you are becoming." },{ property: "og:title", content: "Identity — REBUILT" },{ property: "og:description", content: "Anchor to who you are becoming." },] }),
  component: IdentityPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function IdentityPage() {
  const navigate = useNavigate();
  const smartBack = useSmartBack("/app/welcome");
  const [gender, setGender] = useState<Gender>(null);
  const [statement, setStatement] = useState("I am the person who ");
  const [existing, setExisting] = useState<{ statement: string; signed_at: string; signature_data_url: string | null } | null>(null);
  const [editing, setEditing] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const pendingAdvanceRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useIdleNudge({
    active: loaded && !existing && !isWelcomeFlagged(),
    message: "Take your time — tap a suggestion or write your own line.",
    ctaSelector: "[data-identity-sign]",
  });

  async function load() {
    try {
      const res = await getActiveContract();
      const g = (res.gender as Gender) ?? null;
      setGender(g);
      if (res.contract) {
        setExisting(res.contract as never);
        setStatement(res.contract.statement);
        setEditing(false);
      } else {
        setStatement(getIdentityStarter(g));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { void load(); }, []);

  const suggestions = getIdentitySuggestions(gender);
  const visibleSuggestions = (() => {
    const start = (suggestionSeed * 4) % suggestions.length;
    return [0, 1, 2, 3].map((i) => suggestions[(start + i) % suggestions.length]);
  })();

  function clearCanvas() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }

  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height));
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    ctx.lineTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height));
    ctx.stroke();
    hasInk.current = true;
  }
  function pointerUp() { drawing.current = false; }

  async function save() {
    if (statement.trim().length < 8) { toast.error("Write at least a short statement."); return; }
    setBusy(true);
    try {
      const wasFirst = !existing;
      const sig = hasInk.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : undefined;
      await signContract({ data: { statement: statement.trim(), signature_data_url: sig } });
      setEditing(false);
      await load();
      setShowOverlay(true);
      if (wasFirst && !isWelcomeFlagged()) {
        try {
          const status = await getWelcomeStatus();
          const next = nextWelcomeStep(status, "identity");
          pendingAdvanceRef.current = (next ?? "/app/welcome");
        } catch {
          pendingAdvanceRef.current = "/app/welcome";
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  function handleOverlayClose() {
    setShowOverlay(false);
    const target = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    if (target) navigate({ to: target as never });
  }

  function skipForNow() {
    try { localStorage.setItem(WELCOME_FLAG, "1"); } catch { /* ignore */ }
    navigate({ to: "/app/welcome" as never });
  }

  function applySuggestion(s: string) {
    setStatement(s);
    // Move cursor to end after render
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-identity-statement]");
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
    }, 0);
  }

  if (!loaded) return <PageSkeleton />;

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-8">
      <header>
        <button onClick={smartBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="label-mono text-gold mt-3">Identity contract</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">{getBecomingTitle(gender)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Name them. Sign it. We'll surface this every time you stumble — and again at month 3, 6, 9, and 12.
        </p>
      </header>

      {existing && !editing && (
        <section className="card-elevated p-6 space-y-4">
          <ScrollText className="h-5 w-5 text-gold" />
          <p className="font-display text-xl leading-snug">{existing.statement}</p>
          {existing.signature_data_url && (
            <img src={existing.signature_data_url} alt="Your signature" loading="lazy" decoding="async" className="h-20 w-full object-contain border border-border rounded" />
          )}
          <p className="label-mono text-xs text-muted-foreground">
            Signed {new Date(existing.signed_at).toLocaleDateString()}
          </p>
          <button onClick={() => setEditing(true)} className="h-10 w-full rounded-md border border-gold/40 text-xs label-mono text-gold hover:bg-gold/5">
            Rewrite the contract
          </button>
        </section>
      )}

      {editing && (
        <section className="card-elevated p-5 space-y-5">
          {/* Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label-mono text-gold text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Need a spark?
              </p>
              <button
                type="button"
                onClick={() => setSuggestionSeed((s) => s + 1)}
                className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-foreground"
              >
                <Shuffle className="h-3 w-3" /> Surprise me
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 min-h-[14rem]">
              {visibleSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="text-left text-sm rounded-md border border-border bg-input/40 px-3 py-2 hover:border-gold/60 hover:bg-card transition-colors min-h-[3rem] line-clamp-2"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tap to edit, or write your own below.</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">The statement</label>
            <textarea
              data-identity-statement
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={5}
              maxLength={800}
              className="mt-2 w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
              placeholder={getIdentityStarter(gender) + "…"}
            />
            <p className="text-xs text-muted-foreground mt-1">{statement.length}/800</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Signature</label>
              <button type="button" onClick={clearCanvas} className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3 w-3" /> Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={600} height={200}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerLeave={pointerUp}
              className="mt-2 w-full h-32 rounded-md border border-border bg-input touch-none"
            />
          </div>

          <div className="flex gap-2">
            {existing && (
              <button onClick={() => { setEditing(false); setStatement(existing.statement); }} className="flex-1 h-12 rounded-md border border-border text-xs label-mono text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            )}
            <button data-identity-sign onClick={save} disabled={busy} className="btn-gold flex-1 h-12 rounded-md text-sm font-medium disabled:opacity-60 active:scale-[0.98] transition-transform">
              {busy ? "Signing…" : "Sign the contract"}
            </button>
          </div>
          {!existing && !isWelcomeFlagged() && (
            <button
              type="button"
              onClick={skipForNow}
              className="block mx-auto text-[11px] label-mono text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Skip for now
            </button>
          )}
        </section>
      )}

      <ContractSignedOverlay
        open={showOverlay}
        statement={existing?.statement ?? statement.trim()}
        signatureDataUrl={existing?.signature_data_url ?? null}
        signedAt={existing?.signed_at}
        onClose={handleOverlayClose}
      />
    </div>
  );
}
