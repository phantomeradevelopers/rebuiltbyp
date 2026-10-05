import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retention summary — the honest snapshot of the "Reps" economy.
 *
 * Reps come from the existing xp_ledger table (idempotent by source_key).
 * Freeze tokens come from streak_savers.balance (earned only, never bought).
 * next_milestone reads the current check-in streak against the 7/30/90 ladder.
 *
 * No fake numbers, no purchasable currency, no dark patterns.
 */
export type RetentionSummary = {
  reps: {
    balance: number;
    today: number;
    week: number;
  };
  freeze_tokens: {
    checkin: number;
    workout: number;
    meal: number;
  };
  current_checkin_streak: number;
  next_milestone: { day: number; kind: "week" | "month" | "quarter" } | null;
};

const MILESTONES: { day: number; kind: "week" | "month" | "quarter" }[] = [
  { day: 7, kind: "week" },
  { day: 30, kind: "month" },
  { day: 90, kind: "quarter" },
];

export const getRetentionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetentionSummary> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    const weekAgo = new Date(today.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);

    const [ledgerRes, saversRes, streakRes] = await Promise.all([
      supabase
        .from("xp_ledger")
        .select("delta, day_local, created_at")
        .eq("user_id", userId),
      supabase
        .from("streak_savers")
        .select("kind, balance")
        .eq("user_id", userId),
      supabase
        .from("user_streaks")
        .select("current_count")
        .eq("user_id", userId)
        .eq("kind", "checkin")
        .maybeSingle(),
    ]);

    const rows = (ledgerRes.data ?? []) as { delta: number; day_local: string | null; created_at: string }[];
    const balance = rows.reduce((s, r) => s + (r.delta ?? 0), 0);
    const todayReps = rows
      .filter((r) => (r.day_local ?? r.created_at.slice(0, 10)) === iso)
      .reduce((s, r) => s + (r.delta ?? 0), 0);
    const weekReps = rows
      .filter((r) => {
        const d = r.day_local ?? r.created_at.slice(0, 10);
        return d >= weekAgo && d <= iso;
      })
      .reduce((s, r) => s + (r.delta ?? 0), 0);

    const saverMap = new Map<string, number>(
      ((saversRes.data ?? []) as { kind: string; balance: number }[]).map((r) => [r.kind, r.balance ?? 0])
    );

    const current = Number((streakRes.data as { current_count?: number } | null)?.current_count ?? 0);
    const nextMilestone = MILESTONES.find((m) => m.day > current) ?? null;

    return {
      reps: { balance, today: todayReps, week: weekReps },
      freeze_tokens: {
        checkin: saverMap.get("checkin") ?? 0,
        workout: saverMap.get("workout") ?? 0,
        meal: saverMap.get("meal") ?? 0,
      },
      current_checkin_streak: current,
      next_milestone: nextMilestone,
    };
  });
