import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Slot = (typeof SLOTS)[number];

export type FastFoodMeal = {
  slot: Slot;
  time_hint: string;
  name: string;            // e.g. "Chipotle — Double chicken burrito bowl"
  chain: string;           // "Chipotle"
  menu_item: string;       // "Burrito Bowl (build-your-own)"
  order_lines: string[];   // exact phrases to say at the counter
  ingredients: { item: string; qty: string; unit: string }[]; // shown for parity with PlannedMeal
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;    // wait time
  swap_note: string;
  seasonings: string[];
  steps: string[];         // pickup instructions (drive-thru / app order / counter)
  source: "fast_food";
};

/**
 * Swap a planned meal for a comparable fast-food order that hits the same
 * macro targets within ±15%. Persists into the same meal_overrides table so
 * the existing UI rehydrates it automatically.
 */
export const swapMealForFastFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      day: z.number().int().min(1).max(31),
      slot: z.enum(SLOTS),
      target_calories: z.number().int().min(100).max(2000),
      target_protein_g: z.number().int().min(5).max(200),
      previous_name: z.string().max(160).optional(),
      chain: z.string().max(60).optional(),
      preview: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("user_profile")
      .select(
        "dietary_pattern, allergies, foods_avoided, foods_liked, restaurants, location",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Profile not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const userRestaurants = (profile.restaurants as string[] | null) ?? [];
    const preferList = data.chain
      ? `LOCKED CHAIN: the user has chosen ${data.chain}. Build the order at ${data.chain} only — do not switch chains.`
      : userRestaurants.length
      ? `Prefer one of these the user already eats at: ${userRestaurants.join(", ")}.`
      : `Pick a widely-available US chain (Chipotle, Sweetgreen, Chick-fil-A, Panera, Cava, Subway).`;

    const system = `You are P, a nutrition coach. The user wants to SWAP a planned ${data.slot} for a fast-food / fast-casual order they can pick up today. RULES:
- Hit target macros within ±15% (target: ${data.target_calories} kcal, ${data.target_protein_g}g protein).
- ${preferList}
- Honor dietary pattern, allergies, foods avoided.
- ${data.previous_name ? `Don't suggest "${data.previous_name}" again.` : ""}
- order_lines must be 2–5 short, literal phrases the user can say at the counter or paste into the chain's app. Each line is ONE customization (e.g. "Bowl with brown rice, half scoop", "Double the chicken", "No cheese, no sour cream").
- menu_item is the official build-your-own / menu name (e.g. "Burrito Bowl (build-your-own)").
- ingredients is a compact list (3–6 items) reflecting what's actually in the order so the meal card looks normal.
- steps is the pickup flow ("Order in the app", "Pick up at counter") — keep ≤3 short lines.
- Return STRICT JSON via the tool call.`;

    const schema = {
      type: "object",
      properties: {
        meal: {
          type: "object",
          properties: {
            chain: { type: "string" },
            menu_item: { type: "string" },
            name: { type: "string" },
            time_hint: { type: "string" },
            order_lines: { type: "array", items: { type: "string" } },
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
            "chain", "menu_item", "name", "time_hint", "order_lines",
            "ingredients", "seasonings", "steps",
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
          {
            role: "user",
            content: JSON.stringify({
              slot: data.slot,
              target_calories: data.target_calories,
              target_protein_g: data.target_protein_g,
              dietary_pattern: profile.dietary_pattern,
              allergies: profile.allergies,
              foods_avoided: profile.foods_avoided,
              foods_liked: profile.foods_liked,
              location: profile.location,
            }),
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_fast_food",
            description: "Return the chosen fast-food meal",
            parameters: schema,
          },
        }],
        tool_choice: { type: "function", function: { name: "return_fast_food" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`AI gateway error (${res.status}): ${errText.slice(0, 200) || "no detail"}`);
    }

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const contentRaw = json?.choices?.[0]?.message?.content;

    type FFShape = Omit<FastFoodMeal, "slot" | "source">;
    let parsed: { meal: FFShape } | null = null;
    const candidates: string[] = [];
    if (typeof args === "string") candidates.push(args);
    if (typeof contentRaw === "string") {
      candidates.push(contentRaw);
      const fence = contentRaw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence?.[1]) candidates.push(fence[1]);
      const brace = contentRaw.match(/\{[\s\S]*\}/);
      if (brace?.[0]) candidates.push(brace[0]);
    }
    for (const c of candidates) {
      try {
        const p = JSON.parse(c);
        if (p?.meal?.name) { parsed = p as { meal: FFShape }; break; }
        if (p?.name && p?.menu_item) { parsed = { meal: p as FFShape }; break; }
      } catch { /* try next */ }
    }
    if (!parsed) throw new Error("AI returned no meal — try again.");

    const meal: FastFoodMeal = { ...parsed.meal, slot: data.slot, source: "fast_food" };

    if (data.preview) {
      return { meal };
    }

    const { error: upErr } = await supabase
      .from("meal_overrides")
      .upsert(
        { user_id: userId, day: data.day, slot: data.slot, meal },
        { onConflict: "user_id,day,slot" },
      );
    if (upErr) throw new Error(upErr.message);

    return { meal };
  });
