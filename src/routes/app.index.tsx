import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { getToday, submitCheckin, type TodaySnapshot } from "@/lib/dashboard.functions";
import {
  getTodayNutrition,
  logMeal,
  deleteMeal,
  type TodayNutrition,
} from "@/lib/nutrition.functions";
import { logMealsBulk } from "@/lib/nutrition-bulk.functions";
import { estimateMeal } from "@/lib/meal-estimator.functions";
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Flame,
  Apple,
  ArrowRight,
  Plus,
  Trash2,
  Wind,
  Sparkles,
  Activity,
  Heart,
  Camera,
  Pencil,
  Shuffle,
  BookHeart,
  Brain,
  FlaskConical,
} from "lucide-react";

import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionLabel } from "@/components/ui/gold-divider";
import { HeroSurface, heroSalutation } from "@/components/HeroSurface";
import { TrackPill } from "@/components/TrackPill";

import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { celebrate, streakMilestoneCrossed, programMilestone } from "@/lib/celebrate";
import { checkCombinedStreakAndCelebrate } from "@/lib/streak-celebrate";
import { playChime } from "@/lib/sound";
import { pickRecommendations, type RecKind } from "@/lib/recommendations";
import { BreathingSheet } from "@/components/BreathingSheet";
import { AffirmationSheet } from "@/components/AffirmationSheet";
import { MobilityResetSheet } from "@/components/MobilityResetSheet";
import { WeeklyCheckinCard } from "@/components/WeeklyCheckinCard";
import { AdminMessageInbox } from "@/components/AdminMessageInbox";
import { ReferralCard } from "@/components/ReferralCard";
import { MemberDiscountCard } from "@/components/MemberDiscountCard";
import { getWeeklyCheckinStatus, type WeeklyCheckinStatus } from "@/lib/weekly-checkin.functions";
import {
  getTodayMode,
  setTodayMode,
  clearTodayMode,
  type DailyTrainingMode,
} from "@/lib/daily-training.functions";
import { DailyTrainingModeSheet } from "@/components/DailyTrainingModeSheet";
import { modalityById, sessionFor } from "@/lib/training-modalities";
import { getDailyQuote, type DailyQuote } from "@/lib/daily-quote.functions";
import { generatePlanIfMissing } from "@/lib/onboarding.functions";
import { ensureCurrentPhase } from "@/lib/profile.functions";
import { getBestVideoUrl } from "@/lib/exercise-library";
import { ExternalLink } from "lucide-react";
import { CandyRxCard } from "@/components/CandyRxCard";
import { ConsultCard } from "@/components/ConsultCard";
import { Play } from "lucide-react";
import { MindsetCard } from "@/components/MindsetCard";
import { MultiMealForm } from "@/components/MultiMealForm";
import { maybeFireDailyFinale } from "@/components/DailyFinaleOverlay";
import { TrophyPreviewCard } from "@/components/TrophyPreviewCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTodayMindset } from "@/lib/mindset.functions";
import { getTodayAnchor } from "@/lib/spirit.functions";
import { getMyStreaks } from "@/lib/streaks.functions";
import { getFaithSettings } from "@/lib/faith.functions";

import { VacationBanner } from "@/components/VacationBanner";
import { TodayProtocolCard } from "@/components/medications/TodayProtocolCard";
import { BaselinePhotoNudge } from "@/components/BaselinePhotoNudge";
import { MoreForYouCard } from "@/components/MoreForYouCard";
import { DemoCoachRoutingPreview } from "@/components/DemoCoachRoutingPreview";
import { DailyLoopCard } from "@/components/outdoor/DailyLoopCard";
import { GymStatusCard } from "@/components/gym/GymStatusCard";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { HeroCheckinCard } from "@/components/rebuilt/HeroCheckinCard";
import { TopMissionCard } from "@/components/rebuilt/TopMissionCard";
import { MergedReflectCard } from "@/components/rebuilt/MergedReflectCard";
import { topMissionFor } from "@/lib/readiness-score";
import { readSnapshot, writeSnapshot } from "@/lib/today-cache";

/* ============================================================================
 * TODAY SCREEN — ELEMENT WALK (every tap target must reach a real screen)
 *
 *  ✅ TopMissionCard           → /app/plan or /app/checkin/today (readiness-driven)
 *  ✅ HeroCheckinCard          → /app/checkin/today
 *  ✅ VacationBanner           → /app/settings (vacation toggle)
 *  ✅ BaselinePhotoNudge       → /app/progress (photo capture)
 *  ✅ dueMirror card           → /app/mirror/$id
 *  ✅ MindsetCard              → inline (mindset rep + reflection sheet)
 *  ✅ RecChip breathing        → BreathingSheet (modal)
 *  ✅ RecChip affirmation      → AffirmationSheet (modal)
 *  ✅ RecChip mobility         → MobilityResetSheet (modal)
 *  ✅ Today's anchor card      → /app/spirit (faith mode only)
 *  ✅ Spirit / Check-in tile   → /app/spirit or /app/achievements
 *  ✅ Progress tile            → /app/progress
 *  ✅ DemoCoachRoutingPreview  → demo-only; routes via coach
 *  ✅ TrophyPreviewCard        → /app/achievements
 *  ✅ MoreForYouCard           → respective upsell routes
 *  ✅ AskCoachFooter           → /app/coach
 *  ✅ DailyTrainingModeSheet   → opens sheet, persists via setTodayMode
 *  ✅ MealSheet                → opens sheet, writes via logMeal / logMealsBulk
 *
 *  No dead taps. No blank states. No full-screen spinner on cold open.
 * ========================================================================== */


const PROGRAM_DAYS = 30;

type FinaleCopy = { eyebrow: string; title: string; body: string; cta: string };
const FINALE_COPY: Record<number, FinaleCopy> = {
  29: {
    eyebrow: `INTEGRATION · DAY 29 / ${PROGRAM_DAYS}`,
    title: "Almost there. Lock it in.",
    body: "No new programming today. Walk. Stretch. Breathe deep. The work is done — let the body absorb what you built.",
    cta: "Sit with it — open your journal",
  },
  30: {
    eyebrow: `FINAL DAY · DAY 30 / ${PROGRAM_DAYS}`,
    title: "Day 30. You're not the same person.",
    body: "Last day of the build. One more check-in — then look at where you started. That's the proof.",
    cta: "Close it out — final check-in",
  },
};
const POST_PROGRAM_COPY: FinaleCopy = {
  eyebrow: `PROGRAM COMPLETE · ${PROGRAM_DAYS} / ${PROGRAM_DAYS}`,
  title: "Thirty days. You showed up every time.",
  body: "Most people quit by week two. You didn't. This is a chapter — not a finish line. Take a beat, then write the next one.",
  cta: "See how far you've come",
};

// Use UTC date so it matches the server's date keys (Cloudflare Worker is UTC).
function localTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/app/")({ component: Dashboard, errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />, notFoundComponent: () => <RouteNotFound /> });

function Dashboard() {
  const initialDate = localTodayISO();
  const [t, setTRaw] = useState<TodaySnapshot | null>(
    () => readSnapshot<TodaySnapshot>("today", initialDate) ?? null,
  );
  const [n, setNRaw] = useState<TodayNutrition | null>(
    () => readSnapshot<TodayNutrition>("nutrition", initialDate) ?? null,
  );
  const [weekly, setWeekly] = useState<WeeklyCheckinStatus | null>(null);
  const [dailyMode, setDailyMode] = useState<DailyTrainingMode | null>(
    () => readSnapshot<DailyTrainingMode>("daily-mode", initialDate) ?? null,
  );
  const [dailyQuote, setDailyQuote] = useState<DailyQuote | null>(
    () => readSnapshot<DailyQuote>("daily-quote", initialDate) ?? null,
  );
  const [pulseKey, setPulseKey] = useState(0);
  const setT = useCallback((v: TodaySnapshot | null) => {
    setTRaw(v);
    if (v) writeSnapshot("today", localTodayISO(), v);
  }, []);
  const setN = useCallback((v: TodayNutrition | null) => {
    setNRaw(v);
    if (v) writeSnapshot("nutrition", localTodayISO(), v);
  }, []);

  const [showModeSheet, setShowModeSheet] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showMeal, setShowMeal] = useState(false);
  const [mealInit, setMealInit] = useState<{ mode?: MealMode; hint?: string }>({});
  const [activeRec, setActiveRec] = useState<RecKind | null>(null);
  const [markingDone, setMarkingDone] = useState(false);
  // (video sheet replaced with direct YouTube link)
  const trainingRef = useRef<HTMLElement | null>(null);
  const [salutation, setSalutation] = useState("Welcome");
  const [today, setToday] = useState<string>(() => localTodayISO());
  const [actualToday, setActualToday] = useState<string>(() => localTodayISO());
  const [previewNext, setPreviewNext] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const generateMissingPlan = useServerFn(generatePlanIfMissing);
  const completionOrderRef = useRef<Map<string, number>>(new Map());
  const prevTopKeyRef = useRef<string | null>(null);
  const [topHighlightKey, setTopHighlightKey] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Mindset & anchor todo state — same query keys as the mission rows so all
  // three reads share one cache entry and one invalidation refreshes both the
  // section card AND the mission tick.
  const mindsetTodo = useQuery({
    queryKey: ["mindset-today-todo", today],
    queryFn: () => getTodayMindset({ data: { date: today } }),
    enabled: sessionReady,
    staleTime: 30_000,
  });
  const anchorTodo = useQuery({
    queryKey: ["spirit-today-todo", today],
    queryFn: () => getTodayAnchor({ data: { date: today } }),
    enabled: sessionReady,
    staleTime: 30_000,
  });
  const myStreaks = useQuery({
    queryKey: ["my-streaks"],
    queryFn: () => getMyStreaks(),
    enabled: sessionReady,
    staleTime: 60_000,
  });
  const faithSettings = useQuery({
    queryKey: ["faith-settings"],
    queryFn: () => getFaithSettings(),
    enabled: sessionReady,
    staleTime: 5 * 60_000,
  });
  const faithEnabled = faithSettings.data?.faith_mode_enabled === true;
  const dueMirror = useQuery({
    queryKey: ["due-mirror"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { getDueMirror } = await import("@/lib/identity.functions");
      try {
        return await getDueMirror();
      } catch (e) {
        if (/Unauthorized/i.test((e as Error).message)) return null;
        throw e;
      }
    },
    enabled: sessionReady,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    setSalutation(heroSalutation());
  }, []);

  const reload = useCallback(
    async (date = today) => {
      try {
        // Bail entirely if there's no live session — avoids 401 noise from background
        // server fns when the user has just signed out or the page is loading post-redirect.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setSessionReady(false);
          return;
        }
        setSessionReady(true);

        // Silent auto-renew: if the current 12-week phase has expired, generate the next one.
        ensureCurrentPhase()
          .then((res) => {
            if (res?.renewed) {
              toast.success(`New 12-week phase generated · Phase ${res.phase_number}`);
              // Re-pull plans so the UI flips to the new phase
              getToday({ data: { date } })
                .then(setT)
                .catch(() => {});
            }
          })
          .catch((e) => console.warn("ensureCurrentPhase failed", e));

        const [td, nu, wk, dm, dq] = await Promise.all([
          getToday({ data: { date } }),
          getTodayNutrition({ data: { date } }),
          getWeeklyCheckinStatus(),
          getTodayMode({ data: { date } }),
          getDailyQuote({ data: { date } }),
        ]);
        setT(td);
        setN(nu);
        setWeekly(wk);
        setDailyMode(dm);
        if (dm) writeSnapshot("daily-mode", date, dm);
        setDailyQuote(dq);
        if (dq) writeSnapshot("daily-quote", date, dq);
        // If onboarding completed but no plan rows yet, generate them in the background.
        // Guard on a live access_token — `getUser()` above can succeed via cookies even
        // when the browser session hasn't finished restoring, which would cause the
        // serverFn to fire without an Authorization header and 401.
        if (td && !td.todayWorkout && !td.nutrition) {
          const { data: sess } = await supabase.auth.getSession();
          if (sess.session?.access_token) {
            generateMissingPlan()
              .then(async () => {
                const [nextToday, nextNutrition] = await Promise.all([
                  getToday({ data: { date } }),
                  getTodayNutrition({ data: { date } }),
                ]);
                setT(nextToday);
                setN(nextNutrition);
              })
              .catch((e) => console.warn("background plan generation failed", e));
          }
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [generateMissingPlan, today],
  );

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("log") === "catchup") {
      setMealInit({ mode: "catchup" });
      setShowMeal(true);
      // Strip the query param without a full reload.
      params.delete("log");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  // One-time timezone writeback so server-side day boundaries follow the user's local day.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "rebuilt:tz-synced";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      if (window.localStorage.getItem(key) === tz) return;
      import("@/lib/streaks.functions").then(({ setMyTimezone }) => {
        setMyTimezone({ data: { timezone: tz } })
          .then(() => { try { window.localStorage.setItem(key, tz); } catch {} })
          .catch(() => {});
      });
    } catch {}
  }, []);

  // Day-rollover watcher: when the local calendar date changes (midnight crossed,
  // tab re-foregrounded, or window refocused), reset the checklist by refetching
  // today's data so yesterday's completion state doesn't carry over.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastRefresh = 0;
    function refreshTodayState(now: string) {
      reload(now);
      queryClient.invalidateQueries({ queryKey: ["mindset-today-todo", now] });
      queryClient.invalidateQueries({ queryKey: ["spirit-today-todo", now] });
    }
    function check() {
      const now = localTodayISO();
      setActualToday(now);
      setToday((prev) => {
        if (prev !== now) {
          // New day — reset checklist + any open day-bound UI so yesterday's
          // state doesn't bleed through.
          reload(now);
          setDailyMode(null);
          setPreviewNext(false);
          setShowMeal(false);
          setShowCheckin(false);
          setShowModeSheet(false);
          setActiveRec(null);
          setMealInit({});
          queryClient.invalidateQueries({ queryKey: ["mindset-today-todo"] });
          queryClient.invalidateQueries({ queryKey: ["spirit-today-todo"] });
          queryClient.invalidateQueries({ queryKey: ["achievements-summary"] });
          return now;
        }
        // Same day — but the user just refocused the tab or came back from a
        // section page. Throttled refresh so completions in /app/plan,
        // /app/nutrition, /app/spirit, etc. tick the mission immediately.
        const elapsed = Date.now() - lastRefresh;
        if (elapsed > 5_000) {
          lastRefresh = Date.now();
          refreshTodayState(now);
        }
        return prev;
      });
    }
    const id = window.setInterval(check, 60_000);
    window.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [queryClient, reload]);

  // Daily finale: fire once when all six visible todos are complete.
  useEffect(() => {
    if (!t || !n) return;
    const modeSession = dailyMode ? sessionFor(dailyMode.modality) : null;
    const effectiveWorkout = modeSession ?? t.todayWorkout;
    const trainingDone =
      (t.lastCheckin?.date === today && t.lastCheckin.workout_completed) ||
      !effectiveWorkout ||
      effectiveWorkout.exercises.length === 0;
    const calsHit = !!(n.targets && n.totals.calories >= n.targets.calories);
    const protHit = !!(n.targets && n.totals.protein_g >= n.targets.protein_g);
    const checkinDone = t.checkinDoneToday;
    const mindsetDone = !!mindsetTodo.data?.completedAt;
    const anchorDone = !faithEnabled || !!anchorTodo.data?.reflection;
    const allDone = trainingDone && calsHit && protHit && checkinDone && mindsetDone && anchorDone;
    if (allDone) maybeFireDailyFinale(true);
  }, [t, n, dailyMode, today, mindsetTodo.data?.completedAt, anchorTodo.data?.reflection, faithEnabled]);

  // No full-screen spinner on cold open. If there's no cached snapshot yet
  // (true first visit, never logged in here before), render a lightweight
  // inline skeleton so the layout doesn't jump and the hero CTA still appears
  // the moment data arrives.
  if (!t) {
    return (
      <div className="min-h-dvh px-4 sm:px-6 max-w-md mx-auto pt-12 pb-8 space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-[color:var(--bg-raised)] border border-border/40" />
        <div className="h-20 rounded-2xl bg-[color:var(--bg-raised)] border border-border/40" />
        <div className="h-40 rounded-2xl bg-[color:var(--bg-raised)] border border-border/40" />
        <p className="text-center label-mono text-gold-shimmer text-xs">Loading your day…</p>
      </div>
    );
  }

  // `today` from state above re-renders this block on rollover
  // Override today's prescribed workout if the user picked a modality for today.
  const modeSession = dailyMode ? sessionFor(dailyMode.modality) : null;
  const effectiveWorkout = modeSession ?? t.todayWorkout;
  const trainingDone =
    (t.lastCheckin?.date === today && t.lastCheckin.workout_completed) ||
    !effectiveWorkout ||
    effectiveWorkout.exercises.length === 0;
  const calsHit = !!(n && n.targets && n.totals.calories >= n.targets.calories);
  const protHit = !!(n && n.targets && n.totals.protein_g >= n.targets.protein_g);
  const checkinDone = t.checkinDoneToday;
  const recs = pickRecommendations(t.lastCheckin, today);
  const topMission = topMissionFor(t);

  async function markTrainingDone() {
    if (markingDone) return;
    setMarkingDone(true);

    // ===== OPTIMISTIC: tick the UI, fire celebration, pulse the hero NOW.
    const snapshot = t;
    const c = t!.lastCheckin;
    const wasCheckinDone = !!t!.checkinDoneToday;
    const optimistic: TodaySnapshot = {
      ...t!,
      checkinDoneToday: true,
      streak: t!.streak + (wasCheckinDone ? 0 : 1),
      lastCheckin: {
        date: today,
        mood: c?.mood ?? 7,
        energy: c?.energy ?? 7,
        stress: c?.stress ?? 4,
        sleep_hours: c?.sleep_hours ?? 7,
        workout_completed: true,
      },
    };
    setT(optimistic);
    setPulseKey((k) => k + 1);
    playChime("victory");
    celebrate("burst", { toast: "Another rep in the bank." });
    setPreviewNext(false);

    // ===== Background write with rollback.
    try {
      await submitCheckin({
        data: {
          date: today,
          mood: c?.mood ?? 7,
          energy: c?.energy ?? 7,
          stress: c?.stress ?? 4,
          sleep_hours: c?.sleep_hours ?? 7,
          workout_completed: true,
          notes: null,
        },
      });
      reload(today);
    } catch (e) {
      // Roll back to the snapshot and offer a quiet retry — never block the tap.
      if (snapshot) setT(snapshot);
      toast.error((e as Error).message || "Didn't save", {
        action: { label: "Retry", onClick: () => void markTrainingDone() },
      });
    } finally {
      setMarkingDone(false);
    }
  }

  function openTodo(kind: "training" | "calories" | "protein" | "checkin") {
    if (kind === "training")
      trainingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (kind === "calories" || kind === "protein") {
      setMealInit({});
      setShowMeal(true);
    } else if (kind === "checkin") setShowCheckin(true);
  }

  const headline = t.checkinDoneToday
    ? "You showed up today. Proud of you."
    : "Show up for the person you're becoming.";

  return (
    <div className="min-h-dvh">
      {/* ============= CINEMATIC HERO ============= */}
      <HeroSurface height="58vh">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="label-mono text-gold/90">
              REBUILT · DAY {Math.min(t.dayNumber, PROGRAM_DAYS)} / {PROGRAM_DAYS}
            </span>
            {t.streak > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-gold/50 bg-background/40 backdrop-blur-md">
                <Flame
                  className={`h-3.5 w-3.5 text-gold ${t.streak >= 3 ? "animate-pulse" : ""}`}
                />
                <span className="label-mono text-gold text-xs">{t.streak} day streak</span>
              </span>
            )}
          </div>
          <div>
            <p className="label-mono text-foreground/70">
              {salutation}
              {t.firstName ? `, ${t.firstName}` : ""}
            </p>
            <h1 className="mt-2 font-display text-[2.6rem] sm:text-5xl leading-[0.98] tracking-tight text-foreground drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]">
              {headline}
            </h1>
          </div>
          {/* Hero CTA moved out of HeroSurface to the top of the main column. */}
        </motion.div>
      </HeroSurface>

      {/* Main column */}
      <div className="px-4 sm:px-6 max-w-md mx-auto space-y-6 pb-8 -mt-2 relative">
        {/* Track toggle — one tap flips coach, voices, and copy */}
        <TrackPill />

        {/* ===== READINESS-DRIVEN TOP MISSION (one line of coach reason) ===== */}
        <TopMissionCard mission={topMission} />

        {/* ===== REBUILT v2 HERO CTA — the single most important element ===== */}
        <HeroCheckinCard
          completed={checkinDone}
          streak={t.streak}
          pulseKey={pulseKey}
          micro={{
            body: trainingDone,
            mind: !!mindsetTodo.data?.completedAt,
            faith: faithEnabled ? !!anchorTodo.data?.reflection : undefined,
          }}
        />

        {/* ============= BANNERS (conditional, urgent-only) ============= */}
        <VacationBanner />
        <BaselinePhotoNudge />

        {dueMirror.data && (
          <Link
            to={"/app/mirror/$id" as never}
            params={{ id: dueMirror.data.id } as never}
            className="block card-elevated p-5 border-gold/60 hover:border-gold transition-colors animate-count-up"
          >
            <p className="label-mono text-gold text-xs">
              The Mirror · Month {dueMirror.data.milestone_month}
            </p>
            <h3 className="font-display text-2xl mt-2 leading-tight">Look yourself in the eye.</h3>
            <p className="text-sm text-muted-foreground mt-2 italic">
              "{dueMirror.data.contract_statement}"
            </p>
            <p className="label-mono text-xs text-gold/70 mt-3">Tap to face it →</p>
          </Link>
        )}

        <div className="space-y-4">
          <SectionLabel>Today</SectionLabel>

          {/* ============= 3. TODAY'S WORKOUT — shortcut to Train ============= */}
          {effectiveWorkout && effectiveWorkout.exercises.length > 0 && (
            <Link
              to="/app/plan"
              className="card-elevated p-5 hover:border-gold/60 transition-colors flex items-center justify-between gap-3 animate-count-up"
              style={{ animationDelay: "80ms" }}
            >
              <div className="min-w-0">
                <p className="label-mono text-gold flex items-center gap-1.5">
                  <Dumbbell className="h-3 w-3" /> Today's workout
                </p>
                <p className="mt-1 font-display text-lg leading-tight truncate text-[color:var(--text-primary)]">
                  {effectiveWorkout.title || "Session ready"}
                </p>
                <p className="mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">
                  {effectiveWorkout.exercises.length} exercise{effectiveWorkout.exercises.length === 1 ? "" : "s"} · ~{Math.max(15, effectiveWorkout.exercises.length * 5)} min
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          )}

          {/* ============= 4. NEXT MEAL — shortcut to Fuel ============= */}
          {n?.sample_day && n.sample_day.length > 0 && (() => {
            const eatenNames = new Set((n.meals ?? []).map((m) => m.name.toLowerCase()));
            const next = n.sample_day.find((s) => !eatenNames.has(s.name.toLowerCase())) ?? n.sample_day[0];
            return (
              <Link
                to="/app/nutrition"
                className="card-elevated p-5 hover:border-gold/60 transition-colors flex items-center justify-between gap-3 animate-count-up"
                style={{ animationDelay: "120ms" }}
              >
                <div className="min-w-0">
                  <p className="label-mono text-gold flex items-center gap-1.5">
                    <Apple className="h-3 w-3" /> Next meal · {next.meal}
                  </p>
                  <p className="mt-1 font-display text-lg leading-tight truncate text-[color:var(--text-primary)]">
                    {next.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">
                    {next.calories} kcal · {next.protein_g}g protein
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })()}

          {/* ============= 5. BLUE BREATHE RESET — the only reset card ============= */}
          {(() => {
            const y = new Date(today + "T00:00:00Z");
            y.setUTCDate(y.getUTCDate() - 1);
            const yKey = y.toISOString().slice(0, 10);
            const missedYesterday =
              !t.checkinDoneToday && (!t.lastCheckin || t.lastCheckin.date !== yKey);
            const headline = missedYesterday
              ? "Rough day? Breathe, then check in."
              : "60-second reset";
            const sub = missedYesterday
              ? "One minute to settle. You're still in this."
              : "Guided orb · Box · 4-7-8 · Sigh";
            return (
              <Link
                to="/app/breathe"
                className="relative block overflow-hidden rounded-2xl p-5 min-h-[92px] active:scale-[0.99] transition-transform"
                style={{
                  background:
                    "radial-gradient(120% 100% at 15% 0%, hsl(205 60% 45% / 0.35) 0%, transparent 55%), radial-gradient(120% 100% at 100% 100%, hsl(30 85% 55% / 0.28) 0%, transparent 55%), linear-gradient(180deg, hsl(240 25% 10% / 0.85), hsl(240 30% 6% / 0.9))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 12px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
                aria-label={`${headline}. ${sub}`}
              >
                <div
                  aria-hidden
                  className="absolute -right-6 -top-6 h-32 w-32 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(205 90% 65% / 0.55) 0%, hsl(268 70% 55% / 0.25) 45%, transparent 70%)",
                    filter: "blur(2px)",
                  }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="label-mono text-[10px]" style={{ color: "#f0d68a" }}>Reset</p>
                    <p className="mt-1 font-display text-lg leading-tight" style={{ color: "rgba(255,255,255,0.96)" }}>{headline}</p>
                    <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.78)" }}>{sub}</p>
                  </div>
                  <div className="grid place-items-center h-12 w-12 rounded-full shrink-0"
                    style={{
                      background: "radial-gradient(circle, hsl(205 90% 65% / 0.9) 0%, hsl(205 90% 40% / 0.5) 70%)",
                      boxShadow: "0 0 24px hsl(205 90% 65% / 0.55)",
                    }}
                  >
                    <Wind className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* ============= 6. MERGED REFLECT — one card, rotating ============= */}
          <MergedReflectCard
            date={today}
            faithEnabled={faithEnabled}
            dailyQuote={dailyQuote?.text ?? t.affirmation ?? null}
          />

          {/* Mood-prompt row — only when there's a meaningful recommendation */}
          {recs[0] && recs[0].kind !== "calm" && recs[0].kind !== "checkin" && (
            <div className="space-y-2">
              <p className="label-mono text-xs text-muted-foreground flex items-center gap-1.5">
                <Heart className="h-3 w-3" /> How you're feeling
              </p>
              {recs.map((r) => (
                <RecChip
                  key={r.kind}
                  kind={r.kind}
                  reason={r.reason}
                  onOpen={() => setActiveRec(r.kind)}
                />
              ))}
            </div>
          )}

          {/* Demo-only routing preview (kept — pattern-triggered) */}
          <DemoCoachRoutingPreview />

          {/* Trophy Room, Bring a Friend, and Member Perks moved to You tab. */}

          {/* ============= 8. MORE FOR YOU (collapsed upsells) ============= */}
          <MoreForYouCard />

          <AskCoachFooter prompt="In your head? Talk to P. Coach, not chatbot." />
        </div>
      </div>


      {/* CheckinSheet removed — daily check-in is now inline on /app/checkin */}
      {showMeal && (
        <MealSheet
          date={today}
          sample={n?.sample_day ?? []}
          prev={n}
          onClose={() => setShowMeal(false)}
          onDone={() => {
            setShowMeal(false);
            setPreviewNext(false);
            reload(today);
          }}
          initialMode={mealInit.mode}
          initialHint={mealInit.hint}
        />
      )}
      {activeRec === "breathing" && <BreathingSheet onClose={() => setActiveRec(null)} />}
      {activeRec === "affirmation" && (
        <AffirmationSheet pool={t.affirmations} onClose={() => setActiveRec(null)} />
      )}
      {activeRec === "mobility" && <MobilityResetSheet onClose={() => setActiveRec(null)} />}
      {/* video sheet removed — replaced with direct YouTube links */}
      <DailyTrainingModeSheet
        open={showModeSheet}
        currentModalityId={dailyMode?.modality ?? null}
        onClose={() => setShowModeSheet(false)}
        onPick={async ({ id, category, equipment }) => {
          try {
            const next = await setTodayMode({
              data: { date: today, modality: id, category, equipment },
            });
            setDailyMode(next);
            setShowModeSheet(false);
            toast.success("Today's mode set");
            checkCombinedStreakAndCelebrate();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function MindsetTodoRow({ date, forceUndone = false }: { date: string; forceUndone?: boolean }) {
  const { data } = useQuery({
    queryKey: ["mindset-today-todo", date],
    queryFn: () => getTodayMindset({ data: { date } }),
    staleTime: 30_000,
  });
  const done = !forceUndone && !!data?.completedAt;
  const onClick = () => {
    const el = document.getElementById("mindset-card");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <TodoRow
      done={done}
      label="Mindset rep"
      sub={done ? "Locked in." : (data?.repTitle ?? "2 minutes")}
      onClick={onClick}
    />
  );
}

function AnchorTodoRow({ date, forceUndone = false }: { date: string; forceUndone?: boolean }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["spirit-today-todo", date],
    queryFn: () => getTodayAnchor({ data: { date } }),
    staleTime: 30_000,
  });
  const done = !forceUndone && !!data?.reflection;
  const sub = done ? "Reflected." : data?.anchor?.theme ? data.anchor.theme : "2 minutes";
  return (
    <TodoRow
      done={done}
      label="Today's anchor"
      sub={sub}
      onClick={() => navigate({ to: "/app/spirit", search: { from: "today", date } })}
    />
  );
}

function TodoRow({
  done,
  label,
  sub,
  onClick,
}: {
  done: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-gold shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
          >
            {label}
          </p>
          <p className="text-xs text-muted-foreground truncate">{sub}</p>
        </div>
        {!done && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
    </li>
  );
}

function RecChip({ kind, reason, onOpen }: { kind: RecKind; reason: string; onOpen: () => void }) {
  const meta = {
    breathing: { icon: Wind, label: "Box breathing", sub: "2 min" },
    affirmation: { icon: Sparkles, label: "Affirmation reset", sub: "1 min" },
    mobility: { icon: Activity, label: "Mobility reset", sub: "5 min" },
    calm: { icon: Heart, label: "Steady", sub: "" },
    checkin: { icon: CheckCircle2, label: "Check in", sub: "" },
  }[kind];
  const Icon = meta.icon;
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:border-gold/60 transition-colors text-left"
    >
      <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {meta.label} <span className="text-xs text-muted-foreground">· {meta.sub}</span>
        </p>
        <p className="text-xs text-muted-foreground truncate">{reason}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function NutritionCard({
  n,
  onAdd,
  onDelete,
}: {
  n: TodayNutrition;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const target = n.targets;
  const pct =
    target && target.calories > 0
      ? Math.min(100, Math.round((n.totals.calories / target.calories) * 100))
      : 0;
  return (
    <section className="card-elevated p-5 animate-count-up" style={{ animationDelay: "240ms" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Apple className="h-3 w-3" /> Nutrition
          </p>
          <p className="mt-2 font-display text-3xl leading-none text-gold-shimmer">
            {n.totals.calories}
            <span className="text-base text-muted-foreground">
              {" "}
              / {target?.calories ?? "—"} kcal
            </span>
          </p>
        </div>
        <button
          onClick={onAdd}
          className="h-9 px-3 rounded-md border border-gold/40 text-xs label-mono text-gold hover:bg-gold/5 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Log meal
        </button>
      </div>
      {target && (
        <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold/60 to-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MacroBar label="Protein" cur={n.totals.protein_g} target={target?.protein_g ?? 0} />
        <MacroBar label="Carbs" cur={n.totals.carbs_g} target={target?.carbs_g ?? 0} />
        <MacroBar label="Fat" cur={n.totals.fat_g} target={target?.fat_g ?? 0} />
      </div>
      {n.meals.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {n.meals.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 text-sm border-t border-border/60 pt-2"
            >
              <div className="min-w-0">
                <p className="label-mono text-xs">{m.meal}</p>
                <p className="truncate">{m.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="label-mono text-gold">{m.calories} kcal</span>
                <button
                  onClick={() => onDelete(m.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {n.meals.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Nothing logged yet today.</p>
      )}
    </section>
  );
}

function MacroBar({ label, cur, target }: { label: string; cur: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="label-mono">{label}</p>
        <p className="text-xs text-muted-foreground">
          {cur}
          <span className="text-muted-foreground/60">/{target || "—"}g</span>
        </p>
      </div>
      <div className="mt-1 h-1 rounded-full bg-border overflow-hidden">
        <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type MealMode = "manual" | "photo" | "describe" | "catchup";

function MealSheet({
  date,
  sample,
  prev,
  onClose,
  onDone,
  initialMode,
  initialHint,
}: {
  date: string;
  sample: { meal: string; name: string; calories: number; protein_g: number }[];
  prev: TodayNutrition | null;
  onClose: () => void;
  onDone: () => void;
  initialMode?: MealMode;
  initialHint?: string;
}) {
  const [mode, setMode] = useState<MealMode>(initialMode ?? "manual");
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [busy, setBusy] = useState(false);

  // estimator state
  const [description, setDescription] = useState("");
  const [photoData, setPhotoData] = useState<{
    base64: string;
    mime: string;
    preview: string;
    blob: Blob | null;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [advice, setAdvice] = useState<string>("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);

  // multi-select from plan
  const [picked, setPicked] = useState<number[]>([]); // indexes into sample, in tap order
  const [showCustom, setShowCustom] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  function togglePick(i: number) {
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  const SLOT_TIMES: Record<"breakfast" | "lunch" | "dinner" | "snack", string> = {
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "19:00",
    snack: "15:30",
  };
  function slotIsoFor(slot: "breakfast" | "lunch" | "dinner" | "snack") {
    const t = SLOT_TIMES[slot];
    const d = new Date(`${date}T00:00:00`);
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.toISOString();
  }

  async function saveSelected() {
    if (picked.length === 0) return;
    setBulkBusy(true);
    try {
      const meals = picked.map((idx) => {
        const s = sample[idx];
        const slot = s.meal.toLowerCase() as "breakfast" | "lunch" | "dinner" | "snack";
        const safeSlot = (["breakfast", "lunch", "dinner", "snack"] as const).includes(slot)
          ? slot
          : "snack";
        return {
          meal: safeSlot,
          name: s.name.slice(0, 120),
          calories: Math.max(0, Math.round(s.calories)),
          protein_g: Math.max(0, Math.round(s.protein_g)),
          carbs_g: 0,
          fat_g: 0,
          logged_at: slotIsoFor(safeSlot),
        };
      });
      const res = await logMealsBulk({ data: { meals } });
      checkCombinedStreakAndCelebrate();
      celebrate("sparkle", { toast: `Logged ${res.count} meal${res.count === 1 ? "" : "s"}.` });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  function fillFromSample(s: { meal: string; name: string; calories: number; protein_g: number }) {
    setMeal((s.meal.toLowerCase() as "breakfast" | "lunch" | "dinner" | "snack") || "breakfast");
    setName(s.name);
    setKcal(String(s.calories));
    setP(String(s.protein_g));
    setAdvice("");
    setConfidence(null);
  }

  function applyEstimate(e: {
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: "high" | "medium" | "low";
    advice: string;
  }) {
    setName(e.name);
    setKcal(String(e.calories));
    setP(String(e.protein_g));
    setC(String(e.carbs_g));
    setF(String(e.fat_g));
    setConfidence(e.confidence);
    setAdvice(e.advice ?? "");
  }

  async function onPhotoPick(file: File) {
    try {
      const { compressImage } = await import("@/lib/compress-image");
      const c = await compressImage(file, { maxBytes: 900_000 });
      setPhotoData({ base64: c.base64, mime: c.mime, preview: c.dataUrl, blob: c.blob });
      setAdvice("");
      setConfidence(null);
    } catch {
      toast.error("Could not read photo.");
    }
  }

  async function runEstimate() {
    if (mode === "photo" && !photoData) {
      toast.error("Add a photo first.");
      return;
    }
    if (mode === "describe" && description.trim().length < 2) {
      toast.error("Describe what you ate.");
      return;
    }
    setEstimating(true);
    try {
      const hint = initialHint ? `${meal} - ${initialHint}` : meal;
      const result = await estimateMeal({
        data:
          mode === "photo"
            ? {
                kind: "photo" as const,
                image_base64: photoData!.base64,
                mime: photoData!.mime,
                meal_hint: hint,
              }
            : { kind: "text" as const, description: description.trim(), meal_hint: hint },
      });
      applyEstimate(result);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEstimating(false);
    }
  }

  async function save() {
    const calories = Number(kcal) || 0;
    if (!name.trim() || calories <= 0) {
      toast.error("Add a name and calories.");
      return;
    }
    setBusy(true);
    try {
      const protein = Number(p) || 0;
      const carbs = Number(c) || 0;
      const fat = Number(f) || 0;
      let photo_path: string | null = null;
      if (photoData?.blob) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const ext = photoData.mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("meal-photos")
            .upload(path, photoData.blob, { contentType: photoData.mime, upsert: false });
          if (!upErr) photo_path = path;
        }
      }
      await logMeal({
        data: {
          date,
          meal,
          name: name.trim(),
          calories,
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
          photo_path,
        },
      });
      checkCombinedStreakAndCelebrate();

      const target = prev?.targets;
      if (target) {
        const prevK = prev.totals.calories;
        const nextK = prevK + calories;
        const prevP = prev.totals.protein_g;
        const nextP = prevP + protein;
        if (target.protein_g > 0 && prevP < target.protein_g && nextP >= target.protein_g) {
          celebrate("cannons", { toast: "Protein target hit." });
        } else if (target.calories > 0 && prevK < target.calories && nextK >= target.calories) {
          celebrate("sparkle", { toast: "Calorie target hit." });
        } else {
          toast.success("Logged.");
        }
      } else {
        toast.success("Logged.");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-elevated border-t sm:border rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Log meal{mode === "catchup" ? "s" : ""}</h2>
          <button onClick={onClose} className="label-mono">
            Close
          </button>
        </div>

        {/* Mode tabs */}
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto snap-x snap-mandatory px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["manual", "Plan", null],
              ["photo", "Photo", Camera],
              ["describe", "Describe", Pencil],
              ["catchup", "Catch up", Plus],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`shrink-0 snap-start h-9 px-3 rounded-md text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap border ${mode === m ? "bg-card text-gold border-gold/50" : "bg-muted/60 text-muted-foreground border-transparent"}`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />} {label}
            </button>
          ))}
        </div>

        {mode === "catchup" && <MultiMealForm date={date} onDone={onDone} />}

        {mode !== "catchup" && (
          <>
            {mode === "manual" && sample.length > 0 && (
              <div className="mb-5">
                <p className="label-mono text-gold mb-2">Quick add from your plan</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Tap any that you ate — log them all in one shot.
                </p>
                <div className="flex flex-wrap gap-2">
                  {sample.map((s, i) => {
                    const order = picked.indexOf(i);
                    const on = order >= 0;
                    return (
                      <button
                        key={i}
                        onClick={() => togglePick(i)}
                        onDoubleClick={() => fillFromSample(s)}
                        className={`h-8 px-3 rounded-full border text-xs inline-flex items-center gap-1.5 transition-colors ${on ? "border-gold bg-gold/10 text-gold ring-1 ring-gold/40" : "border-border hover:border-gold"}`}
                      >
                        {on && (
                          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-gold text-gold-foreground text-xs font-semibold">
                            {order + 1}
                          </span>
                        )}
                        {s.name}{" "}
                        <span className={on ? "text-gold/70" : "text-muted-foreground"}>
                          · {s.calories}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {picked.length > 0 &&
                  (() => {
                    const sel = picked.map((i) => sample[i]);
                    const totalK = sel.reduce((a, s) => a + s.calories, 0);
                    const totalP = sel.reduce((a, s) => a + s.protein_g, 0);
                    return (
                      <div className="mt-4 space-y-3">
                        <p className="text-[11px] text-muted-foreground">
                          Selected {picked.length} · {totalK} kcal · P {totalP}g
                        </p>
                        <button
                          onClick={saveSelected}
                          disabled={bulkBusy}
                          className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60"
                        >
                          {bulkBusy
                            ? "Logging…"
                            : `Log selected meal${picked.length === 1 ? "" : "s"} (${picked.length})`}
                        </button>
                        <button
                          onClick={() => setPicked([])}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Clear selection
                        </button>
                      </div>
                    );
                  })()}
              </div>
            )}

            {mode === "photo" && (
              <div className="mb-5">
                {photoData ? (
                  <div className="relative">
                    <img
                      src={photoData.preview}
                      alt="meal"
                      loading="lazy"
                      decoding="async"
                      className="w-full max-h-56 object-cover rounded-md border border-border aspect-[4/3]"
                    />
                    <button
                      onClick={() => setPhotoData(null)}
                      className="absolute top-2 right-2 h-8 px-3 rounded-full bg-background/80 backdrop-blur text-xs"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <label className="block border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-gold">
                    <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm">Take or upload a photo of your meal</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Straight above, good light works best.
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onPhotoPick(file);
                      }}
                    />
                  </label>
                )}
                <button
                  onClick={runEstimate}
                  disabled={!photoData || estimating}
                  className="mt-3 h-11 w-full rounded-md bg-gold text-gold-foreground text-sm font-medium disabled:opacity-50"
                >
                  {estimating ? "Reading the plate…" : "Estimate from photo"}
                </button>
              </div>
            )}

            {mode === "describe" && (
              <div className="mb-5">
                <label className="text-xs text-muted-foreground">Tell P what you ate</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 2 slices pepperoni pizza and a large Coke"
                  className="mt-1.5 w-full min-h-[88px] rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
                />
                <button
                  onClick={runEstimate}
                  disabled={description.trim().length < 2 || estimating}
                  className="mt-3 h-11 w-full rounded-md bg-gold text-gold-foreground text-sm font-medium disabled:opacity-50"
                >
                  {estimating ? "Crunching numbers…" : "Estimate"}
                </button>
              </div>
            )}

            {advice && (
              <div
                className={`mb-4 p-3 rounded-md border ${confidence === "low" ? "border-gold/60 bg-gold/5" : "border-border"}`}
              >
                <p className="label-mono text-gold">P says</p>
                <p className="mt-1 text-xs italic text-foreground/90">{advice}</p>
              </div>
            )}

            {(() => {
              const collapse = mode === "manual" && picked.length > 0 && !showCustom;
              if (collapse) {
                return (
                  <button
                    onClick={() => setShowCustom(true)}
                    className="mt-2 w-full text-[11px] text-muted-foreground hover:text-gold underline-offset-4 hover:underline"
                  >
                    + Add a custom meal too
                  </button>
                );
              }
              return (
                <>
                  <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto snap-x snap-mandatory px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMeal(m)}
                        className={`shrink-0 snap-start h-9 px-4 rounded-md text-xs font-medium capitalize transition-all whitespace-nowrap border ${meal === m ? "bg-card text-gold border-gold/50" : "bg-muted/60 text-muted-foreground border-transparent"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <label className="text-xs text-muted-foreground">What did you eat?</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chicken and rice"
                    className="mt-1.5 w-full h-11 rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
                  />

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <NumField label="kcal" value={kcal} onChange={setKcal} />
                    <NumField label="P (g)" value={p} onChange={setP} />
                    <NumField label="C (g)" value={c} onChange={setC} />
                    <NumField label="F (g)" value={f} onChange={setF} />
                  </div>

                  <button
                    onClick={save}
                    disabled={busy}
                    className="btn-gold mt-5 h-12 w-full rounded-md text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save meal"}
                  </button>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground label-mono">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-md border border-border bg-input px-2 text-sm text-center focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-2xl text-foreground">{value}</p>
      <p className="label-mono mt-0.5">{label}</p>
    </div>
  );
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function CheckinSheet({
  date,
  prevStreak,
  dayNumber,
  onClose,
  onDone,
}: {
  date: string;
  prevStreak: number;
  dayNumber: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(4);
  const [sleep, setSleep] = useState(7);
  const [workout, setWorkout] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await submitCheckin({
        data: {
          date,
          mood,
          energy,
          stress,
          sleep_hours: sleep,
          workout_completed: workout,
          notes: notes || null,
        },
      });

      // Celebrations — in priority order; biggest one wins.
      const nextStreak = prevStreak + 1; // today wasn't in the streak yet
      const programM = programMilestone(dayNumber);
      const streakM = streakMilestoneCrossed(prevStreak, nextStreak);

      if (programM) {
        celebrate("fireworks", { milestone: programM });
      } else if (streakM) {
        celebrate("fireworks", { toast: `${streakM}-day streak. Locked in.` });
      } else if (workout) {
        playChime("victory");
        celebrate("burst", { toast: "Workout logged." });
      } else {
        playChime("ding");
        toast.success("Logged.");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-elevated border-t sm:border rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-2xl">Check in</h2>
          <button onClick={onClose} className="label-mono">
            Close
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">No wrong answers.</p>

        <Slider label="Mood" value={mood} onChange={setMood} />
        <Slider label="Energy" value={energy} onChange={setEnergy} />
        <Slider label="Stress" value={stress} onChange={setStress} />
        <Slider
          label="Sleep last night"
          value={sleep}
          onChange={setSleep}
          suffix=" hrs"
          max={12}
          min={0}
          step={0.5}
        />

        <button
          onClick={() => setWorkout(!workout)}
          className={`mt-4 w-full h-12 rounded-md border text-sm font-medium transition-all ${workout ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
        >
          {workout ? "✓ Workout done" : "Mark workout done"}
        </button>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything else (optional)…"
          className="mt-3 w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
        />

        <button
          onClick={save}
          disabled={busy}
          className="btn-gold mt-5 h-12 w-full rounded-md text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save check-in"}
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  suffix = " / 10",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        <span className="label-mono text-foreground">
          {value}
          {suffix === " / 10" ? ` / ${max}` : suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold)]"
      />
    </div>
  );
}
