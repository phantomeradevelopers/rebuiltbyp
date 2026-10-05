import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Slot = (typeof SLOTS)[number];

export type RegeneratedMeal = {
  slot: Slot;
  time_hint: string;
  name: string;
  ingredients: { item: string; qty: string; unit: string }[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
  swap_note: string;
  seasonings: string[];
  steps: string[];
};

export const listMealOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("meal_overrides")
      .select("day, slot, meal")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { overrides: data ?? [] };
  });

export const clearMealOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ day: z.number().int(), slot: z.enum(SLOTS) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("meal_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("day", data.day)
      .eq("slot", data.slot);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * AI-generate a replacement meal for one slot, honoring user taste profile,
 * staple seasonings, cooking skill, allergies, and target macros.
 */
export const regenerateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      day: z.number().int().min(1).max(31),
      slot: z.enum(SLOTS),
      target_calories: z.number().int().min(100).max(2000),
      target_protein_g: z.number().int().min(5).max(200),
      previous_name: z.string().max(120).optional(),
      avoid_names: z.array(z.string().max(120)).max(10).optional(),
      dislike_reason: z.string().max(200).optional(),
      preview: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("user_profile")
      .select(
        "first_name, dietary_pattern, allergies, foods_avoided, foods_liked, taste_profile, cooking_skill, staple_seasonings, cooking_willingness, cooking_minutes_per_day, tradition, faith_mode_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Profile not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const skill = (profile.cooking_skill ?? "easy") as string;
    const stapleSeasonings = (profile.staple_seasonings as string[] | null) ?? [];

    const system = `You are P, a nutrition coach. Design ONE replacement ${data.slot} meal for this client. RULES:
- Tasteful, simple, ${skill === "advanced" ? "can include a more technique-driven recipe" : "EASY combinations only (≤8 ingredients, ≤6 steps)"}.
- Hit target macros within ±10% (calories ${data.target_calories} kcal, protein ${data.target_protein_g}g).
- Lean on the client's STAPLE SEASONINGS: ${stapleSeasonings.length ? stapleSeasonings.join(", ") : "salt, pepper, garlic powder, olive oil"}. Only introduce one new seasoning if essential.
- Honor dietary pattern, allergies, foods avoided. Match foods liked when possible.
- ${data.previous_name ? `Do NOT suggest "${data.previous_name}" again.` : ""}
- ${data.avoid_names?.length ? `Also avoid: ${data.avoid_names.map((n) => `"${n}"`).join(", ")}.` : ""}
- ${data.dislike_reason ? `User feedback: "${data.dislike_reason}". Steer away from that.` : ""}
- Return STRICT JSON, nothing else.`;

    const userPayload = {
      profile: {
        dietary_pattern: profile.dietary_pattern,
        allergies: profile.allergies,
        foods_avoided: profile.foods_avoided,
        foods_liked: profile.foods_liked,
        taste_profile: profile.taste_profile,
        tradition: profile.faith_mode_enabled ? profile.tradition : null,
        cooking_skill: skill,
        cooking_minutes_per_day: profile.cooking_minutes_per_day,
      },
      slot: data.slot,
      target_calories: data.target_calories,
      target_protein_g: data.target_protein_g,
    };

    const schema = {
      type: "object",
      properties: {
        meal: {
          type: "object",
          properties: {
            name: { type: "string" },
            time_hint: { type: "string" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  qty: { type: "string" },
                  unit: { type: "string" },
                },
                required: ["item", "qty", "unit"],
              },
            },
            seasonings: { type: "array", items: { type: "string" } },
            steps: { type: "array", items: { type: "string" } },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
            prep_minutes: { type: "number" },
            swap_note: { type: "string" },
          },
          required: [
            "name", "time_hint", "ingredients", "seasonings", "steps",
            "calories", "protein_g", "carbs_g", "fat_g", "prep_minutes", "swap_note",
          ],
        },
      },
      required: ["meal"],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_meal",
            description: "Return the regenerated meal",
            parameters: schema,
          },
        }],
        tool_choice: { type: "function", function: { name: "return_meal" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up to keep swapping meals.");
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`AI gateway error (${res.status}): ${errText.slice(0, 200) || "no detail"}`);
    }

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const contentRaw = json?.choices?.[0]?.message?.content;

    let parsed: { meal: RegeneratedMeal } | null = null;
    const candidates: string[] = [];
    if (typeof args === "string") candidates.push(args);
    if (typeof contentRaw === "string") {
      candidates.push(contentRaw);
      // Try to extract a JSON object from fenced code or surrounding text.
      const fence = contentRaw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence?.[1]) candidates.push(fence[1]);
      const brace = contentRaw.match(/\{[\s\S]*\}/);
      if (brace?.[0]) candidates.push(brace[0]);
    }
    for (const c of candidates) {
      try {
        const p = JSON.parse(c);
        if (p?.meal?.name) { parsed = p; break; }
        if (p?.name && p?.ingredients) { parsed = { meal: p }; break; }
      } catch { /* try next */ }
    }
    if (!parsed) throw new Error("AI returned no meal — try again.");

    const meal = { ...parsed.meal, slot: data.slot };

    // Skip persistence in preview mode (used for 3-alternatives picker)
    if (data.preview) {
      return { meal };
    }

    // persist override
    const { error: upErr } = await supabase
      .from("meal_overrides")
      .upsert(
        { user_id: userId, day: data.day, slot: data.slot, meal },
        { onConflict: "user_id,day,slot" },
      );
    if (upErr) throw new Error(upErr.message);

    return { meal };
  });

/** Commit a chosen meal preview to meal_overrides. */
export const commitMealOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      day: z.number().int().min(1).max(31),
      slot: z.enum(SLOTS),
      meal: z.any(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const meal = { ...(data.meal as Record<string, unknown>), slot: data.slot };
    const { error } = await supabase
      .from("meal_overrides")
      .upsert(
        { user_id: userId, day: data.day, slot: data.slot, meal },
        { onConflict: "user_id,day,slot" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
