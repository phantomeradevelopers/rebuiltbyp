import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeReadinessScore } from "./readiness.server";

const Input = z.object({
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleep_hours: z.number().min(0).max(16).nullable().optional(),
  sleep_quality: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  soreness: z.number().int().min(1).max(5).nullable().optional(),
  resting_hr: z.number().int().min(20).max(220).nullable().optional(),
  hrv_ms: z.number().min(0).max(500).nullable().optional(),
});

export const saveReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const score = computeReadinessScore(data);
    const row = { ...data, user_id: userId, score, source: "manual" as const, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase
      .from("readiness_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("day_date", data.day_date)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("readiness_checkins").update(row).eq("id", existing.id);
      if (error) {
        console.error("readiness update failed", error);
        throw new Error("Couldn't save readiness. Try again.");
      }
    } else {
      const { error } = await supabase.from("readiness_checkins").insert(row);
      if (error) {
        console.error("readiness insert failed", error);
        throw new Error("Couldn't save readiness. Try again.");
      }
    }
    return { score };
  });

export const getReadinessHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("readiness_checkins")
      .select("day_date, score, sleep_hours, energy, mood, soreness")
      .eq("user_id", userId)
      .order("day_date", { ascending: false })
      .limit(30);
    return { history: data ?? [] };
  });
