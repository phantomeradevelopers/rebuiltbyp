import type { FitnessPlan, NutritionPlan, PlannedMeal, DayExercise, MealIngredient, GroceryGroup } from "./dashboard.functions";

export type MealAction = { day: number; slot: string; name: string; action: "remove" | "replace"; reason?: string };
export type ExerciseAction = { week: number; day: number; exerciseIndex: number; action: "remove" | "replace"; reason?: string };

type ProfileCtx = {
  first_name: string | null;
  dietary_pattern: string | null;
  allergies: string[];
  foods_avoided: string | null;
  foods_liked: string | null;
  equipment_access: string | null;
  injuries: string | null;
  taste_profile?: Record<string, unknown> | null;
  restaurants?: string[];
  grocery_stores?: string[];
  cooking_willingness?: number | null;
  cooking_minutes_per_day?: number | null;
  sweet_tooth?: number | null;
  organic_preference?: string | null;
  location?: Record<string, unknown> | null;
  training_experience?: string | null;
  training_years?: number | null;
  preferred_activities?: string[];
  activity_notes?: string | null;
  workout_style_preference?: string | null;
};

async function callAiJson<T>(system: string, payload: unknown, maxTokens = 2000): Promise<T | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("refine AI gateway error", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return null;
    try { return JSON.parse(content) as T; }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      return m ? (JSON.parse(m[0]) as T) : null;
    }
  } catch (e) {
    console.error("refine AI call failed", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- NUTRITION ----------

type MealReplacement = {
  slot: string;
  name: string;
  ingredients: MealIngredient[];
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  prep_minutes: number;
  time_hint: string;
  swap_note: string;
};

export async function refineNutritionPlan(
  plan: NutritionPlan,
  profile: ProfileCtx,
  actions: MealAction[],
): Promise<{ plan: NutritionPlan; ai: unknown }> {
  if (!plan.meal_plan || actions.length === 0) return { plan, ai: null };

  // Resolve targets: each replace needs an AI suggestion sized to the removed meal
  const replaceTargets = actions
    .filter((a) => a.action === "replace")
    .map((a) => {
      const day = plan.meal_plan!.find((d) => d.day === a.day);
      const meal = day?.meals.find((m) => m.slot === a.slot && m.name === a.name);
      return meal ? { action: a, original: meal } : null;
    })
    .filter((x): x is { action: MealAction; original: PlannedMeal } => x !== null);

  let replacements: MealReplacement[] = [];
  let aiRaw: unknown = null;
  if (replaceTargets.length > 0) {
    const system = `You are P, a nutrition coach. Replace meals while keeping macros within ±10%, same slot, similar prep time, and respecting allergies, dietary pattern, disliked foods, and the client's taste_profile / restaurants / grocery_stores / cooking_willingness / sweet_tooth / organic_preference. Never include taste_profile.hard_nos. If cooking_willingness is low, lean on a restaurant go-to or no-cook option. Return JSON: { "replacements": [{ "slot", "name", "ingredients":[{"item","qty","unit"}], "calories","protein_g","carbs_g","fat_g","prep_minutes","time_hint","swap_note" }] } with one entry per request in order.`;
    const userPayload = {
      profile: {
        dietary_pattern: profile.dietary_pattern,
        allergies: profile.allergies,
        foods_avoided: profile.foods_avoided,
        foods_liked: profile.foods_liked,
        taste_profile: profile.taste_profile ?? null,
        restaurants: profile.restaurants ?? [],
        grocery_stores: profile.grocery_stores ?? [],
        cooking_willingness: profile.cooking_willingness ?? null,
        cooking_minutes_per_day: profile.cooking_minutes_per_day ?? null,
        sweet_tooth: profile.sweet_tooth ?? null,
        organic_preference: profile.organic_preference ?? null,
        location: profile.location ?? null,
      },
      requests: replaceTargets.map((t) => ({
        slot: t.original.slot,
        replace_meal: t.original.name,
        target_macros: {
          calories: t.original.calories,
          protein_g: t.original.protein_g,
          carbs_g: t.original.carbs_g,
          fat_g: t.original.fat_g,
        },
        prep_minutes_max: Math.max(15, t.original.prep_minutes + 10),
        reason: t.action.reason ?? null,
      })),
    };
    const out = await callAiJson<{ replacements: MealReplacement[] }>(system, userPayload, 2200);
    aiRaw = out;
    replacements = out?.replacements ?? [];
  }

  // Apply changes
  const removeKeys = new Set(
    actions.filter((a) => a.action === "remove").map((a) => `${a.day}|${a.slot}|${a.name}`),
  );
  const replaceMap = new Map<string, MealReplacement>();
  replaceTargets.forEach((t, i) => {
    const r = replacements[i];
    if (r) replaceMap.set(`${t.action.day}|${t.action.slot}|${t.action.name}`, r);
  });

  const newMealPlan = plan.meal_plan.map((d) => {
    const meals = d.meals
      .filter((m) => !removeKeys.has(`${d.day}|${m.slot}|${m.name}`))
      .map((m) => {
        const k = `${d.day}|${m.slot}|${m.name}`;
        const r = replaceMap.get(k);
        if (!r) return m;
        const safeSlot = (["breakfast", "lunch", "dinner", "snack"] as const).includes(r.slot as never) ? r.slot as PlannedMeal["slot"] : m.slot;
        return {
          slot: safeSlot,
          time_hint: r.time_hint || m.time_hint,
          name: r.name,
          ingredients: r.ingredients ?? [],
          calories: r.calories | 0,
          protein_g: r.protein_g | 0,
          carbs_g: r.carbs_g | 0,
          fat_g: r.fat_g | 0,
          prep_minutes: r.prep_minutes | 0,
          swap_note: r.swap_note || "",
        } as PlannedMeal;
      });
    const total_calories = meals.reduce((s, m) => s + m.calories, 0);
    const total_protein_g = meals.reduce((s, m) => s + m.protein_g, 0);
    return { ...d, meals, total_calories, total_protein_g };
  });

  // Rebuild grocery list naively from all meal ingredients, grouped under "Refreshed"
  const items: MealIngredient[] = [];
  for (const d of newMealPlan) for (const m of d.meals) for (const ing of m.ingredients) items.push(ing);
  const grocery_list: GroceryGroup[] = plan.grocery_list
    ? [{ aisle: "Refreshed list", items }]
    : [];

  return {
    plan: { ...plan, meal_plan: newMealPlan, ...(grocery_list.length ? { grocery_list } : {}) },
    ai: aiRaw,
  };
}

// ---------- FITNESS ----------

const MUSCLE_LOOKUP: Array<[RegExp, string]> = [
  [/squat|leg press|lunge|step.?up|bulgarian/i, "quads/glutes"],
  [/deadlift|rdl|hip thrust|glute|hamstring|leg curl/i, "posterior chain"],
  [/bench|push.?up|chest|fly|dip/i, "chest/triceps"],
  [/row|pull.?up|chin.?up|lat|pulldown/i, "back/biceps"],
  [/press|shoulder|lateral raise|overhead/i, "shoulders"],
  [/curl/i, "biceps"],
  [/tricep|skull/i, "triceps"],
  [/plank|crunch|ab|core|hollow/i, "core"],
  [/run|row erg|bike|carry|sled|burpee|jump/i, "conditioning"],
];

function muscleGroupFor(name: string): string {
  for (const [re, g] of MUSCLE_LOOKUP) if (re.test(name)) return g;
  return "full body";
}

type ExerciseReplacement = { name: string; sets: number; reps: string; notes: string };

export async function refineFitnessPlan(
  plan: FitnessPlan,
  profile: ProfileCtx,
  actions: ExerciseAction[],
  applyToAllWeeks: boolean,
): Promise<{ plan: FitnessPlan; ai: unknown; warnings: string[] }> {
  const warnings: string[] = [];
  if (actions.length === 0) return { plan, ai: null, warnings };

  const replaceTargets = actions
    .filter((a) => a.action === "replace")
    .map((a) => {
      const week = plan.weeks.find((w) => w.week === a.week);
      const day = week?.days.find((d) => d.day === a.day);
      const ex = day?.exercises[a.exerciseIndex];
      return ex ? { action: a, original: ex, muscle: muscleGroupFor(ex.name) } : null;
    })
    .filter((x): x is { action: ExerciseAction; original: DayExercise; muscle: string } => x !== null);

  let replacements: ExerciseReplacement[] = [];
  let aiRaw: unknown = null;
  if (replaceTargets.length > 0) {
    const system = `You are P, a strength coach. Replace exercises with alternatives that hit the SAME primary muscle group, fit the client's equipment, and respect injuries. Scale to training_experience (no advanced barbell lifts for beginners; no bodyweight-only for advanced). Honor workout_style_preference and weave preferred_activities (e.g. surf, hike, pickleball) in when the slot is conditioning. Read activity_notes for scheduling hints. Match sets and rep scheme. Return JSON: { "replacements": [{ "name", "sets", "reps", "notes" }] } with one entry per request in order.`;
    const userPayload = {
      profile: {
        equipment_access: profile.equipment_access,
        injuries: profile.injuries,
        training_experience: profile.training_experience ?? null,
        training_years: profile.training_years ?? null,
        preferred_activities: profile.preferred_activities ?? [],
        activity_notes: profile.activity_notes ?? null,
        workout_style_preference: profile.workout_style_preference ?? null,
      },
      requests: replaceTargets.map((t) => ({
        replace_exercise: t.original.name,
        primary_muscle_group: t.muscle,
        sets: t.original.sets,
        reps: t.original.reps,
        reason: t.action.reason ?? null,
      })),
    };
    const out = await callAiJson<{ replacements: ExerciseReplacement[] }>(system, userPayload, 1400);
    aiRaw = out;
    replacements = out?.replacements ?? [];
  }

  // Build keyed lookup
  type Key = string;
  const removeKeys = new Set<Key>();
  const replaceMap = new Map<Key, ExerciseReplacement>();
  for (const a of actions) {
    const original = plan.weeks.find((w) => w.week === a.week)?.days.find((d) => d.day === a.day)?.exercises[a.exerciseIndex];
    if (!original) continue;
    // Match by exercise NAME so we can optionally apply across weeks
    const nameKey = original.name.toLowerCase();
    if (a.action === "remove") removeKeys.add(nameKey);
  }
  replaceTargets.forEach((t, i) => {
    const r = replacements[i];
    if (r) replaceMap.set(t.original.name.toLowerCase(), r);
  });

  const targetWeeks = applyToAllWeeks ? plan.weeks.map((w) => w.week) : Array.from(new Set(actions.map((a) => a.week)));

  const newWeeks = plan.weeks.map((w) => {
    if (!targetWeeks.includes(w.week)) return w;
    const days = w.days.map((d) => {
      const exercises = d.exercises
        .filter((ex) => !removeKeys.has(ex.name.toLowerCase()))
        .map((ex) => {
          const r = replaceMap.get(ex.name.toLowerCase());
          if (!r) return ex;
          return {
            name: r.name,
            sets: r.sets || ex.sets,
            reps: r.reps || ex.reps,
            notes: r.notes || ex.notes,
          };
        });
      if (d.type !== "rest" && exercises.length > 0 && exercises.length < 3) {
        warnings.push(`Week ${w.week} · Day ${d.day} now has only ${exercises.length} movement${exercises.length === 1 ? "" : "s"}.`);
      }
      return { ...d, exercises };
    });
    return { ...w, days };
  });

  return { plan: { ...plan, weeks: newWeeks }, ai: aiRaw, warnings };
}
