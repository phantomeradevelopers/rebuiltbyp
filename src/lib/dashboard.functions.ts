import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DayExercise = { name: string; sets: number; reps: string; notes: string };
export type DayPlan = { day: number; title: string; type: string; exercises: DayExercise[] };
export type WeekPlan = { week: number; focus: string; days: DayPlan[] };
export type PhaseBlock = { number: 1 | 2 | 3; name: "Ramp" | "Push" | "Consolidate"; week_range: [number, number]; focus: string };
export type FitnessPlan = { overview: string; weeks: WeekPlan[]; blocks?: PhaseBlock[] };
export type MacroSet = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
export type MealIngredient = { item: string; qty: string; unit: string };
export type PlannedMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  time_hint: string;
  name: string;
  ingredients: MealIngredient[];
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  prep_minutes: number;
  swap_note: string;
};
export type MealDay = {
  day: number;
  day_label: string;
  day_type: "training" | "rest";
  total_calories: number;
  total_protein_g: number;
  meals: PlannedMeal[];
};
export type GroceryGroup = { aisle: string; items: MealIngredient[] };
export type NutritionPlan = {
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  principles: string[];
  sample_day: { meal: string; name: string; calories: number; protein_g: number }[];
  // New optional fields — present on freshly-generated plans.
  client_summary?: string;
  training_day?: MacroSet;
  rest_day?: MacroSet;
  hydration_ml?: number;
  meal_plan?: MealDay[];
  grocery_list?: GroceryGroup[];
};

export type LastCheckin = {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleep_hours: number;
  workout_completed: boolean;
};
export type TodaySnapshot = {
  firstName: string | null;
  startDate: string | null;
  dayNumber: number;
  weekNumber: number;
  dayOfWeek: number;
  streak: number;
  checkinDoneToday: boolean;
  affirmation: string | null;
  todayWorkout: DayPlan | null;
  nutrition: NutritionPlan | null;
  lastCheckin: LastCheckin | null;
  affirmations: string[];
};

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveDate(input?: { date?: string }): string {
  return input?.date ?? new Date().toISOString().slice(0, 10);
}

function computeDayNumber(startDate: string | null, targetDate: string): { day: number; week: number; dow: number } {
  if (!startDate) return { day: 1, week: 1, dow: 1 };
  const start = new Date(startDate + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  const diff = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
  const day = Math.max(1, diff + 1);
  const week = Math.max(1, Math.ceil(day / 7));
  const dow = ((day - 1) % 7) + 1;
  return { day, week, dow };
}

export const getToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<TodaySnapshot> => {
    const { supabase, userId } = context;
    const today = resolveDate(data);

    const [profileRes, fitnessRes, nutritionRes, checkinsRes, affRes] = await Promise.all([
      supabase.from("user_profile")
        .select("first_name, rebuilt_start_date")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("user_plans")
        .select("plan_data, generated_at, phase_start_date")
        .eq("user_id", userId).in("plan_type", ["fitness", "workout"]).eq("active", true)
        .order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_plans")
        .select("plan_data")
        .eq("user_id", userId).eq("plan_type", "nutrition").eq("active", true)
        .order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("daily_checkins")
        .select("date, mood, energy, stress, sleep_hours, workout_completed")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(60),
      supabase.from("daily_affirmations").select("id, content"),
    ]);

    const startDate = profileRes.data?.rebuilt_start_date ?? null;
    const { day, week, dow } = computeDayNumber(startDate, today);

    const fitness = (fitnessRes.data?.plan_data as FitnessPlan | undefined) ?? null;
    const nutrition = (nutritionRes.data?.plan_data as NutritionPlan | undefined) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phaseStart = ((fitnessRes.data as any)?.phase_start_date as string | null) ?? null;
    const phaseWeek = computePhaseWeek(phaseStart, today);
    const weekPlan = fitness?.weeks.find((w) => w.week === phaseWeek) ?? fitness?.weeks[0];
    const todayWorkout = weekPlan?.days.find((d) => d.day === dow) ?? null;

    // Streak: consecutive days ending today (or yesterday if today not done).
    // Use a UTC cursor seeded from the request's `today` so it lines up with
    // the UTC date keys stored in daily_checkins.
    const dates = new Set((checkinsRes.data ?? []).map((r) => r.date as string));
    const checkinDoneToday = dates.has(today);
    let streak = 0;
    const cursor = new Date(today + "T00:00:00Z");
    if (!checkinDoneToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (true) {
      const k = cursor.toISOString().slice(0, 10);
      if (dates.has(k)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); } else break;
    }

    // Deterministic affirmation per (user, day)
    const list = affRes.data ?? [];
    let affirmation: string | null = null;
    if (list.length > 0) {
      const seed = `${userId}-${today}`;
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      affirmation = (list[h % list.length] as { content: string }).content;
    }

    // Prefer today's row so we accurately reflect whether today's training/checkin is done.
    // Fall back to the most recent prior row for recommendations seeding only.
    const rows = (checkinsRes.data ?? []) as Array<{ date: string; mood: number; energy: number; stress: number; sleep_hours: number; workout_completed: boolean }>;
    const latest = rows.find((r) => r.date === today) ?? rows.find((r) => r.date < today) ?? undefined;
    const lastCheckin: LastCheckin | null = latest
      ? {
          date: latest.date,
          mood: latest.mood,
          energy: latest.energy,
          stress: latest.stress,
          sleep_hours: Number(latest.sleep_hours ?? 0),
          workout_completed: !!latest.workout_completed,
        }
      : null;

    return {
      firstName: profileRes.data?.first_name ?? null,
      startDate,
      dayNumber: day,
      weekNumber: week,
      dayOfWeek: dow,
      streak,
      checkinDoneToday,
      affirmation,
      todayWorkout,
      nutrition,
      lastCheckin,
      affirmations: list.map((a) => (a as { content: string }).content),
    };
  });

const CheckinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  sleep_hours: z.number().min(0).max(16),
  stress: z.number().int().min(1).max(10),
  workout_completed: z.boolean(),
  notes: z.string().max(1000).optional().nullable(),
});

export const submitCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = resolveDate(data);
    // Upsert (one per day)
    const { error: delErr } = await supabase
      .from("daily_checkins").delete().eq("user_id", userId).eq("date", today);
    if (delErr) console.warn("checkin clear", delErr);
    const { error } = await supabase.from("daily_checkins").insert({
      user_id: userId,
      date: today,
      mood: data.mood,
      energy: data.energy,
      sleep_hours: data.sleep_hours,
      stress: data.stress,
      workout_completed: data.workout_completed,
      notes: data.notes ?? null,
    });
    if (error) throw new Error("Could not save your check-in.");
    return { ok: true as const };
  });

export type PhaseMeta = {
  phase_number: number;
  phase_start_date: string | null;
  phase_end_date: string | null;
  phase_week: number; // 1..12 (clamped)
};

function computePhaseWeek(phase_start_date: string | null, targetDate = new Date().toISOString().slice(0, 10)): number {
  if (!phase_start_date) return 1;
  const start = new Date(phase_start_date + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  const days = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
  const wk = Math.floor(days / 7) + 1;
  return Math.max(1, Math.min(12, wk));
}

export const getPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    fitness: FitnessPlan | null;
    nutrition: NutritionPlan | null;
    weekNumber: number;
    phase: PhaseMeta;
  }> => {
    const { supabase, userId } = context;
    const [{ data: fitness }, { data: nutrition }] = await Promise.all([
      supabase.from("user_plans").select("plan_data, phase_number, phase_start_date, phase_end_date").eq("user_id", userId).in("plan_type", ["fitness", "workout"]).eq("active", true).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_plans").select("plan_data").eq("user_id", userId).eq("plan_type", "nutrition").eq("active", true).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fitness as any;
    const phase_start_date = (f?.phase_start_date as string | null) ?? null;
    const phase_end_date = (f?.phase_end_date as string | null) ?? null;
    const phase_number = (f?.phase_number as number | null) ?? 1;
    const phase_week = computePhaseWeek(phase_start_date);
    return {
      fitness: (f?.plan_data as FitnessPlan | undefined) ?? null,
      nutrition: (nutrition?.plan_data as NutritionPlan | undefined) ?? null,
      weekNumber: phase_week,
      phase: { phase_number, phase_start_date, phase_end_date, phase_week },
    };
  });
