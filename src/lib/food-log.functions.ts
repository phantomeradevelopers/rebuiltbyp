// Food log server functions — the daily intake ledger.
// Sums power the Fuel header daily total.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Source = z.enum(["meal_done", "photo_estimate", "fast_food"]);
const Slot = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const LogMealRefInput = z.object({
  mealId: z.string().uuid(),
  source: z.enum(["meal_done", "fast_food"]),
});

/** Insert a food_log row by referencing a library `meals.id`. */
export const logLibraryMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LogMealRefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meal, error: mErr } = await supabase
      .from("meals")
      .select("id, slot, title, kcal, protein_g, carbs_g, fat_g")
      .eq("id", data.mealId)
      .eq("active", true)
      .maybeSingle();
    if (mErr || !meal) throw new Error("Meal not found.");

    const { error } = await supabase.from("food_log").insert({
      user_id: userId,
      meal: meal.slot,
      name: meal.title,
      calories: meal.kcal,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      source: data.source,
      meal_id: meal.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const LogPhotoInput = z.object({
  slot: Slot,
  name: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().int().min(0).max(500),
  carbs_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(500),
  photo_path: z.string().nullable().optional(),
  note: z.string().max(240).optional(),
});

export const logPhotoEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LogPhotoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const notes = data.note ? `ai_estimate: ${data.note}` : "ai_estimate";
    const { error } = await supabase.from("food_log").insert({
      user_id: userId,
      meal: data.slot,
      name: data.name,
      calories: data.calories,
      protein_g: data.protein_g,
      carbs_g: data.carbs_g,
      fat_g: data.fat_g,
      photo_path: data.photo_path ?? null,
      notes,
      source: "photo_estimate",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type DayTotals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; entries: number };

export const getDayTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ date: z.string().optional() }).parse(i))
  .handler(async ({ data, context }): Promise<DayTotals> => {
    const { supabase, userId } = context;
    const today = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from("food_log")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("date", today);
    if (error) throw new Error(error.message);
    const t: DayTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entries: 0 };
    for (const r of rows ?? []) {
      t.kcal += r.calories ?? 0;
      t.protein_g += r.protein_g ?? 0;
      t.carbs_g += r.carbs_g ?? 0;
      t.fat_g += r.fat_g ?? 0;
      t.entries += 1;
    }
    return t;
  });

/** Lightweight list of today's logged entries for the header summary list. */
export const listTodayFoodLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("food_log")
      .select("id, meal, name, calories, protein_g, source, logged_at")
      .eq("user_id", userId)
      .eq("date", today)
      .order("logged_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Keep Source for external typing.
export type FoodLogSource = z.infer<typeof Source>;
