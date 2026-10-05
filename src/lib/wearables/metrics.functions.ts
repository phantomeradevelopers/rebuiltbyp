import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MANUAL_PROVIDER = "manual";

const upsertSchema = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(200000).nullable().optional(),
  sleep_minutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  resting_heart_rate: z.number().int().min(20).max(220).nullable().optional(),
  hrv_ms: z.number().min(0).max(500).nullable().optional(),
  weight_kg: z.number().min(20).max(400).nullable().optional(),
});

export type DailyMetricsInput = z.infer<typeof upsertSchema>;

export type DailyMetricsRow = {
  metric_date: string;
  steps: number | null;
  sleep_minutes: number | null;
  resting_heart_rate: number | null;
  hrv_ms: number | null;
  weight_kg: number | null;
};

export const upsertDailyMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Build raw blob to store fields not in dedicated columns (weight_kg).
    const existing = await supabaseAdmin
      .from("wearable_daily_metrics")
      .select("raw")
      .eq("user_id", userId)
      .eq("provider", MANUAL_PROVIDER)
      .eq("metric_date", data.metric_date)
      .maybeSingle();

    const prevRaw = (existing.data?.raw ?? {}) as Record<string, unknown>;
    const nextRaw: Record<string, unknown> = { ...prevRaw };
    if (data.weight_kg !== undefined) nextRaw.weight_kg = data.weight_kg;

    const row = {
      user_id: userId,
      provider: MANUAL_PROVIDER,
      metric_date: data.metric_date,
      steps: data.steps ?? null,
      sleep_minutes: data.sleep_minutes ?? null,
      resting_heart_rate: data.resting_heart_rate ?? null,
      hrv_ms: data.hrv_ms ?? null,
      raw: nextRaw as never,
    };

    const { error } = await supabaseAdmin
      .from("wearable_daily_metrics")
      .upsert(row, { onConflict: "user_id,provider,metric_date" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTodayMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyMetricsRow | null> => {
    const { userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("wearable_daily_metrics")
      .select("metric_date, steps, sleep_minutes, resting_heart_rate, hrv_ms, raw")
      .eq("user_id", userId)
      .eq("provider", MANUAL_PROVIDER)
      .eq("metric_date", today)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const raw = (data.raw ?? {}) as Record<string, unknown>;
    return {
      metric_date: data.metric_date,
      steps: data.steps,
      sleep_minutes: data.sleep_minutes,
      resting_heart_rate: data.resting_heart_rate,
      hrv_ms: data.hrv_ms,
      weight_kg: typeof raw.weight_kg === "number" ? raw.weight_kg : null,
    };
  });
