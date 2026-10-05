import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePlan } from "./plan-generator.server";

/**
 * Screener conditions — any "yes" answer here means we DO NOT generate a plan
 * and route the user to a clinician. This is a hard safety gate.
 */
export const SCREENER_FLAGS = [
  "chest_pain",
  "heart_condition",
  "fainting",
  "pregnancy_complication",
  "uncontrolled_bp",
  "recent_surgery",
  "doctor_restricted_exercise",
  "eating_disorder_active",
] as const;

export const PHYSIQUE_FOCUS_OPTIONS = [
  "six_pack",
  "bigger_arms",
  "bigger_glutes",
  "bigger_chest",
  "wider_shoulders",
  "stronger_back",
  "bigger_legs",
  "slimmer_waist",
  "lose_belly_fat",
  "tone_all_over",
] as const;

export const SuccessMetricSchema = z.object({
  type: z.enum(["target_weight", "measurement", "photo", "lift_pr", "coach_decide"]),
  target_value: z.number().nullable().optional(),
  target_unit: z.string().max(12).nullable().optional(),
  body_part: z.string().max(40).nullable().optional(),
  lift_name: z.string().max(40).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
}).nullable().optional();

const ProfileSchema = z.object({
  first_name: z.string().min(1).max(60),
  gender: z.enum(["male", "female"]),
  age: z.number().int().min(13).max(100),
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(40).max(200),
  goal_weight_kg: z.number().min(40).max(200).optional().nullable(),
  goals: z.array(z.string().min(1).max(40)).max(6).default([]),
  physique_focus: z.array(z.string().min(1).max(40)).max(5).default([]),
  success_metric: SuccessMetricSchema,
  training_days_per_week: z.number().int().min(1).max(7),
  session_minutes: z.number().int().min(10).max(180),
  equipment_access: z.enum(["none", "minimal", "home_gym", "full_gym"]).default("minimal"),
  preferred_training_days: z.array(z.string()).max(7),
  dietary_pattern: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "other"]),
  allergies: z.array(z.string().min(1).max(40)).max(20),
  foods_avoided: z.string().max(500).optional().nullable(),
  foods_liked: z.string().max(500).optional().nullable(),
  taste_profile: z.object({
    cuisines: z.array(z.string().max(40)).max(20).default([]),
    proteins: z.array(z.string().max(40)).max(40).default([]),
    carbs: z.array(z.string().max(40)).max(40).default([]),
    veggies: z.array(z.string().max(40)).max(40).default([]),
    fats: z.array(z.string().max(40)).max(40).default([]),
    sweet_subs: z.array(z.string().max(40)).max(20).default([]),
    flavors: z.array(z.string().max(40)).max(20).default([]),
    hard_nos: z.array(z.string().max(40)).max(40).default([]),
    shake_pref: z.string().max(20).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }).partial().default({}),
  restaurants: z.array(z.string().max(60)).max(20).default([]),
  grocery_stores: z.array(z.string().max(60)).max(10).default([]),
  cooking_willingness: z.number().int().min(1).max(5).optional().nullable(),
  cooking_minutes_per_day: z.number().int().min(0).max(240).optional().nullable(),
  sweet_tooth: z.number().int().min(1).max(5).optional().nullable(),
  organic_preference: z.enum(["always", "when_affordable", "no"]).default("always"),
  location: z.object({
    city: z.string().max(80).optional().nullable(),
    region: z.string().max(80).optional().nullable(),
    country: z.string().max(80).optional().nullable(),
    postal: z.string().max(20).optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    source: z.string().max(20).optional().nullable(),
  }).partial().default({}),
  sleep_hours: z.number().min(0).max(16),
  stress_level: z.number().int().min(1).max(10),
  caffeine_per_day: z.number().int().min(0).max(20).default(0),
  alcohol_per_week: z.number().int().min(0).max(100).default(0),
  injuries: z.string().max(1000).optional().nullable(),
  medications: z.string().max(1000).optional().nullable(),
  screener_conditions: z.array(z.enum(SCREENER_FLAGS)),
  notification_sms: z.boolean(),
  notification_email: z.boolean(),
  notification_push: z.boolean(),
  phone_e164: z.string().regex(/^\+\d{8,15}$/).optional().nullable(),
  reminder_time_local: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/).transform((v) => {
    const [h, m] = v.split(":");
    return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
  }).optional().default("06:00"),

  cardio_preference: z.enum(["outdoor", "treadmill", "mix", "none"]).optional().nullable(),
  treadmill_access: z.enum(["home", "gym", "both"]).optional().nullable(),
  has_dog: z.boolean().optional().default(false),
  dog_count: z.number().int().min(0).max(10).optional().default(0),
  nature_preference: z.enum(["loves_nature", "neutral", "prefers_urban"]).optional().nullable(),
  training_experience: z.enum(["new", "returning", "intermediate", "advanced"]).optional().nullable(),
  training_years: z.number().min(0).max(60).optional().nullable(),
  preferred_activities: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  activity_notes: z.string().max(500).optional().nullable(),
  workout_style_preference: z.enum(["short_intense", "long_steady", "varied", "fun_first"]).optional().nullable(),
  country_code: z.string().regex(/^[A-Z]{2}$/).optional().nullable(),
  legal_consent_accepted: z.literal(true, { errorMap: () => ({ message: "Please accept the medical disclaimer to continue." }) }),
  connected_apps_interest: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  faith_mode_enabled: z.boolean().optional().default(false),
  mood_today: z.number().int().min(1).max(10).optional().nullable(),
  top_drain: z.enum(["work", "relationships", "money", "health"]).optional().nullable(),
  peptide_status: z.enum(["on", "considering", "no"]).optional().nullable(),
});



export type OnboardingPayload = z.infer<typeof ProfileSchema>;

function parseOnboardingInput(input: unknown): OnboardingPayload {
  const result = ProfileSchema.safeParse(input);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const path = first?.path?.join(".") || "form";
  const msg = first?.message || "Invalid input";
  throw new Error(`${path}: ${msg}`);
}

/**
 * Save the user's onboarding answers. Returns immediately after the profile
 * write so the user can land in the app right away. Plan generation is
 * triggered separately by the dashboard via `generatePlanIfMissing`.
 */
export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseOnboardingInput(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const screenerPassed = data.screener_conditions.length === 0;

    const { error: upErr } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(({
        first_name: data.first_name,
        gender: data.gender ?? null,
        age: data.age,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        goal_weight_kg: data.goal_weight_kg ?? null,
        goals: data.goals,
        physique_focus: data.physique_focus ?? [],
        success_metric: (data.success_metric ?? null) as never,
        training_days_per_week: data.training_days_per_week,
        session_minutes: data.session_minutes,
        equipment_access: data.equipment_access,
        preferred_training_days: data.preferred_training_days,
        dietary_pattern: data.dietary_pattern,
        allergies: data.allergies,
        foods_avoided: data.foods_avoided ?? null,
        foods_liked: data.foods_liked ?? null,
        taste_profile: (data.taste_profile ?? {}) as never,
        restaurants: (data.restaurants ?? []) as never,
        grocery_stores: (data.grocery_stores ?? []) as never,
        cooking_willingness: data.cooking_willingness ?? null,
        cooking_minutes_per_day: data.cooking_minutes_per_day ?? null,
        sweet_tooth: data.sweet_tooth ?? null,
        organic_preference: data.organic_preference ?? "always",
        location: (data.location ?? {}) as never,
        sleep_hours: data.sleep_hours,
        stress_level: data.stress_level,
        caffeine_per_day: data.caffeine_per_day,
        alcohol_per_week: data.alcohol_per_week,
        injuries: data.injuries ?? null,
        medications: data.medications ?? null,
        screener_conditions: data.screener_conditions,
        screener_passed: screenerPassed,
        notification_sms: data.notification_sms,
        notification_email: data.notification_email,
        notification_push: data.notification_push,
        phone_e164: data.phone_e164 ?? null,
        sms_consent_at: data.notification_sms ? new Date().toISOString() : null,
        reminder_time_local: data.reminder_time_local,
        cardio_preference: data.cardio_preference ?? null,
        treadmill_access: data.treadmill_access ?? null,
        has_dog: data.has_dog ?? false,
        dog_count: data.dog_count ?? 0,
        nature_preference: data.nature_preference ?? null,
        training_experience: data.training_experience ?? null,
        training_years: data.training_years ?? null,
        preferred_activities: (data.preferred_activities ?? []) as never,
        workout_style_preference: data.workout_style_preference ?? null,
        country_code: data.country_code ?? null,
        unit_system: (data.country_code && ["US", "GB", "LR", "MM"].includes(data.country_code)) ? "imperial" : "metric",
        connected_apps_interest: data.connected_apps_interest ?? [],
        faith_mode_enabled: data.faith_mode_enabled ?? false,
        mood_today: data.mood_today ?? null,
        top_drain: data.top_drain ?? null,
        peptide_status: data.peptide_status ?? null,



        legal_consent_at: new Date().toISOString(),
        onboarding_completed_at: new Date().toISOString(),
        rebuilt_start_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }) as never)

      .eq("user_id", userId);

    if (upErr) {
      console.error("profile update", upErr);
      throw new Error(`Could not save your profile: ${upErr.message}`);
    }

    if (!screenerPassed) {
      return { ok: true as const, screenerPassed: false as const };
    }

    // Seed welcome coach message so P greets the user on first open.
    try {
      const goalsList = Array.isArray(data.goals) ? data.goals : [];
      const topGoal = goalsList[0] ? String(goalsList[0]).replace(/_/g, " ") : "your reset";
      const firstName = data.first_name?.trim() || "there";
      const welcome = `Welcome in, ${firstName}. I've built your 30-day plan around ${topGoal}. Your training, nutrition, and daily check-ins are dialed. I'm here whenever you want to talk through a session, log a question, or push past a sticking point. First move: open the Today card and run today's work. Let's go.`;

      const { data: convo, error: convoErr } = await supabase
        .from("ai_coach_conversations")
        .insert({ user_id: userId, title: "Welcome from P" })
        .select("id")
        .single();
      if (!convoErr && convo) {
        await supabase.from("ai_coach_messages").insert({
          conversation_id: convo.id,
          role: "assistant",
          content: welcome,
        });
      } else if (convoErr) {
        console.warn("welcome conversation insert failed", convoErr);
      }
    } catch (e) {
      console.warn("welcome message seed failed", e);
    }

    return { ok: true as const, screenerPassed: true as const };
  });

/**
 * Generate fitness + nutrition plan from the saved profile. Safe to call
 * repeatedly — only inserts new plans if none are currently active.
 * Called from the dashboard after onboarding completes.
 */
export const generatePlanIfMissing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Skip if user already has both active plans.
    const { data: existing } = await supabase
      .from("user_plans")
      .select("plan_type")
      .eq("user_id", userId)
      .eq("active", true);
    const types = new Set((existing ?? []).map((r) => r.plan_type as string));
    if (types.has("fitness") && types.has("nutrition")) {
      return { ok: true as const, generated: false as const };
    }

    const { data: p, error } = await supabase
      .from("user_profile")
      .select("first_name, age, height_cm, weight_kg, goal_weight_kg, goals, physique_focus, success_metric, training_days_per_week, session_minutes, equipment_access, preferred_training_days, dietary_pattern, allergies, foods_avoided, foods_liked, sleep_hours, stress_level, injuries, screener_passed, onboarding_completed_at, taste_profile, restaurants, grocery_stores, cooking_willingness, cooking_minutes_per_day, sweet_tooth, organic_preference, location, cardio_preference, treadmill_access, has_dog, dog_count, nature_preference, work_label, training_experience, training_years, preferred_activities, activity_notes, workout_style_preference")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !p) return { ok: true as const, generated: false as const };
    if (!p.onboarding_completed_at) return { ok: true as const, generated: false as const };

    if (p.screener_passed === false) {
      return { ok: true as const, generated: false as const };
    }

    const plan = await generatePlan({
      first_name: p.first_name,
      age: p.age,
      height_cm: p.height_cm != null ? Number(p.height_cm) : null,
      weight_kg: p.weight_kg != null ? Number(p.weight_kg) : null,
      goal_weight_kg: p.goal_weight_kg != null ? Number(p.goal_weight_kg) : null,
      goals: (p.goals as string[] | null) ?? [],
      physique_focus: (p.physique_focus as string[] | null) ?? [],
      success_metric: (p.success_metric as never) ?? null,
      training_days_per_week: p.training_days_per_week,
      session_minutes: p.session_minutes,
      equipment_access: p.equipment_access,
      preferred_training_days: (p.preferred_training_days as string[] | null) ?? [],
      dietary_pattern: p.dietary_pattern,
      allergies: (p.allergies as string[] | null) ?? [],
      foods_avoided: p.foods_avoided,
      foods_liked: p.foods_liked,
      sleep_hours: p.sleep_hours != null ? Number(p.sleep_hours) : null,
      stress_level: p.stress_level,
      injuries: p.injuries,
      taste_profile: (p.taste_profile as Record<string, unknown> | null) ?? null,
      restaurants: (p.restaurants as string[] | null) ?? [],
      grocery_stores: (p.grocery_stores as string[] | null) ?? [],
      cooking_willingness: p.cooking_willingness,
      cooking_minutes_per_day: p.cooking_minutes_per_day,
      sweet_tooth: p.sweet_tooth,
      organic_preference: p.organic_preference,
      location: (p.location as Record<string, unknown> | null) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cardio_preference: (p as any).cardio_preference ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      treadmill_access: (p as any).treadmill_access ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      has_dog: !!(p as any).has_dog,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dog_count: Number((p as any).dog_count ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nature_preference: (p as any).nature_preference ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      work_label: (p as any).work_label ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      training_experience: (p as any).training_experience ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      training_years: (p as any).training_years != null ? Number((p as any).training_years) : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preferred_activities: ((p as any).preferred_activities as string[] | null) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activity_notes: (p as any).activity_notes ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workout_style_preference: (p as any).workout_style_preference ?? null,
    });

    const today = new Date();
    const startStr = today.toISOString().slice(0, 10);
    const endDate = new Date(today); endDate.setDate(endDate.getDate() + 84);
    const endStr = endDate.toISOString().slice(0, 10);

    const { data: insertedPlans, error: planErr } = await supabase.from("user_plans").insert([
      { user_id: userId, plan_type: "fitness", plan_data: plan.fitness as never, active: true, phase_number: 1, phase_start_date: startStr, phase_end_date: endStr } as never,
      { user_id: userId, plan_type: "nutrition", plan_data: plan.nutrition as never, active: true, phase_number: 1, phase_start_date: startStr, phase_end_date: endStr } as never,
    ]).select("id");
    if (planErr) {
      console.error("plan insert", planErr);
      throw new Error(`Could not save your plan: ${planErr.message}`);
    }

    const newPlanIds = (insertedPlans ?? []).map((row) => row.id);
    if (newPlanIds.length > 0) {
      const { error: oldPlanErr } = await supabase
        .from("user_plans")
        .update({ active: false })
        .eq("user_id", userId)
        .not("id", "in", `(${newPlanIds.join(",")})`);
      if (oldPlanErr) console.warn("old plan deactivation failed", oldPlanErr);
    }

    return { ok: true as const, generated: true as const };
  });

/**
 * Clears `onboarding_completed_at` so the `/app` gate routes the user back
 * through the full intake wizard. Used by the "Redo intake" entry point.
 */
export const resetOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ onboarding_completed_at: null, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Could not reset intake.");
    return { ok: true as const };
  });

