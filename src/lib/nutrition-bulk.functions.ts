import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string().min(1).max(120),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().int().min(0).max(500),
  carbs_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(500),
  notes: z.string().max(500).nullable().optional(),
  logged_at: z.string().datetime().optional(),
  photo_path: z.string().max(300).nullable().optional(),
});

const BulkSchema = z.object({
  meals: z.array(RowSchema).min(1).max(8),
});

export const logMealsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const nowIso = new Date().toISOString();
    const rows = data.meals.map((m) => {
      const loggedAt = m.logged_at ?? nowIso;
      const date = m.date ?? loggedAt.slice(0, 10);
      return {
        user_id: userId,
        date,
        meal: m.meal,
        name: m.name,
        calories: m.calories,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        notes: m.notes ?? null,
        logged_at: loggedAt,
        photo_path: m.photo_path ?? null,
      };
    });
    const { error } = await supabase.from("food_log").insert(rows);
    if (error) throw new Error("Could not save meals.");
    return { ok: true as const, count: rows.length };
  });
