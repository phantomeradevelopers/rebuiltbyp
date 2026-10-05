import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ChevronLeft, ChevronRight, RotateCcw, LogOut, Save } from "lucide-react";
import { setDemoDay, exitDemoSession } from "@/lib/demo.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { DemoSaveDialog } from "@/components/DemoSaveDialog";

const MAX_DAY = 30;

export function DemoBar({ initialDay }: { initialDay: number }) {
  const [day, setDay] = useState(Math.min(MAX_DAY, Math.max(1, initialDay)));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [snapMode, setSnapMode] = useState<"save" | "load" | null>(null);
  const navigate = useNavigate();

  async function exitDemo() {
    if (busy) return;
    if (!confirm("Exit demo? Your demo account and all its data will be deleted.")) return;
    setBusy(true);
    try {
      await exitDemoSession();
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function jump(next: number) {
    const clamped = Math.min(MAX_DAY, Math.max(1, next));
    if (clamped === day || busy) return;
    setBusy(true);
    try {
      await setDemoDay({ data: { day: clamped } });
      setDay(clamped);
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-40 h-9 px-3 rounded-full bg-gold text-gold-foreground label-mono flex items-center gap-1 shadow-lg"
      >
        <Sparkles className="h-3 w-3" /> Demo · Day {day}
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-xl border-b border-gold/30">
      <div className="hairline-strong" />
      <div className="max-w-2xl mx-auto px-3 py-2.5 flex flex-col gap-2">
        {/* Row 1: prev / day chip / next */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 label-mono text-gold shrink-0">
            <Sparkles className="h-3 w-3" /> DEMO
          </div>

          <button
            onClick={() => jump(day - 1)}
            disabled={busy || day <= 1}
            className="flex-1 h-10 rounded-lg border border-border bg-card hover:border-foreground/30 disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-medium transition-all"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>

          <div className="h-10 px-4 rounded-lg flex flex-col items-center justify-center min-w-[88px] btn-gold">
            <span className="label-mono text-[11px] leading-none opacity-80">DAY</span>
            <span className="font-display text-lg leading-none mt-0.5">{day}<span className="opacity-60 text-xs"> / {MAX_DAY}</span></span>
          </div>

          <button
            onClick={() => jump(day + 1)}
            disabled={busy || day >= MAX_DAY}
            className="btn-gold flex-1 h-10 rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-medium"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => jump(1)}
            disabled={busy || day === 1}
            className="h-10 w-10 rounded-lg border border-border bg-card hover:border-foreground/30 flex items-center justify-center disabled:opacity-40 transition-all"
            aria-label="Reset to day 1"
            title="Reset to day 1"
          ><RotateCcw className="h-4 w-4" /></button>

          <button
            onClick={exitDemo}
            disabled={busy}
            className="h-10 px-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40 flex items-center gap-1.5 text-sm font-medium transition-all"
            title="Exit demo and delete account"
          ><LogOut className="h-4 w-4" /> Exit</button>

          <button
            onClick={() => setOpen(false)}
            className="label-mono text-muted-foreground hover:text-foreground px-1 transition-colors"
            title="Hide demo bar"
          >hide</button>
        </div>

        {/* Row 2: jump-to slider */}
        <div className="flex items-center gap-3">
          <span className="label-mono shrink-0">Jump</span>
          <input
            type="range" min={1} max={MAX_DAY} value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            onMouseUp={(e) => jump(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => jump(Number((e.target as HTMLInputElement).value))}
            disabled={busy}
            className="flex-1 accent-[var(--gold)]"
          />
          <span className="label-mono text-gold w-16 text-right">
            Week {Math.ceil(day / 7)}
          </span>
        </div>

        {/* Row 3: save (claim) demo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSnapMode("save")}
            disabled={busy}
            className="flex-1 h-10 rounded-lg btn-gold disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-medium"
          ><Save className="h-4 w-4" /> Save my progress</button>
        </div>

        {busy && <p className="label-mono text-gold text-center text-gold-shimmer">Loading day {day}…</p>}
      </div>
      <DemoSaveDialog
        open={snapMode !== null}
        onOpenChange={(v) => { if (!v) setSnapMode(null); }}
      />

    </div>
  );
}
