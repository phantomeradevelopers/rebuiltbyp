import { generatePlan } from "./plan-generator.server";

/** Day count for a 12-week phase (84 days). */
export const PHASE_DAYS = 84;

export function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

/**
 * Core regen logic — shared by the user-triggered `regeneratePlan` server fn
 * and the silent `ensureCurrentPhase` auto-renew. Always bumps phase_number.
 */
export async function regeneratePlanForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ phase_number: number }> {
  const { data: p, error } = await supabase
    .from("user_profile")
    .select("first_name, age, height_cm, weight_kg, goal_weight_kg, goals, training_days_per_week, session_minutes, equipment_access, preferred_training_days, dietary_pattern, allergies, foods_avoided, foods_liked, sleep_hours, stress_level, injuries, taste_profile, restaurants, grocery_stores, cooking_willingness, cooking_minutes_per_day, sweet_tooth, organic_preference, location")
    .eq("user_id", userId).maybeSingle();
  if (error || !p) throw new Error("Profile not found.");

  const plan = await generatePlan({
    first_name: p.first_name,
    age: p.age,
    height_cm: p.height_cm != null ? Number(p.height_cm) : null,
    weight_kg: p.weight_kg != null ? Number(p.weight_kg) : null,
    goal_weight_kg: p.goal_weight_kg != null ? Number(p.goal_weight_kg) : null,
    goals: (p.goals as string[] | null) ?? [],
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
  });

  const { data: prior } = await supabase
    .from("user_plans")
    .select("phase_number")
    .eq("user_id", userId)
    .in("plan_type", ["fitness", "workout"])
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPhase = ((prior?.phase_number as number | undefined) ?? 0) + 1;
  const today = new Date();
  const startStr = isoDate(today);
  const endStr = isoDate(addDays(today, PHASE_DAYS));

  const { data: insertedPlans, error: insErr } = await supabase.from("user_plans").insert([
    { user_id: userId, plan_type: "fitness", plan_data: plan.fitness, active: true, phase_number: nextPhase, phase_start_date: startStr, phase_end_date: endStr },
    { user_id: userId, plan_type: "nutrition", plan_data: plan.nutrition, active: true, phase_number: nextPhase, phase_start_date: startStr, phase_end_date: endStr },
  ]).select("id");
  if (insErr) {
    console.error("user_plans insert failed", insErr);
    throw new Error(`Could not save the new plan: ${insErr.message}`);
  }

  const newPlanIds = ((insertedPlans ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (newPlanIds.length > 0) {
    const { error: oldPlanErr } = await supabase
      .from("user_plans")
      .update({ active: false })
      .eq("user_id", userId)
      .not("id", "in", `(${newPlanIds.join(",")})`);
    if (oldPlanErr) console.warn("old plan deactivation failed", oldPlanErr);
  }
  return { phase_number: nextPhase };
}
