import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Week1Recap = {
  eligible: boolean;
  daysSinceStart: number;
  checkins: number;
  workouts: number;
  meals: number;
  currentCheckinStreak: number;
  bestCheckinStreak: number;
  tier: string;
  firstName: string | null;
  track: "men" | "angels";
};

/**
 * Returns the user's REAL Week-1 numbers. Eligible only after day 7 and
 * only for free users (no upsell nag for paying members).
 * All numbers are counted from `rebuilt_start_date` (or account creation).
 */
export const getFirstWeekRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Week1Recap> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: profile } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("rebuilt_start_date, first_name, tier, track, created_at" as any)
      .eq("user_id", userId)
      .maybeSingle();

    const p = (profile ?? {}) as Record<string, unknown>;
    const tier = (p.tier as string | undefined) ?? "free";
    const track: "men" | "angels" =
      (p.track as string | null | undefined) === "angels" ? "angels" : "men";

    const startStr =
      (p.rebuilt_start_date as string | null | undefined) ||
      (p.created_at as string | null | undefined) ||
      null;

    let daysSinceStart = 0;
    let startIso: string | null = null;
    if (startStr) {
      const start = new Date(String(startStr).length <= 10 ? String(startStr) + "T00:00:00Z" : String(startStr));
      startIso = start.toISOString();
      daysSinceStart = Math.max(
        0,
        Math.floor((Date.now() - start.getTime()) / 86_400_000),
      );
    }

    // Window is start → start + 7 days (or now, whichever is smaller)
    const windowEndMs = startIso
      ? Math.min(
          Date.now(),
          new Date(startIso).getTime() + 7 * 86_400_000,
        )
      : Date.now();
    const windowEndIso = new Date(windowEndMs).toISOString();

    const [{ count: checkins }, { count: workouts }, { count: meals }] = await Promise.all([
      supabase
        .from("daily_checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startIso ?? new Date(0).toISOString())
        .lte("created_at", windowEndIso),
      supabase
        .from("streak_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "workout")
        .gte("created_at", startIso ?? new Date(0).toISOString())
        .lte("created_at", windowEndIso),
      supabase
        .from("food_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startIso ?? new Date(0).toISOString())
        .lte("created_at", windowEndIso),
    ]);

    const { data: streakRow } = await supabase
      .from("user_streaks")
      .select("current_count, longest_count")
      .eq("user_id", userId)
      .eq("kind", "checkin")
      .maybeSingle();

    return {
      eligible: daysSinceStart >= 7 && tier === "free",
      daysSinceStart,
      checkins: checkins ?? 0,
      workouts: workouts ?? 0,
      meals: meals ?? 0,
      currentCheckinStreak: (streakRow?.current_count as number | undefined) ?? 0,
      bestCheckinStreak: (streakRow?.longest_count as number | undefined) ?? 0,
      tier,
      firstName: (p.first_name as string | null | undefined) ?? null,
      track,
    };
  });
