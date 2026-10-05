import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Rarity = "bronze" | "silver" | "gold" | "platinum" | "mythic";

export type Achievement = {
  key: string;
  title: string;
  description: string;
  category: string;
  rarity: Rarity;
  xp: number;
  criteria: { type: string; threshold?: number };
  icon: string | null;
  hidden: boolean;
  sort_order: number;
  min_tier?: "free" | "pro";
};

export type UserAchievement = {
  achievement_key: string;
  unlocked_at: string;
  progress: Record<string, unknown>;
};

export type AchievementWithStatus = Achievement & {
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number; // 0-100
  current: number;
  target: number;
  lockedByTier: boolean;
};

export type AchievementStats = {
  totalXp: number;
  level: number;
  nextLevelXp: number;
  prevLevelXp: number;
  unlockedCount: number;
  totalCount: number;
  longestStreak: number;
  totalWorkouts: number;
  totalMeals: number;
  totalMindsetReps: number;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function xpToLevel(xp: number) {
  // level = floor(sqrt(xp / 50))
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50));
  const prev = level * level * 50;
  const next = (level + 1) * (level + 1) * 50;
  return { level, prev, next };
}

async function loadCounts(supabase: any, userId: string) {
  const [workoutsRes, mealsRes, mindsetRes, checkinsRes, weeklyRes, profileRes, weightsRes, anchorsRes, referralsRes, streakSavesRes] = await Promise.all([
    supabase.from("daily_checkins").select("date, workout_completed").eq("user_id", userId).order("date", { ascending: false }).limit(400),
    supabase.from("food_log").select("logged_at").eq("user_id", userId),
    supabase.from("mindset_logs").select("date, completed_at").eq("user_id", userId).not("completed_at", "is", null),
    supabase.from("daily_checkins").select("date, created_at").eq("user_id", userId).order("date", { ascending: false }).limit(400),
    supabase.from("weekly_checkins").select("id, submitted_at").eq("user_id", userId),
    supabase.from("user_profile").select("weight_kg, goal_weight_kg").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_log").select("weight_kg, logged_at").eq("user_id", userId).order("logged_at", { ascending: true }),
    supabase.from("anchor_reflections").select("anchor_date").eq("user_id", userId),
    supabase.from("user_profile").select("onboarding_completed_at").eq("referred_by", userId),
    supabase.from("reengagement_log").select("sent_at").eq("user_id", userId).eq("kind", "streak_save"),
  ]);
  const referralCount = (referralsRes.data ?? []).filter((r: any) => !!r.onboarding_completed_at).length;
  // Streak-save count: nudge sent AND user checked in same day after the nudge.
  const checkinDateSet = new Set<string>((checkinsRes.data ?? []).map((r: any) => r.date as string));
  const streakSaveCount = (streakSavesRes.data ?? []).filter((r: any) => {
    const d = new Date(r.sent_at).toISOString().slice(0, 10);
    return checkinDateSet.has(d);
  }).length;

  const anchorDates = new Set<string>((anchorsRes.data ?? []).map((r: any) => r.anchor_date));
  const totalAnchors = anchorDates.size;
  const anchorStreak = streakFromDates(anchorDates);

  // Workout count = checkins with workout_completed=true
  const totalWorkouts = (workoutsRes.data ?? []).filter((r: any) => r.workout_completed).length;
  const totalMeals = (mealsRes.data ?? []).length;
  const totalMindsetReps = (mindsetRes.data ?? []).length;
  const totalWeekly = (weeklyRes.data ?? []).length;

  // Checkin streak
  const checkinDates = new Set<string>((checkinsRes.data ?? []).map((r: any) => r.date));
  const checkinStreak = streakFromDates(checkinDates);

  // Mindset streak
  const mindsetDates = new Set<string>((mindsetRes.data ?? []).map((r: any) => r.date));
  const mindsetStreak = streakFromDates(mindsetDates);

  // Combined streak: workout-or-rest + meal logged + mindset done same day
  // Build per-day map
  const mealDates = new Set<string>(
    (mealsRes.data ?? []).map((r: any) => new Date(r.logged_at).toISOString().slice(0, 10)),
  );
  // Use checkins as proxy for "showed up + workout done or rest". Use all checkin dates.
  const combinedDates = new Set<string>();
  for (const d of checkinDates) {
    if (mealDates.has(d) && mindsetDates.has(d)) combinedDates.add(d);
  }
  const combinedStreak = streakFromDates(combinedDates);

  // Weight progress
  const startWeight = (weightsRes.data ?? [])[0]?.weight_kg ?? profileRes.data?.weight_kg ?? null;
  const currentWeight =
    (weightsRes.data ?? []).at(-1)?.weight_kg ?? profileRes.data?.weight_kg ?? null;
  const goalWeight = profileRes.data?.goal_weight_kg ?? null;
  let weightPct = 0;
  if (startWeight != null && currentWeight != null && goalWeight != null && startWeight !== goalWeight) {
    const total = Math.abs(Number(goalWeight) - Number(startWeight));
    const done = Math.abs(Number(currentWeight) - Number(startWeight));
    weightPct = Math.min(100, Math.round((done / total) * 100));
  }

  // Macro-perfect day count: requires sum per day vs targets. Skip exact compute (need plan join).
  // Approximation: count days with >=3 meals logged AND has checkin.
  const mealsPerDay = new Map<string, number>();
  for (const r of mealsRes.data ?? []) {
    const k = new Date((r as any).logged_at).toISOString().slice(0, 10);
    mealsPerDay.set(k, (mealsPerDay.get(k) ?? 0) + 1);
  }
  let macroPerfect = 0;
  for (const [d, n] of mealsPerDay) {
    if (n >= 3 && checkinDates.has(d)) macroPerfect += 1;
  }

  return {
    totalWorkouts,
    totalMeals,
    totalMindsetReps,
    totalWeekly,
    checkinStreak,
    mindsetStreak,
    combinedStreak,
    weightPct,
    macroPerfect,
    totalAnchors,
    anchorStreak,
    referralCount,
    streakSaveCount,
  };
}

function streakFromDates(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  const today = cursor.toISOString().slice(0, 10);
  if (!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const k = cursor.toISOString().slice(0, 10);
    if (!dates.has(k)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function currentForCriteria(c: Achievement["criteria"], counts: Awaited<ReturnType<typeof loadCounts>>): number {
  switch (c.type) {
    case "combined_streak": return counts.combinedStreak;
    case "mindset_streak": return counts.mindsetStreak;
    case "checkin_streak": return counts.checkinStreak;
    case "workout_count": return counts.totalWorkouts;
    case "meal_count": return counts.totalMeals;
    case "mindset_count": return counts.totalMindsetReps;
    case "weekly_count": return counts.totalWeekly;
    case "macro_perfect": return counts.macroPerfect;
    case "weight_progress": return counts.weightPct;
    case "anchor_count": return counts.totalAnchors;
    case "anchor_streak": return counts.anchorStreak;
    case "referral_count": return counts.referralCount;
    case "streak_save_count": return counts.streakSaveCount;
    default: return 0;
  }
}
async function getUserTier(supabase: any, userId: string): Promise<"free" | "pro" | "elite" | "lifetime_pro"> {
  try {
    const { data } = await supabase
      .from("user_profile")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();
    return ((data?.tier as string | undefined) ?? "free") as any;
  } catch {
    return "free";
  }
}


export const listAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: AchievementWithStatus[]; stats: AchievementStats }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const [catRes, ownedRes] = await Promise.all([
      supabase.from("achievements").select("*").order("sort_order", { ascending: true }),
      supabase.from("user_achievements").select("achievement_key, unlocked_at, progress").eq("user_id", userId),
    ]);
    const catalog: Achievement[] = (catRes.data ?? []) as Achievement[];
    const owned = new Map<string, UserAchievement>();
    for (const r of (ownedRes.data ?? []) as UserAchievement[]) owned.set(r.achievement_key, r);

    const counts = await loadCounts(supabase, userId);
    const userTier = await getUserTier(supabase, userId);
    const isPro = userTier !== "free";

    const items: AchievementWithStatus[] = catalog.map((a) => {
      const ua = owned.get(a.key);
      const target = a.criteria.threshold ?? 1;
      const current = currentForCriteria(a.criteria, counts);
      const progress = Math.min(100, Math.round((current / target) * 100));
      const minTier = (a.min_tier ?? "pro") as "free" | "pro";
      return {
        ...a,
        unlocked: !!ua,
        unlockedAt: ua?.unlocked_at ?? null,
        progress,
        current,
        target,
        lockedByTier: minTier === "pro" && !isPro && !ua,
      };
    });

    // Stats: prefer xp_ledger sum (server of record). Fallback to summing unlocked rows.
    const { data: ledgerRows } = await supabase
      .from("xp_ledger").select("delta").eq("user_id", userId);
    let totalXp = (ledgerRows ?? []).reduce((s: number, r: { delta: number }) => s + (r.delta ?? 0), 0);
    if (!ledgerRows || ledgerRows.length === 0) {
      for (const it of items) if (it.unlocked) totalXp += it.xp;
    }
    const lvl = xpToLevel(totalXp);
    return {
      items,
      stats: {
        totalXp,
        level: lvl.level,
        prevLevelXp: lvl.prev,
        nextLevelXp: lvl.next,
        unlockedCount: items.filter((i) => i.unlocked).length,
        totalCount: items.length,
        longestStreak: counts.combinedStreak,
        totalWorkouts: counts.totalWorkouts,
        totalMeals: counts.totalMeals,
        totalMindsetReps: counts.totalMindsetReps,
      },
    };
  });

export type Unlocked = { key: string; title: string; description: string; rarity: Rarity; xp: number; icon: string | null };

export const evaluateAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ unlocked: Unlocked[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const [catRes, ownedRes] = await Promise.all([
      supabase.from("achievements").select("*"),
      supabase.from("user_achievements").select("achievement_key").eq("user_id", userId),
    ]);
    const catalog: Achievement[] = (catRes.data ?? []) as Achievement[];
    const ownedKeys = new Set<string>(((ownedRes.data ?? []) as Array<{ achievement_key: string }>).map((r) => r.achievement_key));
    const counts = await loadCounts(supabase, userId);
    const userTier = await getUserTier(supabase, userId);
    const isPro = userTier !== "free";

    // Hidden / time-based triggers: night_owl, early_bird, comeback
    const now = new Date();
    const hour = now.getHours();
    const extra: Record<string, boolean> = {
      night_owl: false,
      early_bird: false,
      comeback: false,
    };
    // night_owl: meal logged today after 22:00
    const { data: lateMeals } = await supabase
      .from("food_log").select("logged_at").eq("user_id", userId).gte("logged_at", `${todayStr()}T00:00:00`).limit(50);
    if ((lateMeals ?? []).some((m: any) => new Date(m.logged_at).getHours() >= 22)) extra.night_owl = true;
    // early_bird: checkin created_at before 06:00 today
    const { data: todayCheckin } = await supabase
      .from("daily_checkins").select("created_at").eq("user_id", userId).eq("date", todayStr()).maybeSingle();
    if (todayCheckin && new Date(todayCheckin.created_at).getHours() < 6) extra.early_bird = true;
    // comeback: gap of 3+ days before today's checkin
    const { data: recentCheckins } = await supabase
      .from("daily_checkins").select("date").eq("user_id", userId).order("date", { ascending: false }).limit(5);
    if (recentCheckins && recentCheckins.length >= 2) {
      const [a, b] = recentCheckins as Array<{ date: string }>;
      if (a.date === todayStr()) {
        const gap = Math.floor((new Date(a.date).getTime() - new Date(b.date).getTime()) / 86_400_000);
        if (gap >= 3) extra.comeback = true;
      }
    }
    void hour;

    const newlyUnlocked: Unlocked[] = [];
    for (const a of catalog) {
      if (ownedKeys.has(a.key)) continue;
      const minTier = (a.min_tier ?? "pro") as "free" | "pro";
      if (minTier === "pro" && !isPro) continue;
      let pass = false;
      if (a.criteria.type in extra) {
        pass = !!extra[a.criteria.type];
      } else {
        const current = currentForCriteria(a.criteria, counts);
        const target = a.criteria.threshold ?? 1;
        pass = current >= target;
      }
      if (pass) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("user_achievements").insert({
          user_id: userId,
          achievement_key: a.key,
          progress: { at: new Date().toISOString() } as any,
        });
        // Unique (user_id, achievement_key) makes this idempotent; only the first
        // insert succeeds, so only the first one writes the XP ledger row.
        if (!error) {
          await supabaseAdmin.from("xp_ledger").insert({
            user_id: userId,
            action_type: "achievement_unlock",
            delta: a.xp,
            day_local: todayStr(),
            source_key: `achievement:${a.key}`,
            metadata: { rarity: a.rarity, title: a.title } as any,
          });
          newlyUnlocked.push({ key: a.key, title: a.title, description: a.description, rarity: a.rarity as Rarity, xp: a.xp, icon: a.icon });
        }
      }
    }

    return { unlocked: newlyUnlocked };
  });
