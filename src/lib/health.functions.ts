import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SampleSchema = z.object({
  source: z.enum(["healthkit", "health_connect", "manual", "mock"]),
  metric: z.enum(["sleep_hours", "resting_hr", "hrv_ms", "steps", "workout_minutes"]),
  value: z.number().finite().min(0).max(100000),
  unit: z.string().max(16).optional(),
  recorded_at: z.string().datetime(),
});

export const saveHealthSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ samples: z.array(SampleSchema).min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.samples.map((s) => ({ ...s, user_id: userId }));
    const { error } = await supabase.from("health_samples").insert(rows);
    if (error) throw new Error("Could not save health data.");
    return { saved: rows.length };
  });

export const getRecentHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("health_samples")
      .select("source, metric, value, unit, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500);
    return (data ?? []) as Array<{ source: string; metric: string; value: number; unit: string | null; recorded_at: string }>;
  });
