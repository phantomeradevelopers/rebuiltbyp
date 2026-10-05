import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Sparkles, Trophy } from "lucide-react";
import { getFirstWeekRecap, type Week1Recap } from "@/lib/week1-recap.functions";
import { UpgradeSheet } from "./UpgradeSheet";
import { isUpgradeDismissed } from "@/lib/upgrade-dismiss";

const FEATURE = "week1-recap";
const SEEN_KEY = "rebuilt:week1-recap-seen";

/**
 * Honest Week-1 recap. Only shows AFTER day 7 for free users, once.
 * Real numbers only, no fake stats. Framed as "keep going", never
 * "you'll lose everything".
 */
export function Week1RecapCard() {
  const fn = useServerFn(getFirstWeekRecap);
  const [data, setData] = useState<Week1Recap | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(SEEN_KEY)) {
        setHidden(true);
      }
    } catch {}
    if (isUpgradeDismissed(FEATURE)) setHidden(true);
    (async () => {
      try {
        const r = await fn();
        setData(r);
      } catch {
        /* silent — this is a non-critical growth surface */
      }
    })();
  }, [fn]);

  if (hidden || !data || !data.eligible) return null;

  function dismiss() {
    try { window.localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setHidden(true);
  }

  const days = Math.min(7, data.checkins + data.workouts > 0 ? Math.max(data.checkins, 1) : 0);

  return (
    <>
      <section className="relative rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5 space-y-4">
        <button
          onClick={dismiss}
          aria-label="Dismiss recap"
          className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-md hover:bg-muted/30 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-gold">
          <Trophy className="h-4 w-4" />
          <p className="label-mono text-xs">Your first week</p>
        </div>
        <div>
          <h3 className="font-display text-2xl leading-tight">
            {data.firstName ? `${data.firstName}, look what you did.` : "Look what you did."}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Real numbers from your first 7 days. No spin.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat n={days} label="Days" />
          <Stat n={data.checkins} label="Check-ins" accent />
          <Stat n={data.workouts} label="Workouts" />
          <Stat n={data.meals} label="Meals" />
        </div>

        {data.currentCheckinStreak > 0 && (
          <p className="text-xs text-center text-foreground/80">
            Current streak: <span className="text-gold font-medium">{data.currentCheckinStreak} {data.currentCheckinStreak === 1 ? "day" : "days"}</span>
            {data.bestCheckinStreak > data.currentCheckinStreak && (
              <> · Best: {data.bestCheckinStreak}</>
            )}
          </p>
        )}

        <div className="hairline" />

        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-foreground">Keep the momentum.</span>{" "}
            <span className="text-muted-foreground">Pro unlocks the full stack so week two hits harder.</span>
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full h-11 btn-gold rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" /> See what Pro unlocks
          </button>
          <button
            onClick={dismiss}
            className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          — P. Signed, one week at a time.
        </p>
      </section>

      <UpgradeSheet
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature={FEATURE}
        title="Keep going — go Pro."
        description="You did the hard part. Pro is the whole toolkit for week two and beyond."
        unlocks={[
          "Unlimited daily check-ins with Coach P",
          "Full nutrition tracking — meals, macros, photos",
          "Adaptive training plan that evolves weekly",
          "All trophies + streak freeze tokens",
          "Fire-mode mindset drops · full library",
        ]}
      />
    </>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`font-display text-2xl tabular-nums ${accent ? "text-gold" : ""}`}>{n}</p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
