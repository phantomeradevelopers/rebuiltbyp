import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdaptiveAdjustment = {
  applied: boolean;
  reason: string;
  trend_kg_per_week: number | null;
  goal_direction: "cut" | "bulk" | "recomp" | "maintain";
  old_calories: number | null;
  new_calories: number | null;
  delta_kcal: number;
  avg_compliance_pct: number | null;
  avg_energy: number | null;
  generated_at: string;
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function linRegSlope(points: { x: number; y: number }[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return (n * sxy - sx * sy) / denom; // kg per day
}

export const runAdaptiveAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdaptiveAdjustment> => {
    const { supabase, userId } = context;

    const [profileRes, weightRes, checkinsRes, foodRes, planRes] = await Promise.all([
      supabase.from("user_profile").select("weight_kg, goal_weight_kg").eq("user_id", userId).maybeSingle(),
      supabase.from("weight_log").select("weight_kg, logged_at")
        .eq("user_id", userId).gte("logged_at", daysAgo(21)).order("logged_at", { ascending: true }),
      supabase.from("daily_checkins").select("date, energy, workout_completed")
        .eq("user_id", userId).gte("date", daysAgo(7).slice(0, 10)),
      supabase.from("food_log").select("date, calories")
        .eq("user_id", userId).gte("date", daysAgo(7).slice(0, 10)),
      supabase.from("user_plans").select("id, plan_data")
        .eq("user_id", userId).eq("plan_type", "nutrition").eq("active", true)
        .order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const weights = (weightRes.data ?? []).map((r) => ({
      x: new Date(r.logged_at as string).getTime() / 86400000,
      y: Number(r.weight_kg),
    }));
    const slopePerDay = linRegSlope(weights);
    const trendPerWeek = slopePerDay !== null ? Math.round(slopePerDay * 7 * 100) / 100 : null;

    const currentKg = weights.length ? weights[weights.length - 1].y : (profile?.weight_kg ? Number(profile.weight_kg) : null);
    const goalKg = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;

    let direction: AdaptiveAdjustment["goal_direction"] = "maintain";
    if (currentKg !== null && goalKg !== null) {
      const diff = goalKg - currentKg;
      if (diff <= -1.5) direction = "cut";
      else if (diff >= 1.5) direction = "bulk";
      else direction = "recomp";
    }

    const checkins = checkinsRes.data ?? [];
    const food = foodRes.data ?? [];
    const energyVals = checkins.map((c) => c.energy ?? 0).filter((v) => v > 0);
    const avgEnergy = energyVals.length ? Math.round((energyVals.reduce((s, v) => s + v, 0) / energyVals.length) * 10) / 10 : null;
    const workoutsDone = checkins.filter((c) => c.workout_completed).length;
    const expectedWorkouts = Math.min(7, checkins.length || 7);
    const workoutCompliance = expectedWorkouts ? Math.round((workoutsDone / expectedWorkouts) * 100) : null;

    const plan = planRes.data?.plan_data as { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } | undefined;
    const oldCals = plan?.calories ?? null;

    // Average kcal logged on days with any logs
    const byDay = new Map<string, number>();
    for (const f of food) byDay.set(f.date as string, (byDay.get(f.date as string) ?? 0) + (f.calories ?? 0));
    const loggedDays = Array.from(byDay.values()).filter((v) => v > 0);
    const avgLogged = loggedDays.length ? loggedDays.reduce((s, v) => s + v, 0) / loggedDays.length : null;
    const logCompliance = oldCals && avgLogged ? Math.round((Math.min(avgLogged, oldCals * 1.5) / oldCals) * 100) : null;
    const avgCompliance = logCompliance !== null && workoutCompliance !== null
      ? Math.round((logCompliance + workoutCompliance) / 2)
      : (logCompliance ?? workoutCompliance);

    let delta = 0;
    let reason = "";
    let applied = false;

    if (!oldCals) {
      reason = "No active nutrition plan to adjust yet. Generate one from your Plan tab.";
    } else if (trendPerWeek === null) {
      reason = "Log your weight at least 3 times across 2+ weeks so I can read the trend.";
    } else {
      // Target weekly change by goal
      const target = direction === "cut" ? -0.5 : direction === "bulk" ? 0.25 : 0;
      const drift = trendPerWeek - target; // positive = gaining faster than target

      if (direction === "cut" && drift > 0.2) {
        delta = -150; reason = `Weight trending ${trendPerWeek > 0 ? "up" : "flat"} (${trendPerWeek}kg/wk) but you're cutting — dropping intake 150 kcal.`;
      } else if (direction === "cut" && drift < -0.4) {
        delta = +100; reason = `Cutting too fast (${trendPerWeek}kg/wk). Adding 100 kcal to protect energy and muscle.`;
      } else if (direction === "bulk" && drift < -0.1) {
        delta = +200; reason = `Not gaining as planned (${trendPerWeek}kg/wk). Adding 200 kcal.`;
      } else if (direction === "bulk" && drift > 0.4) {
        delta = -100; reason = `Gaining faster than planned (${trendPerWeek}kg/wk) — trimming 100 kcal to limit fat gain.`;
      } else if (direction === "recomp" && Math.abs(trendPerWeek) > 0.4) {
        delta = trendPerWeek > 0 ? -100 : +100;
        reason = `Recomp drift (${trendPerWeek}kg/wk). Nudging ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} kcal.`;
      } else {
        reason = `On track. Trend ${trendPerWeek}kg/wk matches your ${direction} target — holding intake at ${oldCals} kcal.`;
      }

      // Safety: if energy crashed, don't cut further
      if (delta < 0 && avgEnergy !== null && avgEnergy < 2.5) {
        delta = 0;
        reason = `Energy is low (avg ${avgEnergy}/5). Holding calories steady — recover before cutting again.`;
      }

      if (delta !== 0 && planRes.data?.id) {
        const newCals = Math.max(1200, oldCals + delta);
        const ratio = newCals / oldCals;
        const newPlan = {
          ...(plan ?? {}),
          calories: newCals,
          protein_g: Math.round((plan?.protein_g ?? 0)), // keep protein
          carbs_g: Math.round((plan?.carbs_g ?? 0) * ratio),
          fat_g: Math.round((plan?.fat_g ?? 0) * ratio),
        };
        await supabase.from("user_plans").update({ plan_data: newPlan }).eq("id", planRes.data.id);
        applied = true;
      }
    }

    const result: AdaptiveAdjustment = {
      applied,
      reason,
      trend_kg_per_week: trendPerWeek,
      goal_direction: direction,
      old_calories: oldCals,
      new_calories: applied && oldCals ? Math.max(1200, oldCals + delta) : oldCals,
      delta_kcal: delta,
      avg_compliance_pct: avgCompliance,
      avg_energy: avgEnergy,
      generated_at: new Date().toISOString(),
    };

    await supabase.from("plan_refinements").insert({
      user_id: userId,
      plan_type: "nutrition",
      phase_number: 1,
      changes: [result],
      ai_response: result,
    });

    return result;
  });

export const getLatestAdjustment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ adjustment: AdaptiveAdjustment | null }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("plan_refinements")
      .select("ai_response, created_at")
      .eq("user_id", userId)
      .eq("plan_type", "nutrition")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data?.ai_response as AdaptiveAdjustment | null | undefined;
    return { adjustment: r ?? null };
  });
