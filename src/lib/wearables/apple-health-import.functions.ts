import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APPLE_PROVIDER = "apple_health";

const daySchema = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(200000).nullable().optional(),
  sleep_minutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  resting_heart_rate: z.number().int().min(20).max(220).nullable().optional(),
  hrv_ms: z.number().min(0).max(500).nullable().optional(),
});

const bulkSchema = z.object({
  days: z.array(daySchema).min(1).max(400),
});

export type AppleHealthDay = z.infer<typeof daySchema>;

/**
 * Bulk import of aggregated Apple Health export data (from export.xml).
 * Stored under provider="apple_health" so it never clobbers the user's
 * hand-entered "manual" daily metrics.
 */
export const importAppleHealthDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const rows = data.days.map((d) => ({
      user_id: userId,
      provider: APPLE_PROVIDER,
      metric_date: d.metric_date,
      steps: d.steps ?? null,
      sleep_minutes: d.sleep_minutes ?? null,
      resting_heart_rate: d.resting_heart_rate ?? null,
      hrv_ms: d.hrv_ms ?? null,
      raw: { imported_from: "apple_health_export_xml" } as never,
    }));

    // Chunked upserts to keep payloads small.
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin
        .from("wearable_daily_metrics")
        .upsert(slice, { onConflict: "user_id,provider,metric_date" });
      if (error) throw new Error(error.message);
    }

    return { ok: true, imported: rows.length };
  });
