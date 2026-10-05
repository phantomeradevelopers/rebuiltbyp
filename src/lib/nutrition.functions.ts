import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Meal = {
  id: string;
  meal: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
  logged_at: string;
  photo_path: string | null;
  photo_url: string | null;
};

export type NutritionTargets = { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;

export type TodayNutrition = {
  date: string;
  targets: NutritionTargets;
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  meals: Meal[];
  sample_day: { meal: string; name: string; calories: number; protein_g: number }[];
};

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveDate(input?: { date?: string }): string {
  return input?.date ?? new Date().toISOString().slice(0, 10);
}

export const getTodayNutrition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<TodayNutrition> => {
    const { supabase, userId } = context;
    const date = resolveDate(data);

    const [{ data: meals }, { data: planRow }] = await Promise.all([
      supabase.from("food_log")
        .select("id, meal, name, calories, protein_g, carbs_g, fat_g, notes, logged_at, photo_path")
        .eq("user_id", userId).eq("date", date)
        .order("logged_at", { ascending: true }),
      supabase.from("user_plans")
        .select("plan_data")
        .eq("user_id", userId).eq("plan_type", "nutrition").eq("active", true)
        .order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const rawList = (meals ?? []) as Array<Omit<Meal, "photo_url">>;
    const paths = rawList.map((m) => m.photo_path).filter((p): p is string => !!p);
    const urlMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("meal-photos").createSignedUrls(paths, 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
      }
    }
    const list: Meal[] = rawList.map((m) => ({ ...m, photo_url: m.photo_path ? urlMap.get(m.photo_path) ?? null : null }));

    const totals = list.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein_g: a.protein_g + m.protein_g,
        carbs_g: a.carbs_g + m.carbs_g,
        fat_g: a.fat_g + m.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );

    const plan = planRow?.plan_data as
      | { calories: number; protein_g: number; carbs_g: number; fat_g: number; sample_day?: { meal: string; name: string; calories: number; protein_g: number }[] }
      | undefined;

    return {
      date,
      targets: plan ? { calories: plan.calories, protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g } : null,
      totals,
      meals: list,
      sample_day: plan?.sample_day ?? [],
    };
  });

const MealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().int().min(0).max(500),
  carbs_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(500),
  notes: z.string().max(500).nullable().optional(),
  photo_path: z.string().max(300).nullable().optional(),
});

export const logMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MealSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("food_log").insert({
      user_id: userId,
      date: resolveDate(data),
      meal: data.meal,
      name: data.name,
      calories: data.calories,
      protein_g: data.protein_g,
      carbs_g: data.carbs_g,
      fat_g: data.fat_g,
      notes: data.notes ?? null,
      photo_path: data.photo_path ?? null,
    });
    if (error) throw new Error("Could not save meal.");
    return { ok: true as const };
  });

export const deleteMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("food_log").delete()
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error("Could not delete.");
    return { ok: true as const };
  });
