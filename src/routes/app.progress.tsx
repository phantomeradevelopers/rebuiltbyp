import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getProgress,
  logWeight,
  addProgressPhoto,
  deleteProgressPhoto,
  type ProgressSnapshot,
} from "@/lib/progress.functions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { Camera, Plus, Trash2, Flame, CheckCircle2, TrendingDown, TrendingUp, Trophy, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listAchievements, type AchievementWithStatus, type Rarity } from "@/lib/achievements.functions";
import { TrophyCard } from "@/components/TrophyCard";
import { TrophyGalleryModal } from "@/components/TrophyGalleryModal";
import { StreakNumber } from "@/components/rebuilt/StreakNumber";
import { PhotoCompareSlider } from "@/components/progress/PhotoCompareSlider";
import { ProgressShareSheet } from "@/components/share/ProgressShareSheet";
import { Share2 } from "lucide-react";
import { haptic } from "@/lib/haptics";

import { RouteError } from "@/components/RouteError";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { ConsultCard } from "@/components/ConsultCard";

export const Route = createFileRoute("/app/progress")({
  head: () => ({ meta: [{ title: "Progress — REBUILT" },{ name: "description", content: "Track weight, photos, and streaks over time." },{ property: "og:title", content: "Progress — REBUILT" },{ property: "og:description", content: "Track weight, photos, and streaks over time." },] }),
  component: ProgressPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

function ProgressPage() {
  const [data, setData] = useState<ProgressSnapshot | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const { data: trophyData } = useQuery({
    queryKey: ["achievements-full"],
    queryFn: () => listAchievements(),
    enabled: authReady,
    staleTime: 30_000,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    try { setData(await getProgress()); } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: authData }) => {
      if (cancelled) return;
      setAuthReady(!!authData.user);
      if (authData.user) void reload();
    });
    return () => { cancelled = true; };
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("progress-photos").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      await addProgressPhoto({ data: { path } });
      toast.success("Photo saved.");
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteProgressPhoto({ data: { id } });
      reload();
    } catch (err) { toast.error((err as Error).message); }
  }

  if (!data) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
          Loading…
        </p>
      </div>
    );
  }

  const delta = data.startWeightKg != null && data.currentWeightKg != null
    ? +(data.currentWeightKg - data.startWeightKg).toFixed(1) : null;

  const moodSeries = data.checkins.map((c) => ({
    date: c.date.slice(5),
    mood: c.mood ?? null,
    energy: c.energy ?? null,
    sleep: c.sleep_hours ?? null,
  }));

  const weightSeries = (() => {
    const base = data.weights.map((w) => ({ date: w.date.slice(5), kg: w.kg }));
    if (base.length < 2) return base.map((p) => ({ ...p, trend: null as number | null }));
    // Linear regression on index → kg
    const n = base.length;
    const xs = base.map((_, i) => i);
    const ys = base.map((p) => p.kg);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    return base.map((p, i) => ({ ...p, trend: +(slope * i + intercept).toFixed(2) }));
  })();

  return (
    <div className="min-h-dvh bg-[color:var(--background)] pb-32">
      <div className="mx-auto max-w-md px-5 pt-10 space-y-6">
        {/* Comeback hero */}
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">
            Progress
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[color:var(--text-primary)] leading-tight">
            The receipts.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)] leading-snug">
            Weight, photos, trophies. The body keeps score.
          </p>
        </header>

      {/* Streak hero + period tracker */}
      <StreakCoach data={data} />

      {/* Trophy Room */}
      <TrophyRoomSection
        items={trophyData?.items ?? []}
        unlockedCount={trophyData?.stats.unlockedCount ?? 0}
        totalCount={trophyData?.stats.totalCount ?? 0}
        onShowAll={() => setGalleryOpen(true)}
      />

      {/* Work with P — top of the ladder */}
      <section aria-labelledby="work-with-p">
        <p id="work-with-p" className="label-mono text-platinum text-[10px] tracking-[0.22em] mb-2">
          WORK WITH P
        </p>
        <ConsultCard variant="hero" />
      </section>



      {/* Weight */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono text-gold flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3" /> Weight
            </p>
            <p className="mt-2 font-display text-3xl">
              {data.currentWeightKg != null ? `${data.currentWeightKg.toFixed(1)} kg` : "—"}
            </p>
            {delta != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} kg since start`}
                {data.goalWeightKg != null && ` · goal ${data.goalWeightKg} kg`}
              </p>
            )}
          </div>
          <button
            onClick={() => setWeightOpen(true)}
            className="h-11 px-4 rounded-lg border border-gold/40 text-xs label-mono text-gold hover:bg-gold/10 active:scale-95 transition-all"
          >Log weight</button>
        </div>
        <ThirtyDayChip weights={data.weights} startKg={data.startWeightKg} goalKg={data.goalWeightKg} />

        {weightSeries.length > 1 && (
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Area type="monotone" dataKey="kg" stroke="var(--gold)" strokeWidth={2} fill="url(#wg)" />
                <Line type="monotone" dataKey="trend" stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.55} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {weightSeries.length > 1 && (
          <p className="text-[10px] label-mono text-muted-foreground mt-2 text-right">
            <span className="inline-block w-3 border-t border-dashed border-foreground/60 align-middle mr-1" /> trend
          </p>
        )}
        {weightSeries.length <= 1 && (
          <p className="text-xs text-muted-foreground mt-4">Log a few more entries to see the trend.</p>
        )}
      </Card>

      {/* Mood / energy / sleep */}
      <Card>
        <p className="label-mono text-gold">Mood, energy, sleep</p>
        {moodSeries.length > 1 ? (
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moodSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="mood" stroke="var(--gold)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="energy" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} opacity={0.6} />
                <Line type="monotone" dataKey="sleep" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-3">Daily check-ins will plot here.</p>
        )}
        <div className="mt-3 flex gap-4 text-[10px] label-mono">
          <span><i className="inline-block w-3 h-0.5 bg-gold align-middle mr-1.5" />mood</span>
          <span><i className="inline-block w-3 h-0.5 bg-foreground/60 align-middle mr-1.5" />energy</span>
          <span><i className="inline-block w-3 border-t border-dashed border-muted-foreground align-middle mr-1.5" />sleep (h)</span>
        </div>
      </Card>

      {/* Photos */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Camera className="h-3 w-3" /> Progress photos
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="h-11 px-4 rounded-lg border border-gold/40 text-xs label-mono text-gold hover:bg-gold/10 active:scale-95 transition-all flex items-center gap-1.5"
          ><Plus className="h-3.5 w-3.5" /> Add</button>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={onUpload}
          />
        </div>
        {data.photos.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-3">No before-photo yet. Snap your first one — it's how you'll actually see the work in a month.</p>
        ) : (
          <PhotoGallery photos={data.photos} onDelete={onDelete} />
        )}
      </Card>

      {/* Labs — moved off the bottom nav; lives here as part of body data. */}
      <Link
        to="/app/labs"
        className="card-elevated p-4 flex items-center justify-between hover:border-gold/40 transition"
      >
        <div>
          <p className="label-mono text-[10px] text-gold">LABS</p>
          <p className="mt-1 font-display text-base">Blood work</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Coming soon — join the waitlist.</p>
        </div>
        <span className="text-gold label-mono text-xs">Open →</span>
      </Link>

      <div className="h-8" />

      {weightOpen && <WeightSheet onClose={() => setWeightOpen(false)} onSaved={() => { setWeightOpen(false); reload(); }} initial={data.currentWeightKg} />}
      <TrophyGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <AskCoachFooter prompt="Scale not moving? Talk to P." />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] p-5">
      {children}
    </section>
  );
}

function ThirtyDayChip({
  weights,
  startKg,
  goalKg,
}: {
  weights: { date: string; kg: number }[];
  startKg: number | null;
  goalKg: number | null;
}) {
  if (weights.length < 2) return null;
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = weights.filter((w) => w.date >= cutoffStr);
  if (recent.length < 2) return null;
  const first = recent[0].kg;
  const last = recent[recent.length - 1].kg;
  const delta = +(last - first).toFixed(1);

  // Pace vs goal: expected per-day rate based on full start→goal, scaled to 30 days.
  let pace: "ahead" | "on-pace" | "behind" | null = null;
  if (startKg != null && goalKg != null && startKg !== goalKg) {
    const direction = goalKg < startKg ? -1 : 1; // -1 cut, +1 bulk
    const expectedDaily = (goalKg - startKg) / 90; // assume 90-day target window
    const expected30 = expectedDaily * 30;
    // Progress in the goal direction over the last 30 days
    const actualSigned = delta;
    const expectedSigned = expected30;
    if (direction === -1) {
      // We want delta to be more negative than expected
      if (actualSigned <= expectedSigned * 1.1) pace = "ahead";
      else if (actualSigned <= expectedSigned * 0.7) pace = "on-pace";
      else pace = "behind";
    } else {
      if (actualSigned >= expectedSigned * 1.1) pace = "ahead";
      else if (actualSigned >= expectedSigned * 0.7) pace = "on-pace";
      else pace = "behind";
    }
  }

  const Icon = delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp;
  const tone =
    pace === "ahead"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
      : pace === "behind"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
      : "text-[color:var(--rebuilt-gold)] border-[color:var(--rebuilt-gold-solid)] bg-[color:var(--rebuilt-gold-glow)]";
  const paceLabel =
    pace === "ahead" ? "Ahead of pace" : pace === "on-pace" ? "On pace" : pace === "behind" ? "Behind pace" : "30-day trend";

  return (
    <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${tone}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      <span className="label-mono text-[10px] tracking-[0.18em]">
        30D · {delta > 0 ? "+" : ""}{delta} kg · {paceLabel}
      </span>
    </div>
  );
}


type Period = "week" | "month" | "year";

function StreakCoach({ data }: { data: ProgressSnapshot }) {
  const [period, setPeriod] = useState<Period>("week");

  // Compute current streak (consecutive days with workout_completed, today optional)
  const completedDays = new Set(
    data.checkins.filter((c) => c.workout_completed).map((c) => c.date)
  );
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (completedDays.has(ds)) streak++;
    else if (i === 0) continue;
    else break;
  }

  const windowDays = period === "week" ? 7 : period === "month" ? 30 : 365;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const checkinsInWindow = data.checkins.filter((c) => c.date >= cutoffStr);
  const weightsInWindow = data.weights.filter((w) => w.date >= cutoffStr);

  const sessions = checkinsInWindow.filter((c) => c.workout_completed).length;
  const consistency = Math.min(100, Math.round((checkinsInWindow.length / windowDays) * 100));
  const weightDelta = weightsInWindow.length >= 2
    ? +(weightsInWindow[weightsInWindow.length - 1].kg - weightsInWindow[0].kg).toFixed(1)
    : null;

  const periodLabel = period === "week" ? "this week" : period === "month" ? "this month" : "this year";
  const sessionsGoal = period === "week" ? 3 : period === "month" ? 12 : 150;

  // Wins
  const wins: string[] = [];
  if (streak >= 3) wins.push(`${streak}-day streak going strong`);
  if (sessions >= sessionsGoal) wins.push(`Hit your ${periodLabel} workout goal`);
  else if (sessions > 0) wins.push(`${sessions} workout${sessions === 1 ? "" : "s"} logged ${periodLabel}`);
  if (consistency >= 80) wins.push(`${consistency}% check-in rate — showing up matters`);
  if (weightDelta != null && weightDelta < 0) wins.push(`Down ${Math.abs(weightDelta)} kg ${periodLabel}`);
  if (weightDelta != null && weightDelta > 0 && (data.goalWeightKg ?? 0) > (data.currentWeightKg ?? 0)) {
    wins.push(`Up ${weightDelta} kg ${periodLabel} — building`);
  }

  const streakMsg = streak === 0
    ? "Today's a clean start. One session resets the clock."
    : streak < 3
    ? "Keep it warm. Day 3 is where it starts to stick."
    : streak < 7
    ? "Momentum locked in. Don't break the chain."
    : streak < 30
    ? "This is your new normal. Respect it."
    : "You're built different now. Stay humble.";

  return (
    <>
      {/* Streak hero — REBUILT v2 */}
      <section
        className="relative overflow-hidden rounded-2xl border border-[color:var(--rebuilt-gold-solid)] bg-[color:var(--bg-raised)] p-6"
      >
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 100% 0%, var(--rebuilt-gold-glow) 0%, transparent 60%)",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">
            Current streak
          </p>
          <div className="mt-3">
            <StreakNumber count={streak} size="lg" />
          </div>
          <p className="mt-4 text-sm text-[color:var(--text-primary)]/85 leading-snug max-w-[22rem]">
            {streakMsg}
          </p>
        </div>
      </section>

      {/* Period toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-[color:var(--bg-raised)] border border-[color:var(--border-strong,rgba(255,255,255,0.06))]">
        {(["week", "month", "year"] as Period[]).map((p) => {
          const active = p === period;
          return (
            <button
              key={p}
              onClick={() => {
                haptic("selection");
                setPeriod(p);
              }}
              aria-current={active ? "page" : undefined}
              className={[
                "flex-1 min-h-10 rounded-lg text-[11px] uppercase tracking-[0.18em] font-mono font-semibold transition-colors",
                active
                  ? "bg-[color:var(--rebuilt-gold)] text-[#0a0a0a]"
                  : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]",
              ].join(" ")}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* 3 simple cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SimpleStat
          icon={<Flame className="h-3 w-3" />}
          label="sessions"
          value={sessions}
          sub={`goal ${sessionsGoal}`}
          good={sessions >= sessionsGoal}
        />
        <SimpleStat
          icon={<CheckCircle2 className="h-3 w-3" />}
          label="check-ins"
          value={`${consistency}%`}
          sub={`${checkinsInWindow.length}/${windowDays} days`}
          good={consistency >= 60}
        />
        <SimpleStat
          icon={<TrendingDown className="h-3 w-3" />}
          label="body"
          value={weightDelta == null ? "—" : `${weightDelta > 0 ? "+" : ""}${weightDelta}`}
          sub={weightDelta == null ? "log weight" : "kg"}
          good={weightDelta != null && weightDelta !== 0}
        />
      </div>

      {/* Wins list */}
      {wins.length > 0 && (
        <section className="card-elevated p-5">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Wins {periodLabel}
          </p>
          <ul className="mt-3 space-y-2">
            {wins.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <span className="text-foreground/90">{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {wins.length === 0 && (
        <section className="card-elevated p-5">
          <p className="label-mono text-gold">No wins yet {periodLabel}</p>
          <p className="mt-2 text-sm text-foreground/80">
            One session. One check-in. That's all it takes to start the list.
          </p>
        </section>
      )}
    </>
  );
}

function SimpleStat({
  icon, label, value, sub, good,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] p-3 sm:p-4">
      <div
        className={[
          "flex items-center gap-1.5",
          good ? "text-[color:var(--rebuilt-gold)]" : "text-[color:var(--text-tertiary)]",
        ].join(" ")}
      >
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p
        className={[
          "mt-2 font-display text-2xl sm:text-3xl leading-none tabular-nums",
          good ? "text-[color:var(--rebuilt-gold-bright)]" : "text-[color:var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] text-[color:var(--text-tertiary)] uppercase tracking-[0.1em] font-mono">
        {sub}
      </p>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-display text-3xl text-foreground leading-none">{value}</p>
      </div>
      <p className="label-mono mt-1.5">{label}</p>
    </div>
  );
}

function WeightSheet({ onClose, onSaved, initial }: { onClose: () => void; onSaved: () => void; initial: number | null }) {
  const [val, setVal] = useState<string>(initial != null ? String(initial) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 20 || n > 400) {
      toast.error("Enter a weight in kg.");
      return;
    }
    setBusy(true);
    try {
      await logWeight({ data: { weight_kg: n } });
      toast.success("Logged.");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[color:var(--bg-raised)] border-t sm:border border-[color:var(--rebuilt-gold)]/30 rounded-t-2xl sm:rounded-2xl p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">
          Log weight
        </p>
        <h2 className="mt-2 font-display text-2xl text-[color:var(--text-primary)]">
          What's the number today?
        </h2>
        <div className="mt-5 flex items-baseline gap-3">
          <input
            type="number" step="0.1" inputMode="decimal" value={val}
            onChange={(e) => setVal(e.target.value)}
            className="flex-1 h-14 rounded-xl border border-[color:var(--rebuilt-gold)]/25 bg-[color:var(--background)] px-4 text-2xl font-display text-[color:var(--text-primary)] focus:border-[color:var(--rebuilt-gold)] focus:outline-none"
            placeholder="0.0"
          />
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">kg</span>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-[color:var(--border-strong,rgba(255,255,255,0.08))] text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 h-12 rounded-xl bg-[color:var(--rebuilt-gold)] text-[#0a0a0a] text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrophyRoomSection({
  items, unlockedCount, totalCount, onShowAll,
}: {
  items: AchievementWithStatus[];
  unlockedCount: number;
  totalCount: number;
  onShowAll: () => void;
}) {
  const earned = items.filter((i) => i.unlocked).slice(0, 8);
  const lockedCount = totalCount - unlockedCount;

  return (
    <section
      className="card-elevated p-5 animate-count-up relative overflow-hidden"
      style={{ animationDelay: "180ms" }}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle at 90% 0%, rgba(220,38,38,0.18) 0%, transparent 55%)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono text-gold flex items-center gap-1.5">
              <Trophy className="h-3 w-3" /> Trophy Room
            </p>
            <h2 className="mt-1 font-display text-2xl text-gold-shimmer">
              {unlockedCount} / {totalCount} earned
            </h2>
          </div>
          <button
            onClick={onShowAll}
            className="h-9 px-3 rounded-md border border-gold/40 text-xs label-mono text-gold hover:bg-gold/10 transition"
          >
            See every trophy
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Receipts of the war you've waged on the old you.
        </p>

        {earned.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 justify-items-center">
            {earned.map((t, i) => (
              <TrophyCard
                achievementKey={t.key}
                key={t.key}
                rarity={t.rarity as Rarity}
                icon={t.icon}
                title={t.title}
                description={t.description}
                unlocked
                serial={`№ ${String(i + 1).padStart(2, "0")}`}
                size="sm"
                showLore={false}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No trophies yet. Earn your first — the iron is patient.
            </p>
          </div>
        )}

        {lockedCount > 0 && (
          <button
            onClick={onShowAll}
            className="mt-4 w-full text-xs label-mono text-muted-foreground hover:text-foreground transition"
          >
            +{lockedCount} locked · tap to preview every trophy →
          </button>
        )}
      </div>
    </section>
  );
}

function PhotoGallery({
  photos,
  onDelete,
}: {
  photos: { id: string; url: string; view_type: string | null; logged_at: string }[];
  onDelete: (id: string) => void;
}) {
  // Photos arrive sorted desc by logged_at. Build "Then vs now" + monthly groups.
  const sorted = [...photos].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );
  const oldest = sorted[sorted.length - 1];
  const newest = sorted[0];
  const spanDays = oldest && newest
    ? Math.floor(
        (new Date(newest.logged_at).getTime() - new Date(oldest.logged_at).getTime()) / 86_400_000
      )
    : 0;
  const showCompare = sorted.length >= 2 && spanDays >= 14;

  // Group by YYYY-MM
  const groups = new Map<string, typeof sorted>();
  for (const p of sorted) {
    const key = p.logged_at.slice(0, 7);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="mt-4 space-y-6">
      {showCompare && (
        <div>
          <p className="label-mono text-[10px] text-gold mb-2">Then vs now · day 0 → day {spanDays}</p>
          <PhotoCompareSlider before={oldest} after={newest} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Drag the handle to compare.</p>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gold/40 text-gold text-[11px] font-medium hover:bg-gold/10 transition"
            >
              <Share2 className="h-3 w-3" /> Share progress
            </button>
          </div>
          <ProgressShareSheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            before={oldest}
            after={newest}
          />
        </div>
      )}
      {[...groups.entries()].map(([key, items]) => (
        <div key={key}>
          <p className="label-mono text-[10px] text-gold mb-2">
            {monthLabel(key)} · {items.length} photo{items.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {items.map((p) => (
              <div
                key={p.id}
                className="relative aspect-[3/4] rounded-md overflow-hidden border border-border group"
              >
                <img
                  src={p.url}
                  alt="progress"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] text-white/80">{p.logged_at.slice(0, 10)}</p>
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="absolute top-1.5 right-1.5 h-9 w-9 rounded-full bg-black/70 text-white/90 hover:bg-black hover:text-white active:scale-90 flex items-center justify-center transition-all"
                  aria-label="Delete photo"
                ><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparePane({
  photo,
  caption,
}: {
  photo: { url: string; logged_at: string };
  caption: string;
}) {
  return (
    <div className="relative aspect-[3/4] rounded-md overflow-hidden border border-gold/40">
      <img
        src={photo.url}
        alt={caption}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent">
        <p className="label-mono text-[10px] text-gold">{caption}</p>
        <p className="text-[10px] text-white/80">{photo.logged_at.slice(0, 10)}</p>
      </div>
    </div>
  );
}
