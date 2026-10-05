import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeMealHistory, missedSlots7d, type EatingPattern, type FoodLogRow, type MealSlot } from "./meal-reminders.server";

export type MealReminderProfile = {
  eating_pattern: EatingPattern;
  typical_times: Partial<Record<MealSlot, string | null>>;
  missed_slots_7d: Partial<Record<MealSlot, number>>;
  reminders_enabled: boolean;
  quiet_hours: { start: string; end: string };
  last_analyzed_at: string | null;
};

async function refreshProfile(supabase: any, userId: string) {
  const fourteenAgo = new Date();
  fourteenAgo.setUTCDate(fourteenAgo.getUTCDate() - 14);
  const { data } = await supabase
    .from("food_log")
    .select("date, meal, logged_at")
    .eq("user_id", userId)
    .gte("date", fourteenAgo.toISOString().slice(0, 10));
  const rows = (data ?? []) as FoodLogRow[];
  const analysis = analyzeMealHistory(rows);
  const missed = missedSlots7d(rows);
  await supabase.from("meal_reminder_profile").upsert(
    {
      user_id: userId,
      eating_pattern: analysis.pattern,
      typical_times: analysis.typical,
      missed_slots_7d: missed,
      last_analyzed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return { ...analysis, missed };
}

export const getMealReminderProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MealReminderProfile> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: existing } = await supabase
      .from("meal_reminder_profile")
      .select("eating_pattern, typical_times, missed_slots_7d, reminders_enabled, quiet_hours, last_analyzed_at")
      .eq("user_id", userId)
      .maybeSingle();
    // If never analyzed, or stale (>24h), refresh
    const stale = !existing?.last_analyzed_at
      || (Date.now() - new Date(existing.last_analyzed_at).getTime()) > 24 * 60 * 60 * 1000;
    if (stale) {
      await refreshProfile(supabase, userId);
    }
    const { data: row } = await supabase
      .from("meal_reminder_profile")
      .select("eating_pattern, typical_times, missed_slots_7d, reminders_enabled, quiet_hours, last_analyzed_at")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      eating_pattern: (row?.eating_pattern as EatingPattern) ?? "unknown",
      typical_times: (row?.typical_times as Record<MealSlot, string | null>) ?? {},
      missed_slots_7d: (row?.missed_slots_7d as Record<MealSlot, number>) ?? {},
      reminders_enabled: row?.reminders_enabled ?? true,
      quiet_hours: (row?.quiet_hours as { start: string; end: string }) ?? { start: "22:00", end: "06:00" },
      last_analyzed_at: row?.last_analyzed_at ?? null,
    };
  });

export const setMealRemindersEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await supabase.from("meal_reminder_profile").upsert(
      { user_id: userId, reminders_enabled: data.enabled },
      { onConflict: "user_id" },
    );
    await supabase.from("user_profile").update({ meal_reminders_enabled: data.enabled }).eq("user_id", userId);
    return { ok: true as const };
  });

export const refreshMealPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await refreshProfile(supabase, userId);
    return { ok: true as const };
  });
