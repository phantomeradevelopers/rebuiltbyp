import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.union([
  z.object({
    kind: z.literal("photo"),
    image_base64: z.string().min(100).max(8_000_000),
    mime: z.string().regex(/^image\/(jpeg|png|webp|heic|heif)$/i),
    meal_hint: z.string().max(40).optional(),
  }),
  z.object({
    kind: z.literal("text"),
    description: z.string().min(2).max(500),
    meal_hint: z.string().max(40).optional(),
  }),
]);

export type MealEstimate = {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "high" | "medium" | "low";
  advice: string;
};

const SYSTEM = `You are Playboy P, coach and nutrition estimator. Estimate one meal's macros.

Return STRICT JSON only — no markdown, no prose outside JSON:
{
  "name": "short dish name, max 60 chars",
  "calories": integer kcal,
  "protein_g": integer grams,
  "carbs_g": integer grams,
  "fat_g": integer grams,
  "confidence": "high" | "medium" | "low",
  "advice": "empty string when confidence is high. When medium or low, ONE short sentence in P's voice with a concrete tip for next time — e.g. 'Shoot from straight above with better light.' or 'Next time tell me portion size and sauce.' Never apologize, never refuse, never ask a question."
}

Rules:
- ALWAYS commit to a best-judgment estimate. Never return zeros, never refuse, never say you can't tell.
- Use realistic typical portions when size isn't given (e.g. 1 chicken breast ≈ 170g, 1 cup cooked rice ≈ 200g, 1 slice pizza ≈ 120g).
- If the meal_hint contains "eating out" or the photo looks like a restaurant plate, assume restaurant portions and add typical cooking-oil/butter/sauce overhead (+15–25% calories vs home-cooked).
- If the food is ambiguous, pick the most likely interpretation and estimate it. Set confidence="medium" or "low" and put the tip in "advice", but still return real numbers.
- Macros must roughly add up: protein*4 + carbs*4 + fat*9 ≈ calories (within ~15%).
- Always return all 7 fields with non-zero calories and macros when any food is present.`;

export const estimateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<MealEstimate> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const userContent =
      data.kind === "photo"
        ? [
            {
              type: "text",
              text: `Estimate this meal${data.meal_hint ? ` (likely ${data.meal_hint})` : ""}.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${data.mime};base64,${data.image_base64}` },
            },
          ]
        : `Estimate this meal${data.meal_hint ? ` (${data.meal_hint})` : ""}: ${data.description}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("estimate gateway", res.status, text);
      if (res.status === 429) throw new Error("Too many requests. Wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("Could not estimate. Try again.");
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI.");

    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Estimate format invalid. Try again.");
    }

    const Out = z.object({
      name: z.string().min(1).max(120),
      calories: z.number().int().min(0).max(5000),
      protein_g: z.number().int().min(0).max(500),
      carbs_g: z.number().int().min(0).max(1000),
      fat_g: z.number().int().min(0).max(500),
      confidence: z.enum(["high", "medium", "low"]),
      advice: z.string().max(300),
    });
    const result = Out.safeParse(parsed);
    if (!result.success) throw new Error("Estimate didn't match expected shape.");
    return result.data;
  });
