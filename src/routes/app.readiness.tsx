import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Activity, Dumbbell } from "lucide-react";
import { saveReadiness, getReadinessHistory } from "@/lib/readiness.functions";
import { getTodayMode, setTodayMode, type DailyTrainingMode } from "@/lib/daily-training.functions";
import { PageSkeleton } from "@/components/skeletons";
import { getWelcomeStatus } from "@/lib/welcome.functions";
import { nextWelcomeStep, isWelcomeFlagged, WELCOME_FLAG } from "@/lib/welcome-flow";
import { useIdleNudge } from "@/hooks/useIdleNudge";

export const Route = createFileRoute("/app/readiness")({
  component: ReadinessPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

const MODALITIES: { id: string; label: string; category: string }[] = [
  { id: "push_upper", label: "Push (chest/shoulders/tris)", category: "strength" },
  { id: "pull_upper", label: "Pull (back/biceps)", category: "strength" },
  { id: "legs", label: "Legs (quads/glutes/hams)", category: "strength" },
  { id: "full_body", label: "Full body strength", category: "strength" },
  { id: "conditioning", label: "Conditioning / HIIT", category: "conditioning" },
  { id: "zone2_cardio", label: "Zone 2 cardio", category: "cardio" },
  { id: "mobility", label: "Mobility / recovery", category: "recovery" },
  { id: "rest_day", label: "Rest day", category: "rest" },
];

type HistoryRow = {
  day_date: string;
  score: number | null;
  sleep_hours: number | null;
  energy: number | null;
  mood: number | null;
  soreness: number | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ReadinessPage() {
  const smartBack = useSmartBack("/app/plan");
  const navigate = useNavigate();
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [soreness, setSoreness] = useState(3);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [mode, setMode] = useState<DailyTrainingMode | null>(null);
  const [savingMode, setSavingMode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const advanceTimerRef = useRef<number | null>(null);

  useIdleNudge({
    active: loaded && todayScore == null && !isWelcomeFlagged(),
    message: "Still here? Slide a few sliders and tap Calculate readiness — 30 seconds.",
    ctaSelector: "[data-readiness-save]",
  });

  async function load() {
    try {
      const { history } = await getReadinessHistory();
      setHistory(history as HistoryRow[]);
      const today = (history as HistoryRow[]).find((h) => h.day_date === todayISO());
      if (today) {
        setTodayScore(today.score);
        if (today.sleep_hours != null) setSleepHours(Number(today.sleep_hours));
        if (today.energy != null) setEnergy(today.energy);
        if (today.mood != null) setMood(today.mood);
        if (today.soreness != null) setSoreness(today.soreness);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function loadMode() {
    try {
      const m = await getTodayMode({ data: {} });
      setMode(m);
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await Promise.all([load(), loadMode()]);
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  async function pickMode(m: { id: string; label: string; category: string }) {
    setSavingMode(m.id);
    try {
      const saved = await setTodayMode({ data: { modality: m.id, category: m.category, equipment: [] } });
      setMode(saved);
      toast.success(`Today: ${m.label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingMode(null);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const wasFirst = todayScore == null && history.length === 0;
      const res = await saveReadiness({
        data: {
          day_date: todayISO(),
          sleep_hours: sleepHours,
          sleep_quality: sleepQuality,
          energy, mood, soreness,
        },
      });
      setTodayScore(res.score);
      toast.success(`Readiness: ${res.score}/100`);
      await load();
      if (wasFirst && !isWelcomeFlagged()) {
        // Let the user see their score for a beat, then auto-advance.
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = window.setTimeout(async () => {
          try {
            const status = await getWelcomeStatus();
            const next = nextWelcomeStep(status, "readiness");
            navigate({ to: (next ?? "/app/welcome") as never });
          } catch {
            navigate({ to: "/app/welcome" as never });
          }
        }, 1500);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
  }, []);

  function skipForNow() {
    try { localStorage.setItem(WELCOME_FLAG, "1"); } catch { /* ignore */ }
    navigate({ to: "/app/welcome" as never });
  }

  const recommendation =
    todayScore == null ? null :
    todayScore >= 75 ? { label: "PUSH", color: "text-emerald-400", text: "Body is primed. Hit it hard." } :
    todayScore >= 50 ? { label: "STEADY", color: "text-gold", text: "Train at planned intensity. Don't ego-lift." } :
    { label: "RESTORE", color: "text-orange-400", text: "Move, breathe, sleep. Recovery is the work today." };

  if (!loaded) return <PageSkeleton />;

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-8">
      <header>
        <button onClick={smartBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="label-mono text-gold mt-3">Readiness</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">How's the body today?</h1>
      </header>

      {todayScore != null && recommendation && (
        <section className="card-elevated p-6 text-center">
          <div className="text-5xl sm:text-6xl font-display text-gold">{todayScore}</div>
          <p className="label-mono mt-1">/ 100</p>
          <p className={`mt-4 label-mono ${recommendation.color}`}>{recommendation.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{recommendation.text}</p>
        </section>
      )}

      <section className="card-elevated p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-gold" />
          <p className="label-mono text-gold">How will you train today?</p>
        </div>
        <p className="text-xs text-muted-foreground">Pinpoints today's workout so the AI can tailor your plan, swap exercises, and learn your weekly pattern.</p>
        <div className="grid grid-cols-2 gap-2">
          {MODALITIES.map((m) => {
            const on = mode?.modality === m.id;
            return (
              <button
                key={m.id}
                onClick={() => pickMode(m)}
                disabled={savingMode !== null}
                className={`text-left rounded-md border p-3 text-xs transition-colors ${
                  on ? "border-gold bg-gold/10 text-foreground" : "border-border bg-card hover:border-gold/40"
                } disabled:opacity-60`}
              >
                <span className="block label-mono text-[11px] text-muted-foreground">{m.category}</span>
                <span className="block mt-0.5">{m.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-elevated p-5 space-y-5">
        <Slider label={`Sleep hours: ${sleepHours.toFixed(1)}`} value={sleepHours} min={0} max={12} step={0.5} onChange={setSleepHours} />
        <Slider label={`Sleep quality: ${sleepQuality}/5`} value={sleepQuality} min={1} max={5} step={1} onChange={(v) => setSleepQuality(Math.round(v))} />
        <Slider label={`Energy: ${energy}/5`} value={energy} min={1} max={5} step={1} onChange={(v) => setEnergy(Math.round(v))} />
        <Slider label={`Mood: ${mood}/5`} value={mood} min={1} max={5} step={1} onChange={(v) => setMood(Math.round(v))} />
        <Slider label={`Soreness: ${soreness}/5 ${soreness >= 4 ? "(beat up)" : ""}`} value={soreness} min={1} max={5} step={1} onChange={(v) => setSoreness(Math.round(v))} />

        <button data-readiness-save onClick={save} disabled={busy} className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60 active:scale-[0.98] transition-transform">
          {busy ? "Saving…" : todayScore != null ? "Update readiness" : "Calculate readiness"}
        </button>
        {todayScore == null && !isWelcomeFlagged() && (
          <button
            type="button"
            onClick={skipForNow}
            className="block mx-auto text-[11px] label-mono text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        )}
      </section>

      {history.length > 0 && (
        <section className="card-elevated p-5">
          <p className="label-mono text-gold mb-3">Last 14 days</p>
          <div className="flex items-end gap-1 h-24">
            {history.slice(0, 14).reverse().map((h) => {
              const score = h.score ?? 0;
              const pct = Math.max(4, (score / 100) * 100);
              const color = score >= 75 ? "bg-emerald-400" : score >= 50 ? "bg-gold" : "bg-orange-400";
              return (
                <div key={h.day_date} className="flex-1 flex flex-col items-center gap-1" title={`${h.day_date}: ${score}`}>
                  <div className={`w-full rounded-t ${color}`} style={{ height: `${pct}%` }} />
                  <span className="text-[11px] text-muted-foreground">{h.day_date.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground flex gap-2">
        <Activity className="h-4 w-4 text-gold shrink-0 mt-0.5" />
        <p>Readiness blends sleep, energy, mood, and soreness into one signal. Log it before training to know whether to push or restore.</p>
      </section>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block min-h-[1.25rem]">{label}</label>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--gold)]"
      />
    </div>
  );
}
