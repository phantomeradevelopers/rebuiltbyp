import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function planTag(day: number, slot: string): string {
  return `plan:day-${day}:slot-${slot}`;
}

export const listMealCompletions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const date = todayUTC();
    const { data, error } = await supabase
      .from("meal_completions")
      .select("day, slot, date, completed_at")
      .eq("user_id", userId)
      .eq("date", date);
    if (error) throw new Error(error.message);
    return { completions: (data ?? []) as Array<{ day: number; slot: string; date: string; completed_at: string }> };
  });

export const toggleMealCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      day: z.number().int().min(1).max(31),
      slot: z.enum(SLOTS),
      completed: z.boolean(),
      name: z.string().min(1).max(160).optional(),
      calories: z.number().int().min(0).max(5000).optional(),
      protein_g: z.number().int().min(0).max(500).optional(),
      carbs_g: z.number().int().min(0).max(1000).optional(),
      fat_g: z.number().int().min(0).max(500).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const date = todayUTC();
    const tag = planTag(data.day, data.slot);

    if (data.completed) {
      const { error } = await supabase
        .from("meal_completions")
        .upsert(
          { user_id: userId, day: data.day, slot: data.slot, date },
          { onConflict: "user_id,day,slot,date" },
        );
      if (error) throw new Error(error.message);

      // Mirror into food_log so daily totals roll up. Use tag in notes
      // so we can identify + remove on undo. Guard against duplicates.
      if (data.name && data.calories != null) {
        await supabase
          .from("food_log")
          .delete()
          .eq("user_id", userId)
          .eq("date", date)
          .eq("notes", tag);
        const { error: logErr } = await supabase.from("food_log").insert({
          user_id: userId,
          date,
          meal: data.slot,
          name: data.name,
          calories: Math.round(data.calories),
          protein_g: Math.round(data.protein_g ?? 0),
          carbs_g: Math.round(data.carbs_g ?? 0),
          fat_g: Math.round(data.fat_g ?? 0),
          notes: tag,
        });
        if (logErr) throw new Error(logErr.message);
      }
    } else {
      const { error } = await supabase
        .from("meal_completions")
        .delete()
        .eq("user_id", userId)
        .eq("day", data.day)
        .eq("slot", data.slot)
        .eq("date", date);
      if (error) throw new Error(error.message);

      await supabase
        .from("food_log")
        .delete()
        .eq("user_id", userId)
        .eq("date", date)
        .eq("notes", tag);
    }
    return { ok: true };
  });
