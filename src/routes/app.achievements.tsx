import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, Eye, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAchievements, type AchievementWithStatus } from "@/lib/achievements.functions";
import { AchievementBadge } from "@/components/AchievementBadge";
import { TrophyGalleryModal } from "@/components/TrophyGalleryModal";
import { CardSkeleton, ListSkeleton } from "@/components/skeletons";
import { getBillingStatus } from "@/lib/billing.functions";
import { UpgradeSheet } from "@/components/UpgradeSheet";

export const Route = createFileRoute("/app/achievements")({
  head: () => ({ meta: [{ title: "Trophy Room — Rebuilt" }] }),
  component: AchievementsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-3 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

const CATS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "streak", label: "Streaks" },
  { key: "commitment", label: "Commitment" },
  { key: "milestone", label: "Milestones" },
  { key: "hidden", label: "Hidden" },
];

function AchievementsPage() {
  const [cat, setCat] = useState("all");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => getBillingStatus(),
    enabled: authReady,
    staleTime: 60_000,
  });
  const isFree = billing ? !billing.isPro : false;

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthReady(!!data.user);
    });
    return () => { cancelled = true; };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["achievements-full"],
    queryFn: () => listAchievements(),
    enabled: authReady,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="px-4 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto space-y-4">
        <CardSkeleton lines={3} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  const filtered: AchievementWithStatus[] = data.items.filter((i) => cat === "all" ? true : i.category === cat);
  const pct = Math.min(100, Math.round(((data.stats.totalXp - data.stats.prevLevelXp) / Math.max(1, data.stats.nextLevelXp - data.stats.prevLevelXp)) * 100));

  return (
    <div className="px-4 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <header className="mt-4 card-elevated p-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle at 80% 0%, rgba(234,179,8,0.18) 0%, transparent 55%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 label-mono text-gold"><Trophy className="h-3 w-3" /> Your collection</div>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl text-gold-shimmer leading-none">Trophy Room</h1>
          <p className="mt-2 text-sm text-muted-foreground">Earn trophies for showing up. Five tiers — Recruit, Soldier, Warrior, Champion, Legend — each one demands more war than the last.</p>
          <button
            onClick={() => setGalleryOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-gold/40 text-xs label-mono text-gold hover:bg-gold/10 transition"
          >
            <Eye className="h-3.5 w-3.5" /> Show every trophy
          </button>

          <div className="mt-5 flex items-end justify-between">
            <div>
              {data.stats.level > 0 ? (
                <>
                  <p className="font-display text-3xl leading-none">Lvl {data.stats.level}</p>
                  <p className="mt-1 label-mono text-muted-foreground">{data.stats.unlockedCount} / {data.stats.totalCount} unlocked</p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl leading-tight">
                    Level 1 in {Math.max(1, data.stats.nextLevelXp - data.stats.totalXp)} XP
                  </p>
                  <p className="mt-1 label-mono text-muted-foreground">Your first trophies unlock as you show up</p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="font-display text-3xl text-gold">{data.stats.totalXp}</p>
              <p className="label-mono text-muted-foreground">Total XP</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold/80 to-gold" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.stats.level > 0
              ? `${data.stats.nextLevelXp - data.stats.totalXp} XP to Lvl ${data.stats.level + 1}`
              : "Every check-in earns XP toward Level 1."}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Streak" value={data.stats.longestStreak} />
            <Stat label="Workouts" value={data.stats.totalWorkouts} />
            <Stat label="Mind reps" value={data.stats.totalMindsetReps} />
          </div>
        </div>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`shrink-0 h-9 px-4 rounded-full text-xs font-medium transition-all ${cat === c.key ? "bg-gold text-gold-foreground" : "bg-muted/60 text-muted-foreground"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {isFree && (
        <button
          onClick={() => setUpgradeOpen(true)}
          className="mt-4 w-full card-elevated p-4 border-gold/30 hover:border-gold/60 transition flex items-center gap-3 text-left"
        >
          <div className="h-9 w-9 rounded-full bg-gold/15 border border-gold/40 inline-flex items-center justify-center text-gold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">You're earning the starter set.</p>
            <p className="text-xs text-muted-foreground">Upgrade to Pro to unlock the full trophy catalog and advanced XP tiers.</p>
          </div>
          <Lock className="h-4 w-4 text-gold" />
        </button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filtered.map(({ key, ...rest }) => <AchievementBadge key={key} achievementKey={key} {...rest} />)}
      </div>


      <TrophyGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <UpgradeSheet
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="trophies"
        title="Unlock all trophies"
        description="Free lets you preview the trophy room. Pro unlocks real progress, XP gain, and earned trophies."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-2xl">{value}</p>
      <p className="label-mono text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
