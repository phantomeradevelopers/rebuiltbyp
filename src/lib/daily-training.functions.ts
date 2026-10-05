import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DailyTrainingMode = {
  date: string;
  modality: string;
  category: string;
  equipment: string[];
  notes: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveDate(input?: { date?: string }) {
  return input?.date ?? todayISO();
}

export const getTodayMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data: input, context }): Promise<DailyTrainingMode | null> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("daily_training_mode")
      .select("date, modality, category, equipment, notes")
      .eq("user_id", userId)
      .eq("date", resolveDate(input))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      date: row.date,
      modality: row.modality,
      category: row.category,
      equipment: (row.equipment as string[]) ?? [],
      notes: row.notes,
    };
  });

const setTodayModeInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  modality: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  category: z.string().min(1).max(32).regex(/^[a-z_]+$/),
  equipment: z.array(z.string().min(1).max(32).regex(/^[a-z0-9_]+$/)).max(16).default([]),
  notes: z.string().max(500).optional().nullable(),
});

export const setTodayMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setTodayModeInput.parse(input))
  .handler(async ({ data, context }): Promise<DailyTrainingMode> => {
    const { supabase, userId } = context;
    const date = resolveDate(data);
    const { data: row, error } = await supabase
      .from("daily_training_mode")
      .upsert(
        {
          user_id: userId,
          date,
          modality: data.modality,
          category: data.category,
          equipment: data.equipment,
          notes: data.notes ?? null,
        },
        { onConflict: "user_id,date" },
      )
      .select("date, modality, category, equipment, notes")
      .single();
    if (error) throw new Error(error.message);
    return {
      date: row.date,
      modality: row.modality,
      category: row.category,
      equipment: (row.equipment as string[]) ?? [],
      notes: row.notes,
    };
  });

export const clearTodayMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("daily_training_mode")
      .delete()
      .eq("user_id", userId)
      .eq("date", resolveDate(data));
    if (error) throw new Error(error.message);
    return { ok: true };
  });
