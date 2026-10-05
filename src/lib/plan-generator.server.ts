/**
 * Server-only helper that calls the Lovable AI gateway to generate a
 * fitness + nutrition plan for a user. Shared by onboarding and profile
 * regeneration. Never import this from the browser.
 */

export type PlanInput = {
  first_name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  goals: string[];
  physique_focus?: string[];
  success_metric?: {
    type: string;
    target_value?: number | null;
    target_unit?: string | null;
    body_part?: string | null;
    lift_name?: string | null;
    note?: string | null;
  } | null;
  training_days_per_week: number | null;
  session_minutes: number | null;
  equipment_access: string | null;
  preferred_training_days: string[];
  dietary_pattern: string | null;
  allergies: string[];
  foods_avoided: string | null;
  foods_liked: string | null;
  sleep_hours: number | null;
  stress_level: number | null;
  injuries: string | null;
  // Curated taste profile (all optional — older callers still work)
  taste_profile?: Record<string, unknown> | null;
  restaurants?: string[];
  grocery_stores?: string[];
  cooking_willingness?: number | null;
  cooking_minutes_per_day?: number | null;
  sweet_tooth?: number | null;
  organic_preference?: string | null;
  location?: Record<string, unknown> | null;
  // Lifestyle + experience signals — feed AI personalization.
  cardio_preference?: "outdoor" | "treadmill" | "mix" | "none" | null;
  treadmill_access?: "home" | "gym" | "both" | null;
  has_dog?: boolean;
  dog_count?: number;
  nature_preference?: "loves_nature" | "neutral" | "prefers_urban" | null;
  work_label?: string | null;
  training_experience?: "new" | "returning" | "intermediate" | "advanced" | null;
  training_years?: number | null;
  preferred_activities?: string[];
  activity_notes?: string | null;
  workout_style_preference?: "short_intense" | "long_steady" | "varied" | "fun_first" | null;
};

export type PlanResult = { fitness: unknown; nutrition: unknown };

type DayExercise = { name: string; sets: number; reps: string; notes: string };
type DayPlan = { day: number; title: string; type: "strength" | "conditioning" | "mobility" | "rest" | "active_recovery"; exercises: DayExercise[] };
type WeekPlan = { week: number; focus: string; days: DayPlan[] };
type PhaseBlock = { number: 1 | 2 | 3; name: "Ramp" | "Push" | "Consolidate"; week_range: [number, number]; focus: string };
type FitnessPlan = { overview: string; weeks: WeekPlan[]; blocks?: PhaseBlock[] };
type MacroSet = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type MealIngredient = { item: string; qty: string; unit: string };
type PlannedMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  time_hint: string;
  name: string;
  ingredients: MealIngredient[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
  swap_note: string;
};
type MealDay = {
  day: number;
  day_label: string;
  day_type: "training" | "rest";
  total_calories: number;
  total_protein_g: number;
  meals: PlannedMeal[];
};
type GroceryGroup = { aisle: "Produce" | "Protein" | "Pantry" | "Dairy" | "Frozen" | "Other"; items: MealIngredient[] };
type NutritionPlan = MacroSet & {
  training_day: MacroSet;
  rest_day: MacroSet;
  hydration_ml: number;
  client_summary: string;
  principles: string[];
  meal_plan: MealDay[];
  grocery_list: GroceryGroup[];
  sample_day: { meal: string; name: string; calories: number; protein_g: number }[];
  excluded_allergens?: string[];
};

const COACH_VOICE = "You are Playboy P — survivor, builder, coach. Calm, steady certainty. Short sentences. No fluff.";

const FITNESS_SYSTEM = `${COACH_VOICE}

Output ONLY a compact JSON object. No markdown. No whitespace beyond what JSON requires.
Shape: {"overview":"2 sentences","weeks":[{"week":1,"focus":"4 words","days":[{"day":1,"title":"short","type":"strength|conditioning|mobility|rest|active_recovery","exercises":[{"name":"short","sets":3,"reps":"8-12","notes":"<=12 words"}]}]}]}

Rules:
- Exactly 4 weeks, each with exactly 7 days numbered 1-7.
- Match training_days_per_week each week; the rest are rest/mobility/active_recovery (1-3 movements each).
- Strength days: 4-5 movements. Conditioning days: 3-4 movements.
- Notes: max 12 words each. Title: max 6 words. Focus: max 4 words.
- Respect equipment_access and injuries; substitute, never aggravate.
- TRAINING_EXPERIENCE drives exercise selection and intensity:
  * "new": foundational movements only (goblet squat, hinge variations, push-up progressions, supported rows). RPE 5-6. Encouraging notes — never shame, never assume gym literacy.
  * "returning": rebuild base for 2 weeks, then standard compound lifts at RPE 6-7.
  * "intermediate": full compound lifts (back squat, bench, RDL, pull-up). RPE 7-8.
  * "advanced": include accessory variation, tempo work, and progressive overload cues. RPE 8-9 on top sets.
- WORKOUT_STYLE_PREFERENCE shapes session format:
  * "short_intense": 4 movements max, supersets, minimal rest cues.
  * "long_steady": classic splits, straight sets, full warm-up cues.
  * "varied": rotate formats week-to-week (circuit, straight sets, EMOM).
  * "fun_first": include 1 game-like or novelty finisher per session (carries, sled, sprints).
- PREFERRED_ACTIVITIES integration — when present, USE them. If "Surf", "Hike", "Pickleball", "Basketball", "Cycle", "Swim", "Run", "Climb", etc. appear, schedule them as conditioning slots on appropriate days (e.g. "Saturday: Surf — counts as zone-2"). Reference 1-2 of these activities BY NAME in the overview to show the plan is built for them. Dog walks count as low-intensity steady cardio.
- ACTIVITY_NOTES is the user's own words — read it carefully and honor specific scheduling hints ("I surf Saturday mornings" → Saturday is a surf day, not a lift day).
- Prioritize physique_focus: glutes→hip-hinges; six_pack/lose_belly_fat→core+conditioning; arms/chest/back/legs→that group gets priority sets.
- If success_metric is lift_pr, include that lift weekly with light progression.
- TONE: encouraging, never shaming. The user is here because they want to change — meet them there.
- The user input includes a phase_block field with a name (Ramp | Push | Consolidate) and progression rules. Follow those rules precisely:
  * Ramp (block 1): conservative volume, 3 sets, RPE 6-7, dial form, build the base.
  * Push (block 2): add 1 set per main lift OR +5% load, RPE 7-8, conditioning sharper, intensity up.
  * Consolidate (block 3): peak intensity weeks 1-3 (RPE 8-9, top sets), week 4 deload (-30% volume, easy movement).
- Return ONLY valid JSON.`;

const NUTRITION_SYSTEM = `${COACH_VOICE}

Output ONLY a compact JSON object. No markdown. No whitespace beyond what JSON requires.
Shape: {"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"training_day":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},"rest_day":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},"hydration_ml":0,"client_summary":"1-2 sentences","principles":["string"],"meal_plan":[{"day":1,"day_label":"Day 1","day_type":"training|rest","total_calories":0,"total_protein_g":0,"meals":[{"slot":"breakfast|lunch|dinner|snack","time_hint":"morning|midday|afternoon|evening","name":"short","ingredients":[{"item":"short","qty":"1","unit":"g|cup|tbsp|piece"}],"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"prep_minutes":0,"swap_note":"<=10 words"}]}],"grocery_list":[{"aisle":"Produce|Protein|Pantry|Dairy|Frozen|Other","items":[{"item":"short","qty":"1","unit":"g"}]}],"sample_day":[{"meal":"breakfast","name":"short","calories":0,"protein_g":0}]}

Rules:
- ALLERGIES ARE LIFE-THREATENING. If the user lists allergies or foods_avoided, ZERO meals, ingredients, ingredient names, swap_notes, or grocery items may contain that food OR any derived form (e.g. "dairy" excludes milk/cheese/yogurt/butter/cream/whey/ghee; "gluten" excludes wheat/bread/pasta/flour/barley/rye; "shellfish" excludes shrimp/crab/lobster/oyster/mussel/clam/prawn; "nuts" excludes almond/cashew/walnut/pecan/pistachio/hazelnut; "soy" excludes tofu/tempeh/edamame/soy sauce; "egg" excludes eggs/omelet/mayonnaise).
- TASTE PROFILE: if taste_profile, foods_liked, restaurants, or grocery_stores are present, bias EVERY meal toward those proteins, carbs, veggies, fats, and flavor profile. Never plan a food in taste_profile.hard_nos. If cooking_willingness <= 2 or cooking_minutes_per_day <= 10, lean on no-cook / 1-pan / grab-and-go meals and name 1-2 restaurant go-to orders from their restaurants list in swap_note. Pick brands sold at the listed grocery_stores when relevant.
- ORGANIC: if organic_preference is "always", say "organic" on protein and produce items; if "when_affordable", note "organic when possible"; if "no", omit the word.
- SWEET TOOTH: if sweet_tooth >= 4, include one daily snack that satisfies it (Greek-yogurt + berries, dark chocolate square, protein bar) within the macro budget.
- LOCATION: if location.country is non-US, prefer ingredients commonly available in that region.
- Exactly 7 days. 3-4 meals per day. Max 4 ingredients per meal. names <= 6 words.
- Protein >= 1.6 g/kg bodyweight. Training day ~12% above baseline, rest day ~5% below.
- client_summary mentions first name (if given), current weight, goal weight, dietary pattern.
- principles: 4-5 short lines.
- grocery_list aggregates ingredients into aisle buckets.
- Return ONLY valid JSON.`;

function cleanAiJson(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  return first !== -1 && last > first ? cleaned.slice(first, last + 1) : cleaned;
}

function parseAiJson<T>(content: string): T | null {
  const candidates = [
    cleanAiJson(content),
    cleanAiJson(content).replace(/,\s*([}\]])/g, "$1").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""),
  ];
  for (const candidate of candidates) {
    try { return JSON.parse(candidate) as T; } catch { /* try the next cleanup */ }
  }
  return null;
}

async function requestPlanObject<T>(
  label: "fitness" | "nutrition",
  system: string,
  userPayload: unknown,
  maxTokens: number,
): Promise<T | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  // Hard timeout so the whole request can never sit forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    console.error(`${label} AI gateway request failed`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`${label} AI gateway error`, res.status, text.slice(0, 400));
    return null;
  }

  const body = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> } | null;
  const choice = body?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) return null;

  const parsed = parseAiJson<T>(content);
  if (!parsed) {
    console.error(`${label} plan parse failed`, {
      finish_reason: choice?.finish_reason,
      length: content.length,
    });
  }
  return parsed;
}

function isFitnessBlock(value: unknown): value is FitnessPlan {
  const plan = value as FitnessPlan | null;
  return !!plan && typeof plan.overview === "string" && Array.isArray(plan.weeks) && plan.weeks.length === 4;
}

function isNutritionPlan(value: unknown): value is NutritionPlan {
  const plan = value as NutritionPlan | null;
  return !!plan && typeof plan.calories === "number" && Array.isArray(plan.principles) && Array.isArray(plan.meal_plan) && plan.meal_plan.length === 7;
}

const BLOCK_META: ReadonlyArray<{ number: 1 | 2 | 3; name: PhaseBlock["name"]; rule: string; default_focus: string }> = [
  { number: 1, name: "Ramp", rule: "Conservative volume, 3 sets, RPE 6-7. Dial form. Build the base.", default_focus: "Build the base" },
  { number: 2, name: "Push", rule: "Add 1 set per main lift OR +5% load. RPE 7-8. Sharper conditioning.", default_focus: "Raise the standard" },
  { number: 3, name: "Consolidate", rule: "Weeks 1-3 peak intensity, RPE 8-9 top sets. Week 4 is a deload (-30% volume).", default_focus: "Peak then deload" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function preferredTrainingDayIndexes(data: PlanInput) {
  const requested = Math.max(1, Math.min(7, data.training_days_per_week ?? 3));
  const normalized = new Set((data.preferred_training_days ?? []).map((d) => d.toLowerCase().slice(0, 3)));
  const chosen = DAY_NAMES
    .map((d, i) => ({ key: d.toLowerCase().slice(0, 3), i }))
    .filter((d) => normalized.has(d.key))
    .map((d) => d.i);
  const defaults = [0, 2, 4, 5, 1, 3, 6];
  for (const day of defaults) if (chosen.length < requested && !chosen.includes(day)) chosen.push(day);
  return new Set(chosen.slice(0, requested));
}

function fallbackFitnessPlan(data: PlanInput): FitnessPlan {
  const trainingDays = preferredTrainingDayIndexes(data);
  const equipment = data.equipment_access ?? "minimal";
  const hasInjuries = !!data.injuries?.trim();
  const strengthMoves = equipment === "none"
    ? ["Tempo squat to chair", "Incline push-up", "Reverse lunge", "Glute bridge", "Dead bug"]
    : equipment === "full_gym" || equipment === "home_gym"
      ? ["Goblet squat", "Dumbbell bench press", "Romanian deadlift", "Lat pulldown", "Farmer carry"]
      : ["Dumbbell squat", "Band row", "Dumbbell floor press", "Split squat", "Band pull-apart"];
  const conditioningMoves = ["Brisk walk intervals", "Step-ups", "Bike or row easy intervals", "Marching carries"];
  const recoveryMoves = ["Cat-cow", "Hip flexor stretch", "Thoracic rotation", "Box breathing"];

  return {
    overview: `${data.first_name ?? "You"}, this is a steady four-week rebuild: strength first, clean conditioning second, recovery every week. We train the body without forcing pain, and we repeat the basics until they become proof.`,
    weeks: Array.from({ length: 4 }, (_, weekIndex) => ({
      week: weekIndex + 1,
      focus: ["Build the base", "Add clean volume", "Raise the standard", "Own the rhythm"][weekIndex],
      days: DAY_NAMES.map((name, dayIndex) => {
        const isTraining = trainingDays.has(dayIndex);
        const conditioning = isTraining && (dayIndex + weekIndex) % 3 === 2;
        const moves = conditioning ? conditioningMoves : isTraining ? strengthMoves : recoveryMoves;
        return {
          day: dayIndex + 1,
          title: isTraining ? (conditioning ? `${name} conditioning` : `${name} strength`) : `${name} recovery`,
          type: isTraining ? (conditioning ? "conditioning" : "strength") : dayIndex % 2 ? "active_recovery" : "mobility",
          exercises: moves.map((move, moveIndex) => ({
            name: move,
            sets: isTraining ? (weekIndex < 2 ? 3 : 4) : 2,
            reps: isTraining ? (conditioning ? "30-45 sec steady" : moveIndex === moves.length - 1 ? "30-45 sec" : "8-12") : "45-60 sec",
            notes: hasInjuries ? "Stay pain-free. Shorten range." : "Move with control. Leave 2 reps reserve.",
          })),
        } satisfies DayPlan;
      }),
    })),
  };
}

function calcMacros(calories: number, weightKg: number): MacroSet {
  const protein = Math.round(Math.max(90, weightKg * 1.8));
  const fat = Math.round(Math.max(45, weightKg * 0.75));
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

// =========================================================================
// Allergen filter — strips meals & ingredients that contain a flagged food.
// =========================================================================

const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ["peanut", "peanuts", "peanut butter", "pb"],
  peanuts: ["peanut", "peanuts", "peanut butter", "pb"],
  tree_nut: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut"],
  nuts: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut"],
  nut: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia"],
  shellfish: ["shrimp", "prawn", "lobster", "crab", "oyster", "mussel", "clam", "scallop", "crawfish"],
  fish: ["salmon", "tuna", "cod", "tilapia", "trout", "halibut", "sardine", "mackerel", "anchovy"],
  dairy: ["milk", "cheese", "yogurt", "butter", "cream", "whey", "ghee", "casein", "lactose"],
  lactose: ["milk", "cheese", "yogurt", "butter", "cream", "whey", "casein", "lactose"],
  milk: ["milk", "cheese", "yogurt", "butter", "cream", "whey", "casein"],
  gluten: ["wheat", "bread", "pasta", "flour", "barley", "rye", "couscous", "bulgur", "seitan", "tortilla", "cracker", "cereal"],
  wheat: ["wheat", "bread", "pasta", "flour", "couscous", "bulgur", "tortilla", "cracker"],
  egg: ["egg", "eggs", "omelet", "omelette", "mayonnaise", "mayo", "frittata"],
  eggs: ["egg", "eggs", "omelet", "omelette", "mayonnaise", "mayo", "frittata"],
  soy: ["soy", "soybean", "tofu", "tempeh", "edamame", "soy sauce", "tamari", "miso"],
  sesame: ["sesame", "tahini"],
  pork: ["pork", "bacon", "ham", "prosciutto", "sausage", "pepperoni", "chorizo"],
  beef: ["beef", "steak", "burger"],
};

function normalizeAllergens(data: PlanInput): { tokens: Set<string>; labels: string[] } {
  const raw: string[] = [];
  for (const a of data.allergies ?? []) raw.push(a);
  if (data.foods_avoided) {
    for (const a of data.foods_avoided.split(/[,;\n]/)) {
      const t = a.trim();
      if (t) raw.push(t);
    }
  }
  const labels: string[] = [];
  const tokens = new Set<string>();
  for (const item of raw) {
    const key = item.toLowerCase().trim();
    if (!key) continue;
    if (!labels.some((l) => l.toLowerCase() === key)) labels.push(item.trim());
    const expanded = ALLERGEN_SYNONYMS[key] ?? ALLERGEN_SYNONYMS[key.replace(/s$/, "")] ?? [key];
    for (const tok of expanded) tokens.add(tok.toLowerCase());
    tokens.add(key);
  }
  return { tokens, labels };
}

function containsAllergen(text: string, tokens: Set<string>): boolean {
  if (tokens.size === 0) return false;
  const lower = text.toLowerCase();
  for (const tok of tokens) {
    if (!tok) continue;
    // word-ish match: token surrounded by non-letters or string boundary
    const re = new RegExp(`(^|[^a-z])${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(lower)) return true;
  }
  return false;
}

function mealHasAllergen(meal: PlannedMeal, tokens: Set<string>): boolean {
  if (containsAllergen(meal.name, tokens)) return true;
  if (containsAllergen(meal.swap_note ?? "", tokens)) return true;
  for (const ing of meal.ingredients ?? []) {
    if (containsAllergen(ing.item, tokens)) return true;
  }
  return false;
}

function sanitizeNutritionPlan(plan: NutritionPlan, data: PlanInput): NutritionPlan {
  const { tokens, labels } = normalizeAllergens(data);
  if (tokens.size === 0) {
    return { ...plan, excluded_allergens: [] };
  }

  const fallback = fallbackNutritionPlan(data);
  let swapped = 0;

  const cleanedMealPlan: MealDay[] = plan.meal_plan.map((day) => {
    const fallbackDay = fallback.meal_plan[(day.day - 1) % fallback.meal_plan.length];
    const cleanedMeals: PlannedMeal[] = day.meals.map((meal) => {
      if (!mealHasAllergen(meal, tokens)) return meal;
      // Try fallback meal for same slot, then any slot.
      const sub =
        fallbackDay.meals.find((m) => m.slot === meal.slot && !mealHasAllergen(m, tokens)) ??
        fallbackDay.meals.find((m) => !mealHasAllergen(m, tokens));
      if (sub) {
        swapped++;
        return { ...sub, slot: meal.slot, time_hint: meal.time_hint };
      }
      // Last resort: strip the meal's ingredients
      swapped++;
      return {
        ...meal,
        name: `${meal.slot.charAt(0).toUpperCase() + meal.slot.slice(1)}: safe protein + rice + greens`,
        ingredients: [
          { item: "chicken breast", qty: "180", unit: "g" },
          { item: "rice", qty: "1", unit: "cup" },
          { item: "mixed greens", qty: "2", unit: "cups" },
        ].filter((i) => !containsAllergen(i.item, tokens)),
        swap_note: "Allergen swap — pick any protein you tolerate.",
      };
    });
    const total_calories = cleanedMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const total_protein_g = cleanedMeals.reduce((s, m) => s + (m.protein_g ?? 0), 0);
    return { ...day, meals: cleanedMeals, total_calories, total_protein_g };
  });

  // Strip allergens from grocery list too.
  const cleanedGrocery: GroceryGroup[] = (plan.grocery_list ?? []).map((group) => ({
    ...group,
    items: (group.items ?? []).filter((i) => !containsAllergen(i.item, tokens)),
  })).filter((group) => group.items.length > 0);

  // Strip from sample_day
  const cleanedSampleDay = (plan.sample_day ?? []).filter((m) => !containsAllergen(m.name, tokens));

  if (swapped > 0) {
    console.log(`[plan-generator] swapped ${swapped} meals for allergens: ${labels.join(", ")}`);
  }

  return {
    ...plan,
    meal_plan: cleanedMealPlan,
    grocery_list: cleanedGrocery,
    sample_day: cleanedSampleDay.length > 0 ? cleanedSampleDay : plan.sample_day,
    excluded_allergens: labels,
  };
}

function fallbackNutritionPlan(data: PlanInput): NutritionPlan {
  const weight = data.weight_kg ?? 82;
  const goalWeight = data.goal_weight_kg ?? weight;
  const trainingDays = preferredTrainingDayIndexes(data);
  const goalText = (data.goals ?? []).join(" ").toLowerCase();
  const wantsLoss = goalWeight < weight || /lose|fat|lean|cut/.test(goalText);
  const wantsGain = goalWeight > weight || /muscle|gain|bulk|strength/.test(goalText);
  const maintenance = weight * 30 + (data.training_days_per_week ?? 3) * 65;
  const baselineCalories = roundTo(maintenance + (wantsLoss ? -400 : wantsGain ? 250 : -100), 50);
  const baseline = calcMacros(Math.max(1400, baselineCalories), weight);
  const training = calcMacros(roundTo(baseline.calories * 1.12, 50), weight);
  const rest = calcMacros(roundTo(baseline.calories * 0.95, 50), weight);
  const pattern = data.dietary_pattern ?? "omnivore";
  const { tokens } = normalizeAllergens(data);
  const proteinPool = pattern === "vegan"
    ? ["tofu", "lentils", "tempeh", "chickpeas"]
    : pattern === "vegetarian"
      ? ["eggs", "Greek yogurt", "tofu", "cottage cheese"]
      : pattern === "pescatarian"
        ? ["salmon", "tuna", "eggs", "Greek yogurt"]
        : ["chicken breast", "turkey", "eggs", "salmon"];
  const safeProteins = proteinPool.filter((p) => !containsAllergen(p, tokens));
  const proteins = safeProteins.length ? safeProteins : ["chicken breast", "rice", "beans"].filter((p) => !containsAllergen(p, tokens));
  const carbs = ["oats", "rice", "sweet potato", "quinoa", "berries", "banana"].filter((c) => !containsAllergen(c, tokens));
  const carbPool = carbs.length ? carbs : ["rice", "potato", "fruit"].filter((c) => !containsAllergen(c, tokens));
  const fats = ["avocado", "olive oil", "almonds", "peanut butter"].filter((f) => !containsAllergen(f, tokens));
  const fatPool = fats.length ? fats : ["olive oil", "seeds"].filter((f) => !containsAllergen(f, tokens));

  const makeMeal = (day: number, slot: PlannedMeal["slot"], calories: number, protein: number, index: number): PlannedMeal => {
    const proteinItem = (proteins[(day + index) % Math.max(1, proteins.length)] ?? "chicken breast");
    const carbItem = (carbPool[(day + index) % Math.max(1, carbPool.length)] ?? "rice");
    const fatItem = (fatPool[(day + index) % Math.max(1, fatPool.length)] ?? "olive oil");
    const slotTitle = slot[0].toUpperCase() + slot.slice(1);
    return {
      slot,
      time_hint: slot === "breakfast" ? "morning" : slot === "lunch" ? "midday" : slot === "snack" ? "afternoon" : "evening",
      name: `${slotTitle}: ${proteinItem} with ${carbItem}`,
      ingredients: [
        { item: proteinItem, qty: slot === "snack" ? "150" : "180", unit: "g" },
        { item: carbItem, qty: slot === "snack" ? "1" : "1.5", unit: carbItem === "banana" ? "piece" : "cup" },
        { item: fatItem, qty: "1", unit: fatItem === "olive oil" ? "tbsp" : "serving" },
        { item: "mixed greens", qty: slot === "breakfast" ? "1" : "2", unit: "cup" },
      ].filter((i) => !containsAllergen(i.item, tokens)),
      calories,
      protein_g: protein,
      carbs_g: Math.max(15, Math.round((calories - protein * 4) / 6)),
      fat_g: Math.max(8, Math.round((calories - protein * 4) / 18)),
      prep_minutes: slot === "snack" ? 5 : 20,
      swap_note: `Swap ${proteinItem} for any protein you tolerate.`,
    };
  };

  const mealPlan: MealDay[] = DAY_NAMES.map((label, i) => {
    const isTraining = trainingDays.has(i);
    const target = isTraining ? training : rest;
    const meals = [
      makeMeal(i, "breakfast", Math.round(target.calories * 0.25), Math.round(target.protein_g * 0.25), 0),
      makeMeal(i, "lunch", Math.round(target.calories * 0.32), Math.round(target.protein_g * 0.32), 1),
      makeMeal(i, "snack", Math.round(target.calories * 0.13), Math.round(target.protein_g * 0.13), 2),
      makeMeal(i, "dinner", Math.round(target.calories * 0.30), Math.round(target.protein_g * 0.30), 3),
    ];
    return {
      day: i + 1,
      day_label: label,
      day_type: isTraining ? "training" : "rest",
      total_calories: target.calories,
      total_protein_g: target.protein_g,
      meals,
    };
  });

  const groceryMap = new Map<string, { aisle: GroceryGroup["aisle"]; item: string; qty: number; unit: string }>();
  const aisleFor = (item: string): GroceryGroup["aisle"] => {
    if (/chicken|turkey|salmon|tuna|tofu|lentils|tempeh|chickpeas|eggs|beans/i.test(item)) return "Protein";
    if (/yogurt|cottage/i.test(item)) return "Dairy";
    if (/greens|berries|banana|avocado|potato/i.test(item)) return "Produce";
    if (/rice|oats|quinoa|oil|almonds|peanut/i.test(item)) return "Pantry";
    return "Other";
  };
  for (const meal of mealPlan.flatMap((d) => d.meals)) {
    for (const ingredient of meal.ingredients) {
      const key = `${ingredient.item}-${ingredient.unit}`;
      const qty = Number.parseFloat(ingredient.qty) || 1;
      const current = groceryMap.get(key) ?? { aisle: aisleFor(ingredient.item), item: ingredient.item, qty: 0, unit: ingredient.unit };
      current.qty += qty;
      groceryMap.set(key, current);
    }
  }
  const groceryList: GroceryGroup[] = (["Produce", "Protein", "Pantry", "Dairy", "Frozen", "Other"] as const)
    .map((aisle) => ({
      aisle,
      items: Array.from(groceryMap.values())
        .filter((i) => i.aisle === aisle)
        .map((i) => ({ item: i.item, qty: Number.isInteger(i.qty) ? String(i.qty) : i.qty.toFixed(1), unit: i.unit })),
    }))
    .filter((g) => g.items.length > 0);

  const { labels } = normalizeAllergens(data);

  return {
    ...baseline,
    training_day: training,
    rest_day: rest,
    hydration_ml: roundTo(weight * 35, 100),
    client_summary: `${data.first_name ?? "This plan"} is built around ${weight} kg today and a goal of ${goalWeight} kg, with a ${pattern} diet pattern. It avoids ${labels.length ? labels.join(", ") : "listed allergens"} and leans toward ${data.foods_liked || "simple high-protein meals"}.`,
    principles: [
      "Protein anchors every meal.",
      "Cook when you can. Log clearly when you eat out.",
      "Training days get more fuel, not more chaos.",
      "Water stays ahead of caffeine.",
      "If a plate is unclear, describe portions before guessing.",
    ],
    meal_plan: mealPlan,
    grocery_list: groceryList,
    sample_day: mealPlan[0].meals.map((m) => ({ meal: m.slot, name: m.name, calories: m.calories, protein_g: m.protein_g })),
    excluded_allergens: labels,
  };
}

/** Generate a single 4-week block. Falls back to the hand-rolled plan on AI failure. */
async function generateBlock(data: PlanInput, blockNumber: 1 | 2 | 3): Promise<FitnessPlan> {
  const meta = BLOCK_META[blockNumber - 1];
  const payload = {
    ...data,
    phase_block: { number: meta.number, name: meta.name, progression_rule: meta.rule, of_total: 3 },
  };
  const draft = await requestPlanObject<FitnessPlan>("fitness", FITNESS_SYSTEM, payload, 4096).catch((error) => {
    console.error(`fitness block ${blockNumber} generation failed`, error);
    return null;
  });
  if (isFitnessBlock(draft)) return draft;
  // Fallback: take the hand-rolled 4-week plan but rewrite its focus labels to match the block.
  const fb = fallbackFitnessPlan(data);
  fb.weeks = fb.weeks.map((w) => ({ ...w, focus: w.week === 4 && blockNumber === 3 ? "Deload week" : meta.default_focus }));
  return fb;
}

export async function generatePlan(data: PlanInput): Promise<PlanResult> {
  const [block1, block2, block3, nutritionDraft] = await Promise.all([
    generateBlock(data, 1),
    generateBlock(data, 2),
    generateBlock(data, 3),
    requestPlanObject<NutritionPlan>("nutrition", NUTRITION_SYSTEM, data, 6144).catch((error) => {
      console.error("nutrition plan generation failed", error);
      return null;
    }),
  ]);

  // Stitch the three 4-week blocks into one continuous 12-week phase.
  const weeks: WeekPlan[] = [];
  const blocks: PhaseBlock[] = [];
  for (const [idx, block] of [block1, block2, block3].entries()) {
    const offset = idx * 4;
    const meta = BLOCK_META[idx];
    for (const w of block.weeks) {
      weeks.push({ ...w, week: offset + w.week });
    }
    blocks.push({
      number: meta.number,
      name: meta.name,
      week_range: [offset + 1, offset + 4],
      focus: block.weeks[0]?.focus ?? meta.default_focus,
    });
  }
  const fitness: FitnessPlan = {
    overview: block1.overview,
    weeks,
    blocks,
  };

  const nutritionRaw = isNutritionPlan(nutritionDraft) ? nutritionDraft : fallbackNutritionPlan(data);
  const nutrition = sanitizeNutritionPlan(nutritionRaw, data);
  return { fitness, nutrition };
}
