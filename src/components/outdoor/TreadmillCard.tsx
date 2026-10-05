import { useEffect, useMemo, useRef, useState } from "react";
import { Dumbbell, Play, Pause, Square, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { CardioPlan, CardioBlock } from "@/lib/cardio";
import { finishOutdoorSession } from "@/lib/outdoor.functions";
import { celebrateTask } from "@/lib/celebrate";
import { toast } from "sonner";
import { playChime } from "@/lib/sound";
import { haptic } from "@/lib/haptics";

type Props = {
  plan: CardioPlan;
  /** Show the "step outside instead" hint button. */
  onSwitchOutside?: () => void;
};

type Step = { label: string; sub: string; seconds: number };

function intervalsFor(minutes: number): Step[] {
  if (minutes <= 20) {
    return [
      { label: "Warm-up walk", sub: "3.0 mph, 0% incline", seconds: 5 * 60 },
      { label: "Zone 2", sub: "Conversational pace, 1–2% incline", seconds: 10 * 60 },
      { label: "Cooldown", sub: "Easy walk back to baseline", seconds: 5 * 60 },
    ];
  }
  if (minutes <= 40) {
    return [
      { label: "Warm-up", sub: "3.0 mph, 0% incline", seconds: 5 * 60 },
      { label: "Zone 2", sub: "Steady, you can talk in sentences", seconds: (minutes - 10) * 60 },
      { label: "Cooldown", sub: "Walk it out", seconds: 5 * 60 },
    ];
  }
  return [
    { label: "Warm-up", sub: "Easy walk", seconds: 5 * 60 },
    { label: "Zone 2", sub: "Steady, breathing through nose", seconds: 20 * 60 },
    { label: "4 × 60 sec pickups", sub: "Faster, 60 sec walk between", seconds: 8 * 60 },
    { label: "Zone 2", sub: "Back to steady", seconds: (minutes - 33) * 60 },
    { label: "Cooldown", sub: "Walk it out", seconds: 5 * 60 },
  ];
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function TreadmillCard({ plan, onSwitchOutside }: Props) {
  const block: CardioBlock = plan.blocks.find((b) => b.kind === "treadmill") ?? plan.blocks[0];
  const minutes = block.minutes;
  const intervals = useMemo(() => intervalsFor(minutes), [minutes]);
  const totalSeconds = useMemo(() => intervals.reduce((n, i) => n + i.seconds, 0), [intervals]);

  const [mode, setMode] = useState<"idle" | "active" | "paused">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef<string | null>(null);
  const lastChimeStep = useRef<number>(-1);

  const finishFn = useServerFn(finishOutdoorSession);

  // Tick
  useEffect(() => {
    if (mode !== "active") return;
    const id = window.setInterval(() => {
      setElapsed((e) => Math.min(e + 1, totalSeconds));
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode, totalSeconds]);

  // Current step + chime on transition
  const { stepIndex, stepRemaining } = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < intervals.length; i++) {
      if (elapsed < acc + intervals[i].seconds) {
        return { stepIndex: i, stepRemaining: acc + intervals[i].seconds - elapsed };
      }
      acc += intervals[i].seconds;
    }
    return { stepIndex: intervals.length - 1, stepRemaining: 0 };
  }, [elapsed, intervals]);

  useEffect(() => {
    if (mode !== "active") return;
    if (stepIndex !== lastChimeStep.current && lastChimeStep.current !== -1) {
      playChime("ding");
      haptic("light");
    }
    lastChimeStep.current = stepIndex;
  }, [stepIndex, mode]);

  const totalRemaining = totalSeconds - elapsed;
  const pct = totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;

  function start() {
    startedAtRef.current = new Date().toISOString();
    lastChimeStep.current = 0;
    setMode("active");
    haptic("success");
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      const started = startedAtRef.current ?? new Date(Date.now() - elapsed * 1000).toISOString();
      await finishFn({
        data: {
          route_id: null,
          started_at: started,
          ended_at: new Date().toISOString(),
          distance_meters: 0,
          duration_seconds: Math.max(1, elapsed),
          track: [],
        },
      });
      celebrateTask(0, 1, "Treadmill");
      toast.success("Treadmill session logged.");
      setMode("idle");
      setElapsed(0);
      startedAtRef.current = null;
      lastChimeStep.current = -1;
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save your session.");
    } finally {
      setSaving(false);
    }
  }

  // Idle view = original prescription
  if (mode === "idle") {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-gold" />
            <p className="label-mono text-gold">Treadmill session</p>
          </div>
          <p className="text-xs text-muted-foreground label-mono">{minutes} MIN</p>
        </div>
        <h2 className="font-display text-2xl leading-tight">{block.label}</h2>
        <p className="text-sm text-muted-foreground mt-1">{block.sub}</p>

        <ol className="mt-4 space-y-2">
          {intervals.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="h-6 w-6 rounded-full border border-gold/40 text-gold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="leading-tight">
                  {Math.round(step.seconds / 60)} min · {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={start}
          className="mt-4 w-full h-11 rounded-xl btn-gold text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          <Play className="h-4 w-4" />
          Start session
        </button>

        {onSwitchOutside && (
          <button
            onClick={onSwitchOutside}
            className="mt-2 w-full h-10 rounded-xl border border-border text-sm text-muted-foreground hover:border-gold hover:text-gold transition-colors"
          >
            Want to step outside instead?
          </button>
        )}
      </div>
    );
  }

  // Active / paused view = live timer
  const current = intervals[stepIndex];
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-gold" />
          <p className="label-mono text-gold">
            {mode === "paused" ? "Paused" : "Live"} · Step {stepIndex + 1}/{intervals.length}
          </p>
        </div>
        <p className="text-xs text-muted-foreground label-mono">
          {fmt(totalRemaining)} LEFT
        </p>
      </div>

      <p className="font-display text-5xl tabular-nums leading-none text-gold-shimmer">
        {fmt(stepRemaining)}
      </p>
      <p className="mt-2 text-sm">{current.label}</p>
      <p className="text-xs text-muted-foreground">{current.sub}</p>

      <div className="mt-4 h-1.5 w-full bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold via-yellow-300 to-gold transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {mode === "active" ? (
          <button
            onClick={() => setMode("paused")}
            className="h-11 rounded-xl border border-border text-sm inline-flex items-center justify-center gap-2 hover:border-gold hover:text-gold"
          >
            <Pause className="h-4 w-4" /> Pause
          </button>
        ) : (
          <button
            onClick={() => setMode("active")}
            className="h-11 rounded-xl border border-gold/60 text-gold text-sm inline-flex items-center justify-center gap-2"
          >
            <Play className="h-4 w-4" /> Resume
          </button>
        )}
        <button
          onClick={finish}
          disabled={saving}
          className="h-11 rounded-xl btn-gold text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {totalRemaining <= 0 ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {saving ? "Saving…" : totalRemaining <= 0 ? "Complete" : "Finish early"}
        </button>
      </div>
    </div>
  );
}
