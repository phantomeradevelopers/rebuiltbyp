import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUGGESTION_KINDS = ["swap", "shake", "restaurant_order", "sauce", "avoid", "sweet_sub"] as const;
type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

const CATEGORIES = ["grocery", "restaurant", "swap", "learn"] as const;
type Category = (typeof CATEGORIES)[number];

function categoryFor(kind: SuggestionKind): Category {
  if (kind === "restaurant_order") return "restaurant";
  if (kind === "swap" || kind === "shake" || kind === "sweet_sub") return "grocery";
  return "learn";
}

type AiSuggestion = {
  kind: SuggestionKind;
  category?: Category;
  title: string;
  body: string;
  store_or_brand?: string | null;
  rationale?: string | null;
  // New structured fields (restaurant_order only)
  menu_item?: string | null;
  order_lines?: string[] | null;
  macros?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } | null;
  why?: string | null;
};


export const listSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("nutrition_suggestions")
      .select("*")
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return { suggestions: data ?? [] };
  });

export const dismissSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("nutrition_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSaveSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; saved: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("nutrition_suggestions")
      .update({ saved: data.saved })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Use Lovable AI to generate 8-12 curated nutrition suggestions tailored
 * to the user's taste profile, location, and recent food log. Replaces
 * the existing undismissed suggestions.
 */
export const curateNutrition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("user_profile")
      .select("first_name, goals, dietary_pattern, allergies, foods_avoided, foods_liked, taste_profile, restaurants, grocery_stores, cooking_willingness, cooking_minutes_per_day, sweet_tooth, organic_preference, location")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Profile not found.");

    const { data: recent } = await supabase
      .from("food_log")
      .select("name, calories, protein_g, meal, logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const system = `You are P, a no-fluff nutrition coach for the REBUILT app. Generate 12-16 personalized, actionable suggestions split across THREE buckets so the app can show them on the right tab:

1. GROCERY (category="grocery"): specific products/brands to BUY at the user's grocery stores. For each, set store_or_brand to ONE of their listed grocery_stores. Include swap, shake, sweet_sub kinds. Be specific: real product names actually carried at that store. Aim for 5-7 items spread across their stores.

2. RESTAURANT (category="restaurant", kind="restaurant_order"): exact menu orders for the user's listed restaurants. STRUCTURE EVERY RESTAURANT ITEM LIKE THIS:
   - store_or_brand: chain name, verbatim from the user's list (e.g. "Chipotle").
   - title: 4–8 word headline ("Double chicken burrito bowl").
   - menu_item: the official menu name as printed ("Burrito Bowl (build-your-own)").
   - order_lines: 2–5 short literal phrases the user says at the counter or types into the app. ONE customization per line. Use natural spoken language.
     Good: ["Burrito bowl, brown rice — half scoop.", "Double chicken.", "Black beans, fajita veg, mild + corn salsa.", "No cheese, no sour cream. Side of guac."]
     Bad:  ["Order a healthy bowl with extra protein."]
   - macros: {calories, protein_g, carbs_g, fat_g} integers, realistic for that exact build.
   - why: ONE short sentence tied to the user's goal/profile.
   - body: a single human-readable fallback summary ("Burrito bowl, brown rice, double chicken, fajita veg, black beans, salsa, guac. ~720 kcal / 62g P.") — used only when the structured fields are missing.
   Aim for 4-6 orders covering most of their restaurants.

3. LEARN (category="learn"): short rules of thumb the user should know. kind=sauce or avoid. 2-3 items. body is one or two sentences; structured fields are not required.

Rules:
- Always lean organic / minimally-processed unless organic_preference is "no".
- NEVER suggest anything in allergies or foods_avoided.
- If cooking_willingness is low, favor grab-and-go grocery picks and restaurant orders over recipes.
- store_or_brand MUST match one of the user's actual stores/restaurants (verbatim) for grocery and restaurant items.
- For grocery/learn items leave menu_item, order_lines, macros, why as null.

Return strict JSON:
{ "suggestions": [
  { "kind": "swap" | "shake" | "restaurant_order" | "sauce" | "avoid" | "sweet_sub",
    "category": "grocery" | "restaurant" | "learn",
    "title": "short punchy title",
    "body": "human-readable summary / fallback",
    "store_or_brand": "exact store or restaurant name, or null for learn items",
    "rationale": "1 short sentence tied to their profile (used for grocery/learn)",
    "menu_item": "Official menu item name (restaurant_order only, else null)",
    "order_lines": ["literal phrase 1", "literal phrase 2", "..."],
    "macros": { "calories": 720, "protein_g": 62, "carbs_g": 55, "fat_g": 22 },
    "why": "Why this fits today (restaurant_order only, else null)" }
] }`;

    const userPayload = {
      profile: {
        first_name: profile.first_name,
        goals: profile.goals,
        dietary_pattern: profile.dietary_pattern,
        allergies: profile.allergies,
        foods_avoided: profile.foods_avoided,
        foods_liked: profile.foods_liked,
        taste_profile: profile.taste_profile,
        restaurants: profile.restaurants,
        grocery_stores: profile.grocery_stores,
        cooking_willingness: profile.cooking_willingness,
        cooking_minutes_per_day: profile.cooking_minutes_per_day,
        sweet_tooth: profile.sweet_tooth,
        organic_preference: profile.organic_preference,
        location: profile.location,
      },
      recent_meals: recent ?? [],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { suggestions?: AiSuggestion[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI returned malformed JSON.");
    }

    const items = (parsed.suggestions ?? [])
      .filter((s) => s && SUGGESTION_KINDS.includes(s.kind))
      .slice(0, 16)
      .map((s) => {
        const isOrder = s.kind === "restaurant_order";
        const orderLines = Array.isArray(s.order_lines)
          ? s.order_lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0).slice(0, 8)
          : null;
        return {
          user_id: userId,
          kind: s.kind,
          category: s.category && CATEGORIES.includes(s.category) ? s.category : categoryFor(s.kind),
          title: String(s.title).slice(0, 120),
          body: String(s.body).slice(0, 600),
          store_or_brand: s.store_or_brand ? String(s.store_or_brand).slice(0, 60) : null,
          rationale: s.rationale ? String(s.rationale).slice(0, 240) : null,
          menu_item: isOrder && s.menu_item ? String(s.menu_item).slice(0, 120) : null,
          order_lines: isOrder && orderLines && orderLines.length > 0 ? orderLines : null,
          macros: isOrder && s.macros && typeof s.macros === "object" ? s.macros : null,
          why: isOrder && s.why ? String(s.why).slice(0, 240) : null,
        };
      });

    if (items.length === 0) throw new Error("AI returned no suggestions.");


    // Clear non-saved undismissed items, then insert fresh batch.
    await supabase
      .from("nutrition_suggestions")
      .delete()
      .eq("user_id", userId)
      .eq("saved", false)
      .is("dismissed_at", null);

    const { error: insErr } = await supabase
      .from("nutrition_suggestions")
      .insert(items as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true, count: items.length };
  });
