import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ScrollText, Activity, MessageCircle, CheckCircle2, Sparkles } from "lucide-react";
import { getWelcomeStatus } from "@/lib/welcome.functions";
import { getAccessStatus } from "@/lib/access.functions";
import { PageSkeleton } from "@/components/skeletons";
import { RouteError } from "@/components/RouteError";
import { GymPickerCard } from "@/components/gym/GymPickerCard";
import { motion } from "motion/react";
import { HeroGlyph } from "@/components/brand/HeroGlyph";
import { useTrack } from "@/lib/track";
import { trackCopy } from "@/lib/track-copy";
import { StepBackdrop } from "@/components/brand/StepBackdrop";
import { headlineVariants, subVariants, DUR, REBUILT_EASE } from "@/lib/motion";
import { SignatureSeal } from "@/components/brand/SignatureSeal";


export const Route = createFileRoute("/app/welcome")({
  component: WelcomePage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

const WELCOME_FLAG = "rebuilt_welcome_completed_v1";

function isWelcomeFlagged() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(WELCOME_FLAG) === "1"; } catch { return false; }
}

function setWelcomeFlag() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(WELCOME_FLAG, "1"); } catch {}
}

function WelcomePage() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getWelcomeStatus);
  const fetchAccess = useServerFn(getAccessStatus);
  const { track } = useTrack();

  const status = useQuery({ queryKey: ["welcome-status"], queryFn: () => fetchStatus(), staleTime: 0 });
  const access = useQuery({ queryKey: ["welcome-access"], queryFn: () => fetchAccess(), staleTime: 0 });

  // If user already completed all three steps, celebrate briefly then bounce.
  useEffect(() => {
    if (!status.data) return;
    if (status.data.hasIdentityContract && status.data.hasFirstReadiness && status.data.hasFirstCoachMessage) {
      setWelcomeFlag();
      const t = setTimeout(() => navigate({ to: "/app" as never, replace: true }), 1400);
      return () => clearTimeout(t);
    }
  }, [status.data, navigate]);

  if (status.isLoading || access.isLoading) return <PageSkeleton />;

  const s = status.data;
  const firstName = access.data?.firstName ?? null;

  const steps = [
    {
      key: "identity",
      done: !!s?.hasIdentityContract,
      icon: ScrollText,
      title: "Write your identity contract",
      desc: "One sentence that defines who you're becoming. You'll sign it.",
      to: "/app/identity",
      cta: "Write it",
    },
    {
      key: "readiness",
      done: !!s?.hasFirstReadiness,
      icon: Activity,
      title: "Your first readiness check-in",
      desc: "60 seconds: sleep, energy, mood. Sets your baseline.",
      to: "/app/readiness",
      cta: "Check in",
    },
    {
      key: "coach",
      done: !!s?.hasFirstCoachMessage,
      icon: MessageCircle,
      title: "Meet your coach",
      desc: "Ask one thing. Anything you've been avoiding.",
      to: "/app/coach",
      cta: "Open coach",
    },
  ] as const;

  const allDone = steps.every((st) => st.done);
  const completedCount = steps.filter((st) => st.done).length;

  function finish() {
    setWelcomeFlag();
    navigate({ to: "/app" as never, replace: true });
  }

  return (
    <div className="relative px-6 pt-safe pt-10 max-w-md mx-auto space-y-7 pb-12 overflow-hidden">
      <StepBackdrop stepKey="welcome" />
      <div className="relative z-10 flex justify-center -mb-2">
        <HeroGlyph name="ring" size={120} />
      </div>
      <header className="relative z-10 space-y-2">
        <motion.div
          variants={headlineVariants}
          initial="hidden"
          animate="show"
          transition={{ duration: DUR.headline, ease: REBUILT_EASE, delay: 0.15 }}
          className="flex items-center gap-2 label-mono text-gold"
        >
          <Sparkles className="h-3 w-3" />
          Welcome{firstName ? `, ${firstName}` : ""}
        </motion.div>
        <motion.p
          variants={subVariants}
          initial="hidden"
          animate="show"
          transition={{ duration: DUR.headline, ease: REBUILT_EASE, delay: 0.18 }}
          className="label-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {trackCopy(track, "heroTagline")}
        </motion.p>
        <motion.h1
          variants={headlineVariants}
          initial="hidden"
          animate="show"
          transition={{ duration: DUR.headline, ease: REBUILT_EASE, delay: 0.22 }}
          className="font-display text-3xl sm:text-4xl leading-tight"
        >
          Three small things, then you're in.
        </motion.h1>
        <motion.p
          variants={subVariants}
          initial="hidden"
          animate="show"
          transition={{ duration: DUR.headline, ease: REBUILT_EASE, delay: 0.32 }}
          className="text-sm text-muted-foreground"
        >
          You can skip any of these — but doing them now sets the foundation. About 4 minutes total.
        </motion.p>

        <div className="mt-4 h-1.5 w-full rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full bg-gold"
            initial={false}
            animate={{ width: `${(completedCount / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: REBUILT_EASE }}
          />
        </div>
        <p className="text-[10px] label-mono text-muted-foreground flex items-center gap-1">
          {completedCount} of {steps.length} complete
          {allDone && <CheckCircle2 className="h-3 w-3 text-gold" />}
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((st, i) => {
          const Icon = st.icon;
          const firstIncomplete = steps.findIndex((x) => !x.done);
          const isNext = !st.done && i === firstIncomplete;
          return (
            <li key={st.key}>
              <Link
                to={st.to as never}
                className={`block rounded-xl border p-4 transition-all duration-200 will-change-[border-color,background-color] active:scale-[0.98] ${
                  st.done
                    ? "border-gold/40 bg-gold/5"
                    : isNext
                    ? "border-gold/60 bg-card shadow-[0_0_0_1px_var(--gold)]/10"
                    : "border-border bg-card hover:border-gold/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    st.done ? "bg-gold text-gold-foreground" : isNext ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                  }`}>
                    {st.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="label-mono text-[10px] text-muted-foreground">Step {i + 1}</p>
                      {isNext && (
                        <span className="label-mono text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">Next</span>
                      )}
                    </div>
                    <p className="font-display text-lg leading-tight mt-0.5">{st.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{st.desc}</p>
                  </div>
                  {!st.done && (
                    <div className="flex items-center text-xs label-mono text-gold shrink-0 mt-1">
                      {st.cta} <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <GymPickerCard />



      <div className="space-y-2 pt-2">
        {allDone && (
          <div className="flex flex-col items-center gap-1.5 pb-2">
            <p className="font-display text-base text-foreground/85">Welcome to the rebuild.</p>
            <SignatureSeal size="sm" prefix="—" opacity={0.75} />
          </div>
        )}
        <button
          onClick={finish}
          className="btn-gold h-12 w-full rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          {allDone ? "Enter the app" : "Skip the rest, take me in"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-[10px] text-muted-foreground">You can always come back to these from More.</p>
      </div>
    </div>
  );
}
