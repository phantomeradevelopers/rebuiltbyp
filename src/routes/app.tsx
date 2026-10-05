import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { DemoBar } from "@/components/DemoBar";
import { MilestoneOverlay } from "@/components/MilestoneOverlay";
import { FirstWinPushNudge } from "@/components/FirstWinPushNudge";
import { PushSubscriptionSync } from "@/components/PushSubscriptionSync";
import { PageTransition } from "@/components/PageTransition";
import { useGymGeofence } from "@/hooks/useGymGeofence";
import { getGymContext } from "@/lib/gyms.functions";
import { getAccessStatus, type AccessStatus } from "@/lib/access.functions";
import { StreakHeader } from "@/components/rebuilt/StreakHeader";

const AchievementUnlockOverlay = lazy(() =>
  import("@/components/AchievementUnlockOverlay").then((m) => ({
    default: m.AchievementUnlockOverlay,
  })),
);
const DailyFinaleOverlay = lazy(() =>
  import("@/components/DailyFinaleOverlay").then((m) => ({ default: m.DailyFinaleOverlay })),
);
const SwUpdatePrompt = lazy(() =>
  import("@/components/SwUpdatePrompt").then((m) => ({ default: m.SwUpdatePrompt })),
);
const MedicalDisclaimerGate = lazy(() =>
  import("@/components/MedicalDisclaimerGate").then((m) => ({ default: m.MedicalDisclaimerGate })),
);
const GymEntryOverlay = lazy(() =>
  import("@/components/gym/GymEntryOverlay").then((m) => ({ default: m.GymEntryOverlay })),
);
const FaithModePrompt = lazy(() =>
  import("@/components/FaithModePrompt").then((m) => ({ default: m.FaithModePrompt })),
);


export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const WELCOME_FLAG = "rebuilt_welcome_completed_v1";
const ACCESS_TTL_MS = 60_000;
let accessCache: { at: number; userId: string; value: AccessStatus } | null = null;

function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setUserId(null);
      setIsReady(true);
    }, 2500);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        setUserId(data.session?.user?.id ?? null);
        setIsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        setUserId(null);
        setIsReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setIsReady(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);
  return { isReady, userId };
}

function AppLayout() {
  const navigate = useNavigate();
  const { isReady, userId } = useAuthReady();
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal: { cancelled: boolean }, force = false) => {
      setErr(null);
      if (!userId) {
        accessCache = null;
        navigate({ to: "/login" as never, search: { redirect: "/app" } as never, replace: true });
        return;
      }
      if (
        !force &&
        accessCache &&
        accessCache.userId === userId &&
        Date.now() - accessCache.at < ACCESS_TTL_MS
      ) {
        setStatus(accessCache.value);
        return;
      }
      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("Connection is slow. Tap retry.")), 6500),
        );
        const s = await Promise.race([getAccessStatus(), timeout]);
        if (signal.cancelled) return;
        accessCache = { at: Date.now(), userId, value: s };
        // App is now free-to-use. Paid features are gated individually via MemberGate.
        // /no-access is only reachable for screener-failed users (below).
        const onConsultApply =
          typeof window !== "undefined" &&
          window.location.pathname === "/app/consult/apply";
        if (!s.onboardingComplete && !onConsultApply) {
          navigate({ to: "/onboarding" as never, replace: true });
          return;
        }
        if (s.screenerPassed === false) {
          navigate({ to: "/screener-fail" as never, replace: true });
          return;
        }

        if (typeof window !== "undefined") {
          const onGenderGate = window.location.pathname === "/app/gender-required";
          if (s.needsGender && !onGenderGate) {
            navigate({ to: "/app/gender-required" as never, replace: true });
            setStatus(s);
            return;
          }

          let seen = false;
          try {
            seen = localStorage.getItem(WELCOME_FLAG) === "1";
          } catch {
            seen = false;
          }
          const path = window.location.pathname;
          const intakeAllowed =
            path === "/app/welcome" ||
            path === "/app/identity" ||
            path === "/app/readiness" ||
            path === "/app/coach" ||
            path.startsWith("/app/consult") ||
            path.startsWith("/app/settings") ||
            path.startsWith("/app/account");
          if (!s.needsGender && !seen && !intakeAllowed) {
            navigate({ to: "/app/welcome" as never, replace: true });
            // The layout stays mounted across this redirect — render it, don't hang on the loader.
            setStatus(s);
            return;
          }
        }

        setStatus(s);
      } catch (e) {
        if (!signal.cancelled) setErr((e as Error).message);
      }
    },
    [navigate, userId],
  );

  useEffect(() => {
    if (!isReady) return;
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load, attempt, isReady]);

  if (err) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-6 bg-background">
        <span className="font-wordmark text-foreground text-base">REBUILT</span>
        <div className="space-y-2 max-w-sm">
          <h1 className="font-display text-2xl leading-tight">Connection dropped.</h1>
          <p className="text-sm text-muted-foreground">{err} We don't quit here — tap retry.</p>
        </div>
        <button
          onClick={() => {
            accessCache = null;
            setErr(null);
            setStatus(null);
            setAttempt((a) => a + 1);
          }}
          className="h-12 px-8 rounded-full bg-gold text-gold-foreground text-sm font-medium shadow-[0_8px_32px_-8px_oklch(0.74_0.10_80/0.6)] active:scale-95 transition-transform"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isReady || !status) {
    return <AppBootLoader onRetry={() => setAttempt((a) => a + 1)} />;
  }

  return (
    <div className={`min-h-dvh bg-background pb-nav ${status.isDemo ? "pt-28" : ""}`}>
      {status.isDemo && <DemoBar initialDay={status.currentDay} />}
      <SettingsGearButton />
      <StreakHeader />
      <PageTransition>
        <Outlet />
      </PageTransition>
      <BottomNav />
      <MilestoneOverlay />
      <FirstWinPushNudge />
      <PushSubscriptionSync />
      <Suspense fallback={null}>
        <AchievementUnlockOverlay />
        <DailyFinaleOverlay />
        <SwUpdatePrompt />
        <MedicalDisclaimerGate />
        <GymEntryOverlay />
        <FaithModePrompt />
      </Suspense>

      <GymGeofenceMount />
    </div>
  );
}

function SettingsGearButton() {
  const { pathname } = useLocation();
  const hidden =
    pathname.startsWith("/app/settings") ||
    pathname === "/app/welcome" ||
    pathname === "/app/gender-required";
  if (hidden) return null;
  return (
    <div
      className="fixed top-0 right-0 z-30 pointer-events-none"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <Link
        to={"/app/settings" as never}
        aria-label="Settings"
        preload="intent"
        className="pointer-events-auto mr-3 mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 backdrop-blur-md text-muted-foreground hover:text-gold hover:border-gold/50 transition-colors active:scale-95"
      >
        <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function GymGeofenceMount() {
  const fetchCtx = useServerFn(getGymContext);
  const { data } = useQuery({
    queryKey: ["gym-context"],
    queryFn: () => fetchCtx(),
    staleTime: 30_000,
  });
  useGymGeofence(data ?? null);
  return null;
}

const BOOT_LINES = [
  "Locking in your plan…",
  "Pulling today's mission…",
  "The work is loading…",
  "Showing up. Same as you.",
];

function AppBootLoader({ onRetry }: { onRetry?: () => void }) {
  const [i, setI] = useState(0);
  const [showRetry, setShowRetry] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % BOOT_LINES.length), 1600);
    const t = window.setTimeout(() => setShowRetry(true), 8000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t);
    };
  }, []);
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 bg-background px-6">
      <span className="font-wordmark text-foreground text-base motion-safe:animate-[pulse_2.5s_ease-in-out_infinite]">
        REBUILT
      </span>
      <p
        key={i}
        className="label-mono text-gold text-xs motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
      >
        {BOOT_LINES[i]}
      </p>
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 h-10 px-6 rounded-full border border-gold/40 text-gold text-xs label-mono active:scale-95 transition-transform"
        >
          Taking too long? Tap to retry
        </button>
      )}
    </div>
  );
}
