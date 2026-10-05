import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, BookHeart, ArrowRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { getWeeklyCheckinStatus } from "@/lib/weekly-checkin.functions";
import { getMyStreaks } from "@/lib/streaks.functions";
import { WeeklyCheckinCard } from "@/components/WeeklyCheckinCard";
import { DailyMetricsCard } from "@/components/DailyMetricsCard";
import { SectionLabel } from "@/components/ui/gold-divider";
import { ReferralCard } from "@/components/ReferralCard";
import { Week1RecapCard } from "@/components/Week1RecapCard";


import { AskCoachFooter } from "@/components/AskCoachFooter";
import { DailyMissionList } from "@/components/DailyMissionList";
import { InlineCheckin } from "@/components/InlineCheckin";
import { TodayProtocolCard } from "@/components/medications/TodayProtocolCard";
import { AdminMessageInbox } from "@/components/AdminMessageInbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AboutAppSheet } from "@/components/AboutAppSheet";


export const Route = createFileRoute("/app/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in — Rebuilt" },
      { name: "description", content: "Your daily accountability hub." },
    ],
  }),
  component: CheckinPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function CheckinPage() {
  const weeklyFn = useServerFn(getWeeklyCheckinStatus);
  const streaksFn = useServerFn(getMyStreaks);

  const weekly = useQuery({ queryKey: ["weekly-checkin"], queryFn: () => weeklyFn() });
  const streaks = useQuery({ queryKey: ["my-streaks"], queryFn: () => streaksFn() });

  // Sunday popup: auto-open the weekly check-in when due, but only once per
  // week. Dismissing only hides the modal — the inline card remains visible
  // below until they actually submit.
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  useEffect(() => {
    if (!weekly.data?.isDue) return;
    const week = weekly.data.currentWeek;
    const key = `weekly-popup-seen-${week}`;
    if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
      setWeeklyOpen(true);
      window.localStorage.setItem(key, "1");
    }
  }, [weekly.data?.isDue, weekly.data?.currentWeek]);

  const checkinStreak = streaks.data?.find((s) => s.kind === "checkin");
  const journalStreak = streaks.data?.find((s) => s.kind === "journal");

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-md px-5 pt-10 space-y-8">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">Today</p>
          <h1 className="font-display text-3xl mt-2 font-semibold text-[color:var(--text-primary)]">How are you today?</h1>
          <p className="text-sm text-[color:var(--text-secondary)] mt-2">A short, honest read on where you're at. Around 90 seconds.</p>
          <AboutAppSheet />
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--rebuilt-gold)] animate-pulse" />
            Coach P sees your check-ins · you're not alone
          </p>
        </header>


        {/* Inline conversational check-in (replaces the old modal) */}
        <InlineCheckin />

        {/* Week 1 recap — real numbers, honest upgrade nudge (dismissible). */}
        <Week1RecapCard />

        {/* Admin / coach messages — surfaced here for accountability */}
        <AdminMessageInbox />

        {/* Today's mission — the to-do list lives here */}
        <DailyMissionList />





        {/* Daily push from P lives on the You tab now */}


        {/* Daily numbers */}
        <DailyMetricsCard />

        {/* Today's protocol (meds / supplements) */}
        <TodayProtocolCard />



        {/* Streaks */}
        <section>
          <SectionLabel>Streaks</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <StreakTile
              label="Check-in"
              count={checkinStreak?.current_count ?? 0}
              best={checkinStreak?.longest_count ?? 0}
            />
            <StreakTile
              label="Journal"
              count={journalStreak?.current_count ?? 0}
              best={journalStreak?.longest_count ?? 0}
            />
          </div>
        </section>

        {/* Weekly check-in — only when actually due */}
        {weekly.data?.isDue && (
          <section>
            <SectionLabel>This week</SectionLabel>
            <div className="mt-3">
              <WeeklyCheckinCard
                status={weekly.data}
                onSubmitted={() => {
                  weekly.refetch();
                  streaks.refetch();
                }}
              />
            </div>
          </section>
        )}

        {/* Journal quick link */}
        <section>
          <SectionLabel>Get it out of your head</SectionLabel>
          <Link
            to="/app/journal"
            preload="intent"
            className="mt-3 flex items-center justify-between card-elevated p-4 active:scale-[0.98] transition min-h-14"
          >
            <div className="flex items-center gap-3">
              <BookHeart className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-base">Open journal</p>
                <p className="text-sm text-foreground/70 mt-0.5">~2 minutes. That's it.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-foreground/60" />
          </Link>
        </section>

        {/* Built for you — referrals. */}
        <section>
          <SectionLabel>Built for you</SectionLabel>
          <div className="mt-3 space-y-3">
            <ReferralCard variant="compact" />
          </div>
        </section>


        {/* Ask P */}
        <AskCoachFooter prompt="Bad day? Off-plan? Tell P. P's been there." />
      </div>

      {/* Sunday popup — auto-opens once per week when due */}
      {weekly.data?.isDue && (
        <Dialog open={weeklyOpen} onOpenChange={setWeeklyOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 border-gold/40">
            <DialogHeader className="px-5 pt-5">
              <DialogTitle className="font-display text-2xl leading-tight">
                It's Sunday — let's reset.
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 pt-2">
              <WeeklyCheckinCard
                status={weekly.data}
                onSubmitted={() => {
                  weekly.refetch();
                  streaks.refetch();
                  setWeeklyOpen(false);
                }}
              />
              <button
                onClick={() => setWeeklyOpen(false)}
                className="mt-3 w-full h-10 rounded-md text-xs text-muted-foreground hover:text-foreground"
              >
                Not now — I'll do it later today
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Child route (/app/checkin/today) renders as a full-screen overlay on top. */}
      <Outlet />
    </div>
  );
}

function StreakTile({ label, count, best }: { label: string; count: number; best: number }) {
  const display = Math.round(useCountUp(count));
  return (
    <div className="rounded-2xl border border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] p-4">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-[color:var(--streak-fire)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-secondary)] font-semibold">{label}</span>
      </div>
      <p className="font-display text-3xl mt-2 font-semibold leading-none text-[color:var(--text-primary)] tabular-nums">
        {display}
        <span className="text-sm font-medium text-[color:var(--text-tertiary)] ml-1.5 uppercase tracking-[0.1em]">
          {count === 1 ? "day" : "days"}
        </span>
      </p>
      <p className="text-[11px] text-[color:var(--text-tertiary)] mt-1.5 uppercase tracking-[0.1em] font-mono">
        Best · {best} {best === 1 ? "day" : "days"}
      </p>
    </div>
  );
}
