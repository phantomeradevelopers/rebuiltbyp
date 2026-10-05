import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playChime } from "@/lib/sound";
import { celebrate } from "@/lib/celebrate";
import { completeMindsetRep } from "@/lib/mindset.functions";
import type { MindsetToday } from "@/lib/mindset.functions";
import { SheetShell } from "./SheetShell";

const BREATH_478 = [
  { label: "Inhale", seconds: 4 },
  { label: "Hold", seconds: 7 },
  { label: "Exhale", seconds: 8 },
] as const;
const BREATH_BOX = [
  { label: "Inhale", seconds: 4 },
  { label: "Hold", seconds: 4 },
  { label: "Exhale", seconds: 4 },
  { label: "Hold", seconds: 4 },
] as const;
const CYCLES = 4;
const VIS_SECONDS = 60;

export function MindsetRepSheet({
  data,
  date,
  onClose,
  onCompleted,
}: {
  data: MindsetToday;
  date?: string;
  onClose: () => void;
  onCompleted: (streak: number) => void;
}) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const isBreath = data.repType === "478_breath" || data.repType === "box_breath";
  const isTimed = isBreath || data.repType === "visualization";

  async function markDone() {
    if (saving || done) return;
    setSaving(true);
    try {
      const res = await completeMindsetRep({ data: date ? { date } : {} });
      setDone(true);
      if (isBreath) {
        playChime("singing_bowl");
      } else {
        playChime("victory");
        celebrate("burst", { toast: "Mindset rep logged." });
      }
      onCompleted(res.streak);
      setTimeout(onClose, isBreath ? 3200 : 900);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  let body: React.ReactNode = null;
  if (data.repType === "478_breath") body = <BreathBlock phases={BREATH_478} onFinish={markDone} done={done} />;
  else if (data.repType === "box_breath") body = <BreathBlock phases={BREATH_BOX} onFinish={markDone} done={done} />;
  else if (data.repType === "visualization") body = <TimerBlock label="Visualize the win" seconds={VIS_SECONDS} onFinish={markDone} done={done} />;
  else if (data.repType === "gratitude_trio") body = <ListBlock items={["Name 1 person you're grateful for.", "Name 1 win from yesterday.", "Name 1 thing your body did for you."]} />;
  else body = <IntentionBlock />;

  const footer = !isTimed && !done ? (
    <button
      onClick={markDone}
      disabled={saving}
      className="h-12 w-full btn-gold rounded-md text-sm font-medium disabled:opacity-70"
    >
      {saving ? "Saving…" : "Mark mindset rep done"}
    </button>
  ) : done ? (
    <p className="text-center label-mono text-gold py-2">Locked in.</p>
  ) : undefined;

  // Mindset streak progress toward the next milestone (7, 30, 100 days).
  const streak = data.streak ?? 0;
  const MILESTONES = [7, 30, 100] as const;
  const nextMilestone = MILESTONES.find((m) => streak < m) ?? 100;
  const prevMilestone = [0, ...MILESTONES].filter((m) => m <= streak).at(-1) ?? 0;
  const streakPct = Math.min(
    100,
    Math.max(4, Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)),
  );

  return (
    <SheetShell
      eyebrow={data.chip}
      title={data.title}
      onClose={onClose}
      swipeDisabled={isTimed && !done}
      footer={footer}
    >
      {/* Mindset-streak progress — labeled, replaces the earlier empty bar */}
      <div className="mt-1 mb-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <p className="label-mono text-[10px] text-gold/80 tracking-[0.18em]">
            Mindset streak
          </p>
          <p className="label-mono text-[10px] text-muted-foreground">
            {streak} / {nextMilestone} days
          </p>
        </div>
        <div className="h-1 rounded-full bg-border/60 overflow-hidden">
          <div
            className="h-full bg-gold transition-all duration-500"
            style={{ width: `${streakPct}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-center text-base leading-snug text-foreground/90 italic max-w-sm mx-auto mb-6">
        "{data.prompt}"
      </p>
      <div className="w-full">{body}</div>
    </SheetShell>
  );
}

function BreathBlock({
  phases,
  onFinish,
  done,
}: {
  phases: ReadonlyArray<{ label: string; seconds: number }>;
  onFinish: () => void;
  done: boolean;
}) {
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState(0);
  const [tick, setTick] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (cycle >= CYCLES) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cycle]);

  useEffect(() => {
    if (cycle >= CYCLES) return;
    if (tick >= phases[phase].seconds) {
      setTick(0);
      const next = phase + 1;
      if (next >= phases.length) {
        setPhase(0);
        setCycle((c) => c + 1);
      } else setPhase(next);
    }
  }, [tick, phase, cycle, phases]);

  useEffect(() => {
    if (cycle >= CYCLES && !finishedRef.current && !done) {
      finishedRef.current = true;
      onFinish();
    }
  }, [cycle, onFinish, done]);

  const finished = cycle >= CYCLES;
  const current = phases[phase];
  const scale = finished
    ? 1
    : current.label === "Inhale"
      ? 0.55 + (tick / current.seconds) * 0.45
      : current.label === "Exhale"
        ? 1 - (tick / current.seconds) * 0.45
        : 1;

  return (
    <div className="flex flex-col items-center">
      <style>{`
        @keyframes bowlBloom { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes bowlFadeUp { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      <p className="label-mono text-muted-foreground mb-6">Round {Math.min(cycle + 1, CYCLES)} of {CYCLES}</p>
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-gold/20" />
        {finished && (
          <>
            <div className="absolute inset-0 rounded-full border border-gold/60 pointer-events-none" style={{ animation: "bowlBloom 2200ms ease-out forwards" }} />
            <div className="absolute inset-0 rounded-full border border-gold/40 pointer-events-none" style={{ animation: "bowlBloom 2600ms ease-out 250ms forwards" }} />
          </>
        )}
        <div
          className="absolute rounded-full bg-gradient-to-br from-gold/30 to-gold/5 border border-gold/50 transition-all duration-[1600ms] ease-in-out"
          style={{ width: "100%", height: "100%", transform: `scale(${finished ? 0.9 : scale})`, opacity: finished ? 0.6 : 1 }}
        />
        <div className="relative text-center">
          <p
            className="font-display text-3xl sm:text-4xl text-gold-shimmer"
            style={finished ? { animation: "bowlFadeUp 900ms ease-out 300ms both" } : undefined}
          >
            {finished ? "Done" : current.label}
          </p>
          {!finished && <p className="label-mono text-muted-foreground mt-2">{current.seconds - tick}</p>}
        </div>
      </div>
    </div>
  );
}

function TimerBlock({ label, seconds, onFinish, done }: { label: string; seconds: number; onFinish: () => void; done: boolean }) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [left]);
  useEffect(() => {
    if (left === 0 && !firedRef.current && !done) {
      firedRef.current = true;
      onFinish();
    }
  }, [left, onFinish, done]);
  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div className="flex flex-col items-center">
      <p className="label-mono text-muted-foreground mb-4">{label}</p>
      <p className="font-display text-5xl sm:text-6xl text-gold-shimmer mb-6">{left}s</p>
      <div className="w-full max-w-xs h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full bg-gold transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 max-w-sm mx-auto">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="label-mono text-gold shrink-0">0{i + 1}</span>
          <span className="text-foreground/90">{s}</span>
        </li>
      ))}
    </ul>
  );
}

function IntentionBlock() {
  return (
    <div className="max-w-sm mx-auto space-y-3 text-sm text-foreground/90">
      <p><span className="label-mono text-gold mr-2">01</span>One word for today (e.g. <em>relentless</em>, <em>steady</em>, <em>present</em>).</p>
      <p><span className="label-mono text-gold mr-2">02</span>One outcome you'll close before sundown.</p>
      <p><span className="label-mono text-gold mr-2">03</span>Say it out loud. Now move.</p>
    </div>
  );
}
