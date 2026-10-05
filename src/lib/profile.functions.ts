import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { regeneratePlanForUser, isoDate } from "./profile.server";

export type ProfileData = {
  first_name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  goals: string[];
  training_days_per_week: number | null;
  session_minutes: number | null;
  equipment_access: string | null;
  workout_style_preference: string | null;
  preferred_training_days: string[];
  dietary_pattern: string | null;
  allergies: string[];
  foods_avoided: string | null;
  foods_liked: string | null;
  sleep_hours: number | null;
  stress_level: number | null;
  caffeine_per_day: number | null;
  alcohol_per_week: number | null;
  injuries: string | null;
  medications: string | null;
  email: string;
};

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileData> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_profile")
      .select("first_name, age, height_cm, weight_kg, goal_weight_kg, goals, training_days_per_week, session_minutes, equipment_access, workout_style_preference, preferred_training_days, dietary_pattern, allergies, foods_avoided, foods_liked, sleep_hours, stress_level, caffeine_per_day, alcohol_per_week, injuries, medications, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Could not load profile.");
    if (!data) throw new Error("Profile not found.");
    return {
      first_name: data.first_name,
      age: data.age,
      height_cm: data.height_cm != null ? Number(data.height_cm) : null,
      weight_kg: data.weight_kg != null ? Number(data.weight_kg) : null,
      goal_weight_kg: data.goal_weight_kg != null ? Number(data.goal_weight_kg) : null,
      goals: (data.goals as string[] | null) ?? [],
      training_days_per_week: data.training_days_per_week,
      session_minutes: data.session_minutes,
      equipment_access: data.equipment_access,
      workout_style_preference: (data as { workout_style_preference?: string | null }).workout_style_preference ?? null,
      preferred_training_days: (data.preferred_training_days as string[] | null) ?? [],
      dietary_pattern: data.dietary_pattern,
      allergies: (data.allergies as string[] | null) ?? [],
      foods_avoided: data.foods_avoided,
      foods_liked: data.foods_liked,
      sleep_hours: data.sleep_hours != null ? Number(data.sleep_hours) : null,
      stress_level: data.stress_level,
      caffeine_per_day: data.caffeine_per_day,
      alcohol_per_week: data.alcohol_per_week,
      injuries: data.injuries,
      medications: data.medications,
      email: data.email,
    };
  });

const ProfileUpdate = z.object({
  first_name: z.string().min(1).max(60).optional(),
  age: z.number().int().min(13).max(100).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  weight_kg: z.number().min(30).max(400).optional(),
  goal_weight_kg: z.number().min(30).max(400).nullable().optional(),
  goals: z.array(z.string().min(1).max(40)).max(10).optional(),
  training_days_per_week: z.number().int().min(1).max(7).optional(),
  session_minutes: z.number().int().min(10).max(180).optional(),
  equipment_access: z.enum(["none", "minimal", "home_gym", "full_gym"]).optional(),
  workout_style_preference: z.enum(["short_intense", "long_steady", "varied", "fun_first"]).nullable().optional(),
  preferred_training_days: z.array(z.string().min(1).max(10)).max(7).optional(),
  dietary_pattern: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "other"]).optional(),
  allergies: z.array(z.string().min(1).max(40)).max(30).optional(),
  foods_avoided: z.string().max(1000).nullable().optional(),
  foods_liked: z.string().max(1000).nullable().optional(),
  sleep_hours: z.number().min(0).max(16).optional(),
  stress_level: z.number().int().min(1).max(10).optional(),
  caffeine_per_day: z.number().int().min(0).max(20).optional(),
  alcohol_per_week: z.number().int().min(0).max(100).optional(),
  injuries: z.string().max(1000).nullable().optional(),
  medications: z.string().max(1000).nullable().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileUpdate.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ ...data, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Could not save.");

    // If weight changed, also push into weight_log for the chart
    if (data.weight_kg != null) {
      await supabase.from("weight_log").insert({ user_id: userId, weight_kg: data.weight_kg });
    }
    return { ok: true as const };
  });

// Phase helpers and regeneratePlanForUser moved to profile.server.ts to avoid
// tss-serverfn-split ReferenceErrors (sibling decls disappear from split chunks).

export const regeneratePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { phase_number } = await regeneratePlanForUser(context.supabase, context.userId);
      return { ok: true as const, phase_number };
    } catch (e) {
      console.error("regeneratePlan failed", e);
      return { ok: false as const, error: (e as Error)?.message ?? "Could not regenerate plan." };
    }
  });

/**
 * Silently called from the app loader. If the user's current phase has expired
 * (today > phase_end_date), auto-generate the next 12-week phase. No-op when
 * the phase is still active or the user has no plan yet.
 */
export const ensureCurrentPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabase, userId } = context;
      const { data: current } = await supabase
        .from("user_plans")
        .select("phase_end_date")
        .eq("user_id", userId)
        .in("plan_type", ["fitness", "workout"])
        .eq("active", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const endStr = (current as any)?.phase_end_date as string | null | undefined;
      if (!endStr) return { renewed: false as const };
      const today = isoDate(new Date());
      if (today <= endStr) return { renewed: false as const };
      const { phase_number } = await regeneratePlanForUser(supabase, userId);
      return { renewed: true as const, phase_number };
    } catch (e) {
      // Silent auto-renew — never 500 the caller. Log and skip; the user
      // can manually regenerate from the plan screen if needed.
      console.error("ensureCurrentPhase failed", e);
      return { renewed: false as const, error: (e as Error)?.message ?? "unknown" };
    }
  });

