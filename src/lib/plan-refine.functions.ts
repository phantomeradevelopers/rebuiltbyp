import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refineNutritionPlan, refineFitnessPlan } from "./plan-refine.server";
import type { FitnessPlan, NutritionPlan } from "./dashboard.functions";

const MealActionSchema = z.object({
  day: z.number().int().min(1).max(7),
  slot: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  action: z.enum(["remove", "replace"]),
  reason: z.string().max(200).optional(),
});

const ExerciseActionSchema = z.object({
  week: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(7),
  exerciseIndex: z.number().int().min(0).max(20),
  action: z.enum(["remove", "replace"]),
  reason: z.string().max(200).optional(),
});

async function loadProfile(supabase: ReturnType<typeof Object>, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("user_profile")
    .select("first_name, dietary_pattern, allergies, foods_avoided, foods_liked, equipment_access, injuries, taste_profile, restaurants, grocery_stores, cooking_willingness, cooking_minutes_per_day, sweet_tooth, organic_preference, location")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    first_name: data?.first_name ?? null,
    dietary_pattern: data?.dietary_pattern ?? null,
    allergies: (data?.allergies as string[] | null) ?? [],
    foods_avoided: data?.foods_avoided ?? null,
    foods_liked: data?.foods_liked ?? null,
    equipment_access: data?.equipment_access ?? null,
    injuries: data?.injuries ?? null,
    taste_profile: (data?.taste_profile as Record<string, unknown> | null) ?? null,
    restaurants: (data?.restaurants as string[] | null) ?? [],
    grocery_stores: (data?.grocery_stores as string[] | null) ?? [],
    cooking_willingness: data?.cooking_willingness ?? null,
    cooking_minutes_per_day: data?.cooking_minutes_per_day ?? null,
    sweet_tooth: data?.sweet_tooth ?? null,
    organic_preference: data?.organic_preference ?? null,
    location: (data?.location as Record<string, unknown> | null) ?? null,
  };
}

export const refineMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ actions: z.array(MealActionSchema).min(1).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const { data: row, error } = await supabase
        .from("user_plans")
        .select("id, plan_data, phase_number")
        .eq("user_id", userId)
        .eq("plan_type", "nutrition")
        .eq("active", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !row) throw new Error("No active nutrition plan.");

      const profile = await loadProfile(supabase, userId);
      const original = row.plan_data as NutritionPlan;
      const { plan: updated, ai } = await refineNutritionPlan(original, profile, data.actions);

      const { error: upErr } = await supabase
        .from("user_plans")
        .update({ plan_data: updated as never })
        .eq("id", row.id);
      if (upErr) throw new Error("Could not save updated meal plan.");

      await supabase.from("plan_refinements").insert({
        user_id: userId,
        plan_type: "nutrition",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase_number: (row as any).phase_number ?? 1,
        changes: data.actions as never,
        ai_response: (ai ?? null) as never,
      });

      return { ok: true as const, plan: updated };
    } catch (e) {
      console.error("refineMealPlan failed", e);
      return { ok: false as const, error: (e as Error)?.message ?? "Could not update meal plan." };
    }
  });

export const refineWorkoutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      actions: z.array(ExerciseActionSchema).min(1).max(20),
      applyToAllWeeks: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const { data: row, error } = await supabase
        .from("user_plans")
        .select("id, plan_data, phase_number")
        .eq("user_id", userId)
        .in("plan_type", ["fitness", "workout"])
        .eq("active", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !row) throw new Error("No active fitness plan.");

      const profile = await loadProfile(supabase, userId);
      const original = row.plan_data as FitnessPlan;
      const { plan: updated, ai, warnings } = await refineFitnessPlan(original, profile, data.actions, data.applyToAllWeeks);

      const { error: upErr } = await supabase
        .from("user_plans")
        .update({ plan_data: updated as never })
        .eq("id", row.id);
      if (upErr) throw new Error("Could not save updated workout plan.");

      await supabase.from("plan_refinements").insert({
        user_id: userId,
        plan_type: "fitness",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase_number: (row as any).phase_number ?? 1,
        week_number: data.actions[0]?.week ?? null,
        changes: data.actions as never,
        ai_response: (ai ?? null) as never,
      });

      return { ok: true as const, plan: updated, warnings };
    } catch (e) {
      console.error("refineWorkoutPlan failed", e);
      return { ok: false as const, error: (e as Error)?.message ?? "Could not update workout plan." };
    }
  });
