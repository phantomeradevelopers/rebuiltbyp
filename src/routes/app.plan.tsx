import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { BackToTodayPill, cameFromToday } from "@/components/BackToTodayPill";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, X, RefreshCw, ExternalLink, Settings2, Flame, Footprints, Trophy, Check, Coffee } from "lucide-react";
import { getPlans, submitCheckin, type FitnessPlan, type NutritionPlan, type DayPlan, type PhaseMeta } from "@/lib/dashboard.functions";
import { regeneratePlan } from "@/lib/profile.functions";
import { refineMealPlan, refineWorkoutPlan } from "@/lib/plan-refine.functions";
import { getBestVideoUrl } from "@/lib/exercise-library";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/rebuilt/PageHeader";
import { DailyLoopCard } from "@/components/outdoor/DailyLoopCard";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { TierGate } from "@/components/TierGate";
import { useTier } from "@/hooks/useTier";
import { hasTier } from "@/lib/tier";
import { useQuery } from "@tanstack/react-query";
import { getAccessStatus } from "@/lib/access.functions";

export const Route = createFileRoute("/app/plan")({ head: () => ({ meta: [{ title: "Your Plan — REBUILT" },{ name: "description", content: "Your daily plan: workouts, meals, and check-ins." },{ property: "og:title", content: "Your Plan — REBUILT" },{ property: "og:description", content: "Your daily plan: workouts, meals, and check-ins." },] }), component: PlanView, errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />, notFoundComponent: () => <RouteNotFound /> });

const todayISO = () => new Date().toISOString().slice(0, 10);
const doneKey = (week: number, day: number, idx: number) => `plan:done:${todayISO()}:${week}:${day}:${idx}`;
const restOverrideKey = () => `plan:restOverride:${todayISO()}`;

type ExMark = { action: "remove" | "replace"; reason?: string };
type MealMark = { action: "remove" | "replace"; reason?: string };
type RefineCtx = {
  mealMarks: Record<string, MealMark>;
  exMarks: Record<string, ExMark>;
  toggleMeal: (key: string, action: "remove" | "replace") => void;
  toggleEx: (key: string, action: "remove" | "replace") => void;
  doneSet: Record<string, boolean>;
  toggleDone: (week: number, day: number, idx: number, total: number) => void;
  skipExercise: (week: number, day: number, idx: number, name: string) => Promise<void>;
};
const RefineContext = createContext<RefineCtx | null>(null);
function useRefine() { return useContext(RefineContext); }


type MainTab = "today" | "walk" | "plan";

const BLOCKS: Array<{ label: string; from: number; to: number; note?: string }> = [
  { label: "Ramp", from: 1, to: 4 },
  { label: "Push", from: 5, to: 8 },
  { label: "Consolidate", from: 9, to: 12, note: "Week 12 deload" },
];
function blockFor(week: number): { label: string; from: number; to: number } {
  return BLOCKS.find((b) => week >= b.from && week <= b.to) ?? BLOCKS[0];
}

function PlanView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MainTab>("today");
  const [fitness, setFitness] = useState<FitnessPlan | null>(null);
  const [, setNutrition] = useState<NutritionPlan | null>(null);
  const [phase, setPhase] = useState<PhaseMeta | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [mealMarks, setMealMarks] = useState<Record<string, MealMark>>({});
  const [exMarks, setExMarks] = useState<Record<string, ExMark>>({});
  const [applying, setApplying] = useState(false);
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const [doneSet, setDoneSet] = useState<Record<string, boolean>>({});
  const [restOverride, setRestOverride] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Hydrate done + rest-override from localStorage on mount (today-scoped)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<string, boolean> = {};
    const prefix = `plan:done:${todayISO()}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) next[k] = true;
    }
    setDoneSet(next);
    setRestOverride(window.localStorage.getItem(restOverrideKey()) === "1");
  }, []);

  const toggleDone = useCallback((week: number, day: number, idx: number, total: number) => {
    const k = doneKey(week, day, idx);
    setDoneSet((prev) => {
      const next = { ...prev };
      if (next[k]) {
        delete next[k];
        try { window.localStorage.removeItem(k); } catch { /* noop */ }
      } else {
        next[k] = true;
        try { window.localStorage.setItem(k, "1"); } catch { /* noop */ }
      }
      // Count done for this day after change
      const dayPrefix = `plan:done:${todayISO()}:${week}:${day}:`;
      const doneNow = Object.keys(next).filter((x) => x.startsWith(dayPrefix)).length;
      if (doneNow >= total && total > 0) {
        // Auto-mark workout complete (fire-and-forget)
        void (async () => {
          try {
            await submitCheckin({
              data: {
                date: todayISO(),
                mood: 7, energy: 7, stress: 4, sleep_hours: 7,
                workout_completed: true,
                notes: null,
              },
            });
            toast.success("Day complete. Nice work.");
          } catch { /* ignore */ }
        })();
      }
      return next;
    });
  }, []);

  const skipExercise = useCallback(async (week: number, day: number, idx: number, name: string) => {
    if (skipping) return;
    if (!confirm(`Swap "${name}" for something similar?`)) return;
    setSkipping(true);
    try {
      const res = await refineWorkoutPlan({
        data: {
          actions: [{ week, day, exerciseIndex: idx, action: "replace", reason: "user skipped" }],
          applyToAllWeeks: false,
        },
      });
      if (res && res.ok === false) throw new Error(res.error || "Could not swap exercise.");
      await loadPlans();
      toast.success("Swapped.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSkipping(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipping]);

  const refineCtx: RefineCtx = useMemo(() => ({
    mealMarks, exMarks,
    toggleMeal: (key, action) => setMealMarks((m) => {
      const cur = m[key];
      const next = { ...m };
      if (cur?.action === action) delete next[key]; else next[key] = { action };
      return next;
    }),
    toggleEx: (key, action) => setExMarks((m) => {
      const cur = m[key];
      const next = { ...m };
      if (cur?.action === action) delete next[key]; else next[key] = { action };
      return next;
    }),
    doneSet,
    toggleDone,
    skipExercise,
  }), [mealMarks, exMarks, doneSet, toggleDone, skipExercise]);

  const makeRestToday = () => {
    try { window.localStorage.setItem(restOverrideKey(), "1"); } catch { /* noop */ }
    setRestOverride(true);
    toast.success("Today is a rest day. Take it easy.");
  };
  const undoRestToday = () => {
    try { window.localStorage.removeItem(restOverrideKey()); } catch { /* noop */ }
    setRestOverride(false);
  };

  const totalMarks = Object.keys(mealMarks).length + Object.keys(exMarks).length;
  useEffect(() => { setPendingDismissed(false); }, [totalMarks]);

  async function applyRefinements() {
    if (totalMarks === 0 || applying) return;
    setApplying(true);
    const mealActs = Object.entries(mealMarks).map(([k, v]) => {
      const [day, slot, ...rest] = k.split("|");
      return { day: Number(day), slot, name: rest.join("|"), action: v.action, reason: v.reason };
    });
    const exActs = Object.entries(exMarks).map(([k, v]) => {
      const [week, day, idx] = k.split("|");
      return { week: Number(week), day: Number(day), exerciseIndex: Number(idx), action: v.action, reason: v.reason };
    });
    try {
      const tasks: Promise<unknown>[] = [];
      if (mealActs.length) tasks.push(refineMealPlan({ data: { actions: mealActs } }));
      if (exActs.length) tasks.push(refineWorkoutPlan({ data: { actions: exActs, applyToAllWeeks: false } }));
      const results = await Promise.all(tasks);
      const failed = results.find((r) => r && typeof r === "object" && (r as { ok?: boolean }).ok === false) as { error?: string } | undefined;
      if (failed) throw new Error(failed.error || "Could not apply changes.");
      const warns = (results.find((r) => r && typeof r === "object" && "warnings" in (r as object)) as { warnings?: string[] } | undefined)?.warnings ?? [];
      setMealMarks({}); setExMarks({});
      await loadPlans();
      toast.success(`Applied ${totalMarks} change${totalMarks === 1 ? "" : "s"}.`);
      warns.forEach((w) => toast.warning(w));
      if (cameFromToday()) setTimeout(() => navigate({ to: "/app" }), 900);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setApplying(false); }
  }


  async function loadPlans() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const res = await getPlans();
      setFitness(res.fitness); setNutrition(res.nutrition);
      setPhase(res.phase);
      setCurrentWeek(res.weekNumber); setActiveWeek(res.weekNumber);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/unauthorized/i.test(msg)) return;
      toast.error(msg);
    }
  }

  const [buildStep, setBuildStep] = useState(0);

  async function build() {
    setBuilding(true);
    setBuildStep(0);
    const steps = ["Reading your profile", "Designing workouts", "Building meals", "Saving your plan"];
    const stepTimer = setInterval(() => {
      setBuildStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 8000);
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("Plan generation timed out. Tap Build again to retry.")), 120000)
    );
    try {
      const res = await Promise.race([regeneratePlan(), timeout]) as { ok: boolean; error?: string };
      if (res && res.ok === false) throw new Error(res.error || "Plan generation failed.");
      await loadPlans();
      toast.success("Your plan is ready.");
    } catch (e) {
      const msg = (e as Error).message;
      if (/profile not found/i.test(msg)) setNeedsOnboarding(true);
      toast.error(msg);
    } finally {
      clearInterval(stepTimer);
      setBuilding(false);
      setBuildStep(0);
    }
  }

  useEffect(() => {
    (async () => {
      await loadPlans();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on tab switch (mobile friendliness)
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="label-mono">Loading…</p></div>;
  }

  const buildSteps = ["Reading your profile", "Designing workouts", "Building meals", "Saving your plan"];

  if (!fitness) {
    return (
      <div className="px-4 sm:px-6 pt-safe pt-8 max-w-md mx-auto">
        <p className="label-mono text-gold">Train</p>
        <h1 className="mt-1.5 font-display text-3xl sm:text-4xl leading-tight">No plan yet.</h1>
        <p className="mt-3 text-sm text-muted-foreground">P will build a 12-week training plan from your profile. This usually takes 30–60 seconds.</p>
        <button
          onClick={build}
          disabled={building}
          className="mt-6 w-full h-12 rounded-md bg-gold text-gold-foreground font-medium disabled:opacity-60"
        >
          {building ? `${buildSteps[buildStep]}…` : "Build my plan"}
        </button>
        {building && (
          <ol className="mt-5 space-y-2">
            {buildSteps.map((s, i) => (
              <li key={s} className={`flex items-center gap-2 text-xs label-mono ${i <= buildStep ? "text-gold" : "text-muted-foreground"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${i < buildStep ? "bg-gold" : i === buildStep ? "bg-gold pulse-gold" : "bg-border"}`} />
                {s}
              </li>
            ))}
            <li className="text-xs text-muted-foreground pt-1">Keep this tab open — it's working.</li>
          </ol>
        )}
        {needsOnboarding && (
          <Link to="/onboarding" className="block mt-4 text-center text-sm text-gold underline">
            Finish onboarding first
          </Link>
        )}
      </div>
    );
  }

  const currentWeekObj = fitness.weeks.find((w) => w.week === currentWeek) ?? fitness.weeks[0];
  const todayDay = currentWeekObj?.days[0];

  return (
    <RefineContext.Provider value={refineCtx}>
      <div className="min-h-dvh bg-[color:var(--background)]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-28">
          <PageHeader
            eyebrow="Train"
            title="Show up. Lift. Win."
            subtitle="Today. This week. Your 12-week plan."
            backTo="/app"
          />
          <div className="mt-6 space-y-4">
          <BackToTodayPill />

          {totalMarks > 0 && !pendingDismissed && (
            <div
              className="fixed left-0 right-0 z-40 px-4"
              style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
            >
              <div className="max-w-md mx-auto rounded-xl border border-gold/40 bg-background/95 backdrop-blur shadow-lg p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="label-mono text-gold">{totalMarks} pending change{totalMarks === 1 ? "" : "s"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {Object.keys(mealMarks).length} meal · {Object.keys(exMarks).length} workout
                  </p>
                </div>
                <button
                  onClick={() => { setMealMarks({}); setExMarks({}); }}
                  className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                >Clear</button>
                <button
                  onClick={applyRefinements}
                  disabled={applying}
                  className="btn-gold h-11 px-5 rounded-lg text-sm font-medium disabled:opacity-60 active:scale-95 transition-transform"
                >{applying ? "Applying…" : "Apply"}</button>
                <button
                  onClick={() => setPendingDismissed(true)}
                  aria-label="Dismiss"
                  className="h-9 w-9 rounded-md text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                ><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* Phase mini-strip */}
          <div className="mt-5 flex items-center justify-between text-[11px] label-mono">
            <span className="text-gold">Phase {phase?.phase_number ?? 1} · {blockFor(currentWeek).label}</span>
            <span className="text-muted-foreground">Week {currentWeek} of 12</span>
          </div>

          {/* 3-tab strip — Fuel-style */}
          <div role="tablist" aria-label="Train section" className="mt-3 grid grid-cols-3 gap-1 p-1 rounded-md bg-muted/60">
            <MainTabBtn active={tab === "today"} onClick={() => setTab("today")} icon={<Flame className="h-3.5 w-3.5" />} label="Today" />
            <MainTabBtn active={tab === "walk"} onClick={() => setTab("walk")} icon={<Footprints className="h-3.5 w-3.5" />} label="Walk" />
            <MainTabBtn active={tab === "plan"} onClick={() => setTab("plan")} icon={<Trophy className="h-3.5 w-3.5" />} label="Schedule" />
          </div>

          <div key={tab} className="animate-count-up">
            {tab === "today" && (
              <div className="mt-5">
                {todayDay ? (
                  <DayHero
                    week={currentWeek}
                    day={todayDay}
                    restOverride={restOverride}
                    onMakeRest={makeRestToday}
                    onUndoRest={undoRestToday}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No session for today.</p>
                )}
              </div>
            )}

            {tab === "walk" && <WalkView />}

            {tab === "plan" && (
              <ProgramView
                fitness={fitness}
                currentWeek={currentWeek}
                activeWeek={activeWeek}
                setActiveWeek={setActiveWeek}
                building={building}
                onStartFreshPhase={async () => {
                  if (!confirm("Generate a new 12-week phase now? This replaces the current plan.")) return;
                  setBuilding(true);
                  try {
                    const res = await regeneratePlan();
                    if (res && res.ok === false) throw new Error(res.error || "Could not generate phase.");
                    await loadPlans();
                    toast.success("New phase generated.");
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setBuilding(false); }
                }}
              />
            )}
            <AskCoachFooter prompt="Plan feels off? Tell P." />
          </div>
          </div>
        </div>
      </div>
    </RefineContext.Provider>
  );
}

function MainTabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`min-h-11 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${active ? "bg-card text-gold shadow-sm" : "text-muted-foreground"}`}
    >
      {icon}
      <span className="hidden xs:inline sm:inline">{label}</span>
      <span className="xs:hidden sm:hidden">{label}</span>
    </button>
  );
}


function WalkView() {
  return (
    <div className="mt-5 space-y-4">
      <DailyLoopCard variant="full" origin="home" />
      <Link
        to="/app/outdoor"
        className="inline-flex items-center justify-center gap-1.5 w-full h-12 px-6 rounded-md bg-gold text-gold-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
      >
        <Footprints className="h-4 w-4" /> Start a walk
      </Link>
      <p className="text-[11px] text-muted-foreground text-center px-4">
        Step out the door — we'll handle the route.
      </p>
    </div>
  );
}

function ProgramView({
  fitness, currentWeek, activeWeek, setActiveWeek, building, onStartFreshPhase,
}: {
  fitness: FitnessPlan;
  currentWeek: number;
  activeWeek: number;
  setActiveWeek: (n: number) => void;
  building: boolean;
  onStartFreshPhase: () => void;
}) {
  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm text-foreground/80 leading-relaxed">{fitness.overview}</p>

      <div className="space-y-5">
        {BLOCKS.map((b) => {
          const weeksInBlock = fitness.weeks.filter((w) => w.week >= b.from && w.week <= b.to);
          if (weeksInBlock.length === 0) return null;
          return (
            <div key={b.label}>
              <p className="label-mono text-xs uppercase tracking-wide text-foreground/70 mb-2 font-semibold">
                Weeks {b.from}–{b.to} · <span className="text-primary">{b.label}</span>
                {b.note ? <span className="text-foreground/60"> · Recovery week</span> : null}
              </p>
              <div className="space-y-1.5">
                {weeksInBlock.map((w) => {
                  const isActive = activeWeek === w.week;
                  const status = w.week < currentWeek ? "done" : w.week === currentWeek ? "now" : "upcoming";
                  return (
                    <button
                      key={w.week}
                      onClick={() => setActiveWeek(w.week)}
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md border text-left transition-all min-h-12 ${
                        isActive ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base leading-none">Week {w.week}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{w.focus}</p>
                      </div>
                      <span className={`shrink-0 label-mono text-[11px] font-semibold uppercase px-2 py-1 rounded ${
                        status === "now" ? "bg-primary text-primary-foreground" :
                        status === "done" ? "bg-primary/15 text-primary" :
                        "bg-[color:var(--bg-sunken)] text-foreground/70"
                      }`}>
                        {status === "now" ? "NOW" : status === "done" ? "DONE" : "SOON"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {fitness.weeks.filter((w) => w.week === activeWeek).map((w) => (
        <div key={w.week} className="pt-2 border-t border-border/60">
          <p className="label-mono text-gold">Week {w.week} focus</p>
          <p className="font-display text-xl mt-1">{w.focus}</p>
          <div className="mt-4 space-y-2">
            {w.days.map((d) => (
              <div key={d.day} className="card-elevated p-4">
                <p className="label-mono">Day {d.day}</p>
                <p className="font-display text-base mt-0.5">{d.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {friendlyType(d.type)}{d.type !== "rest" && ` · ${d.exercises.length} exercises`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onStartFreshPhase}
        disabled={building}
        className="w-full h-12 rounded-md border border-gold/40 text-gold text-sm font-medium hover:bg-gold/5 disabled:opacity-60"
      >
        {building ? "Building next plan…" : "Generate new 12-week plan"}
      </button>
    </div>
  );
}


function RefineToggle({ active, action, onToggle }: { active: "remove" | "replace" | null; action: "remove" | "replace"; onToggle: () => void }) {
  const isActive = active === action;
  const Icon = action === "remove" ? X : RefreshCw;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={action}
      className={`h-9 w-9 inline-flex items-center justify-center rounded-md border transition-all active:scale-90 ${
        isActive ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground hover:border-gold/40 hover:text-gold/80"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}


function ExerciseRow({ ex, exKey, editing, index, week, dayN, totalInDay, videoUnlocked = false }: { ex: DayPlan["exercises"][number]; exKey: string; editing: boolean; index: number; week: number; dayN: number; totalInDay: number; videoUnlocked?: boolean }) {
  const ctx = useRefine();
  const mark = ctx?.exMarks[exKey]?.action ?? null;
  const url = getBestVideoUrl(ex.name);
  const dKey = doneKey(week, dayN, index);
  const isDone = !!ctx?.doneSet[dKey];

  // Once done, the exercise disappears from the list entirely.
  if (isDone) return null;

  const dim = mark === "remove";
  const NameBlock = (
    <div className="min-w-0 flex-1">
      <p className="text-[15px] font-semibold leading-tight">{ex.name}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-md bg-[color:var(--bg-sunken)] border border-border px-2 py-1 label-mono text-[11px] uppercase tracking-wide text-foreground/80">
          <span className="font-display text-foreground font-semibold mr-1">{ex.sets}</span> sets
        </span>
        <span className="inline-flex items-center rounded-md bg-[color:var(--bg-sunken)] border border-border px-2 py-1 label-mono text-[11px] uppercase tracking-wide text-foreground/80">
          <span className="font-display text-foreground font-semibold mr-1">{ex.reps}</span> reps
        </span>
      </div>
    </div>
  );
  return (
    <li className={`py-3 first:pt-0 last:pb-0 border-b border-border/40 last:border-0 ${dim ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3 min-h-12">
        <span className="shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center bg-gold/10 text-gold font-display text-sm">
          {index + 1}
        </span>
        {videoUnlocked ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Watch the best demo of ${ex.name} on YouTube`}
            className="flex items-center gap-2 flex-1 min-w-0 -mx-1 px-1 rounded-md hover:bg-gold/5 active:bg-gold/10 transition-colors"
          >
            {NameBlock}
            <span className="shrink-0 inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
              <Play className="h-3 w-3 fill-current" /> <ExternalLink className="h-3 w-3 opacity-70" />
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0 -mx-1 px-1">
            {NameBlock}
            <span
              aria-label="Video demos are Pro-only"
              title="Video demos are Pro-only"
              className="shrink-0 inline-flex items-center gap-1 h-9 px-2.5 rounded-md border border-border text-muted-foreground text-[11px] label-mono uppercase tracking-wide"
            >
              <Play className="h-3 w-3" /> Pro
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 pl-12 flex items-center gap-2">
        <button
          type="button"
          onClick={() => ctx?.toggleDone(week, dayN, index, totalInDay)}
          aria-label={`Mark ${ex.name} done`}
          className="inline-flex items-center gap-1.5 h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Check className="h-4 w-4" /> Done
        </button>
        <button
          type="button"
          onClick={() => ctx?.skipExercise(week, dayN, index, ex.name)}
          aria-label={`Swap ${ex.name} for something similar`}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-md border border-border text-foreground/80 text-sm font-medium hover:border-primary/40 hover:text-primary active:scale-[0.98] transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Swap
        </button>
      </div>
      {ex.notes && <p className="text-sm text-foreground/70 mt-2 pl-12 leading-relaxed">{ex.notes}</p>}
      {editing && ctx && (
        <div className="mt-2 pl-12 flex items-center gap-1.5 flex-wrap">
          <span className="label-mono text-[11px] uppercase text-foreground/70 mr-1">Refine:</span>
          <RefineToggle active={mark} action="remove" onToggle={() => ctx.toggleEx(exKey, "remove")} />
          <RefineToggle active={mark} action="replace" onToggle={() => ctx.toggleEx(exKey, "replace")} />
          {mark && <span className="label-mono text-[11px] text-primary font-semibold">{mark === "remove" ? "Will remove" : "Will replace"}</span>}
        </div>
      )}
    </li>
  );
}

// Friendly plain-language label for a workout day type.
function friendlyType(type: string): string {
  switch (type) {
    case "strength": return "Strength";
    case "conditioning": return "Cardio";
    case "active_recovery": return "Easy day";
    case "mobility": return "Mobility";
    case "rest": return "Rest";
    default: return type.replace("_", " ");
  }
}

function DayHero({ week, day, showOutdoor = true, restOverride = false, onMakeRest, onUndoRest }: { week: number; day: DayPlan; showOutdoor?: boolean; restOverride?: boolean; onMakeRest?: () => void; onUndoRest?: () => void }) {
  const [editing, setEditing] = useState(false);
  const ctx = useRefine();
  const tier = useTier();
  const isPro = hasTier(tier, "pro");
  // Free users get the COMPLETE daily workout for their first 7 days from signup.
  // Video demos remain Pro-only regardless of week.
  const access = useQuery({
    queryKey: ["access-status"],
    queryFn: () => getAccessStatus(),
    staleTime: 60_000,
  });
  const withinFreeWeekOne = (access.data?.currentDay ?? 1) <= 7;
  const canSeeFullWorkout = isPro || withinFreeWeekOne;
  const isRest = day.type === "rest" || restOverride;

  if (isRest) {
    return (
      <div className="card-elevated p-6 text-center">
        <p className="label-mono text-gold">Day {day.day} · Rest</p>
        <p className="font-display text-2xl mt-2">Take it easy today.</p>
        <p className="text-sm text-muted-foreground mt-2">Rest is part of getting stronger. Sleep early, drink water, take a walk.</p>
        <Link
          to={"/app/outdoor" as never}
          className="mt-5 inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-md bg-gold text-gold-foreground text-sm font-semibold hover:opacity-90"
        >
          Take an easy walk →
        </Link>
        {restOverride && onUndoRest && (
          <button
            type="button"
            onClick={onUndoRest}
            className="mt-3 block mx-auto text-[11px] label-mono text-muted-foreground hover:text-foreground"
          >
            Undo · bring back today's workout
          </button>
        )}
      </div>
    );
  }

  const estMin = Math.max(20, day.exercises.length * 6);
  const doneCount = day.exercises.reduce(
    (n, _ex, i) => n + (ctx?.doneSet[doneKey(week, day.day, i)] ? 1 : 0),
    0,
  );
  const pct = day.exercises.length > 0 ? Math.round((doneCount / day.exercises.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5">
        <p className="label-mono text-xs uppercase tracking-wide font-semibold text-primary">Day {day.day} · {friendlyType(day.type)}</p>
        <h2 className="font-display text-2xl mt-1 leading-tight font-semibold text-[color:var(--text-primary)]">{day.title}</h2>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <div className="rounded-md bg-[color:var(--bg-sunken)] border border-[color:var(--border-default)] px-2 py-2 text-center">
            <div className="font-display text-base font-semibold leading-tight text-[color:var(--text-primary)]">{day.exercises.length}</div>
            <div className="label-mono text-[11px] uppercase tracking-wide text-[color:var(--text-tertiary)] mt-0.5">exercises</div>
          </div>
          <div className="rounded-md bg-[color:var(--bg-sunken)] border border-[color:var(--border-default)] px-2 py-2 text-center">
            <div className="font-display text-base font-semibold leading-tight text-[color:var(--text-primary)]">~{estMin}</div>
            <div className="label-mono text-[11px] uppercase tracking-wide text-[color:var(--text-tertiary)] mt-0.5">minutes</div>
          </div>
          <div className={`rounded-md border px-2 py-2 text-center ${doneCount > 0 ? "bg-primary/10 border-primary/30" : "bg-[color:var(--bg-sunken)] border-[color:var(--border-default)]"}`}>
            <div className={`font-display text-base font-semibold leading-tight ${doneCount > 0 ? "text-primary" : "text-[color:var(--text-primary)]"}`}>{doneCount} / {day.exercises.length}</div>
            <div className="label-mono text-[11px] uppercase tracking-wide text-[color:var(--text-tertiary)] mt-0.5">done</div>
          </div>
        </div>
        {day.exercises.length > 0 && (
          <div className="mt-3 h-1.5 rounded-full bg-[color:var(--bg-sunken)] overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        {onMakeRest && (
          <button
            type="button"
            onClick={onMakeRest}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[color:var(--border-default)] text-xs font-medium text-[color:var(--text-secondary)] hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Coffee className="h-3.5 w-3.5" /> Make today a rest day
          </button>
        )}
      </div>


      {showOutdoor && (day.type === "conditioning" || day.type === "active_recovery") && (
        <Link
          to={"/app/outdoor" as never}
          className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition min-h-12"
        >
          <div className="min-w-0">
            <p className="label-mono text-primary text-xs uppercase tracking-wide font-semibold">Outdoor option</p>
            <p className="text-sm mt-0.5 truncate text-foreground/80">Loop from your door — distance & route ready.</p>
          </div>
          <span className="text-primary shrink-0">→</span>
        </Link>
      )}

      {day.exercises.length > 0 && doneCount >= day.exercises.length ? (
        <div className="card-elevated p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center">
            <Check className="h-6 w-6" />
          </div>
          <p className="font-display text-2xl mt-3 font-semibold">Workout complete.</p>
          <p className="text-sm text-foreground/70 mt-1">Day {day.day} locked in. Rest, hydrate, breathe.</p>
        </div>
      ) : day.exercises.length > 0 && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-mono text-xs uppercase tracking-wide text-primary font-semibold">Exercises · tap Done as you go</p>
            <button
              onClick={() => setEditing((e) => !e)}
              aria-label={editing ? "Finish editing" : "Edit exercises"}
              className={`label-mono text-[11px] uppercase font-semibold inline-flex items-center gap-1 px-2.5 h-8 rounded ${editing ? "bg-primary/10 text-primary" : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] border border-[color:var(--border-default)]"}`}
            >
              <Settings2 className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
            </button>
          </div>
          <ul>
            {day.exercises.slice(0, canSeeFullWorkout ? day.exercises.length : 0).map((ex, i) => (
              <ExerciseRow
                key={i}
                index={i}
                ex={ex}
                exKey={`${week}|${day.day}|${i}`}
                editing={editing}
                week={week}
                dayN={day.day}
                totalInDay={day.exercises.length}
                videoUnlocked={isPro}
              />
            ))}
          </ul>
          {!canSeeFullWorkout && day.exercises.length > 0 && (
            <div className="mt-3">
              <TierGate
                currentTier={tier}
                minTier="pro"
                feature="full_workout"
                title="Week 1 is on us. Keep the habit — go Pro."
                description="You got the complete daily workout free for 7 days. Pro unlocks every day beyond Week 1, plus video demos for every move and unlimited swaps."
              >
                <></>
              </TierGate>
            </div>
          )}
          {canSeeFullWorkout && !isPro && withinFreeWeekOne && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Week 1 is on us · {Math.max(1, 8 - (access.data?.currentDay ?? 1))} day{Math.max(1, 8 - (access.data?.currentDay ?? 1)) === 1 ? "" : "s"} left. Video demos unlock with Pro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

