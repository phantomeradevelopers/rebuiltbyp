import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


export type FuelFeel = { summary: string; tone: "ahead" | "ontrack" | "behind" | "over" };

const Input = z.object({ force: z.boolean().optional() });

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type Targets = Totals | null;

function classify(totals: Totals, targets: Targets): FuelFeel["tone"] {
  if (!targets) return "ontrack";
  const kPct = targets.calories > 0 ? totals.calories / targets.calories : 0;
  const pPct = targets.protein_g > 0 ? totals.protein_g / targets.protein_g : 0;
  const dayProgress = Math.min(1, (new Date().getHours() * 60 + new Date().getMinutes()) / (22 * 60));
  if (kPct > 1.1) return "over";
  if (kPct >= 0.9 * dayProgress && pPct >= 0.85 * dayProgress) return "ontrack";
  if (kPct >= dayProgress * 1.05) return "ahead";
  return "behind";
}

function fallback(totals: Totals, targets: Targets, tone: FuelFeel["tone"]): string {
  if (!targets) return "No target set yet. Open your plan to lock one in.";
  const remK = Math.max(0, targets.calories - totals.calories);
  const remP = Math.max(0, targets.protein_g - totals.protein_g);
  switch (tone) {
    case "over":
      return `You're past today's calories. Keep dinner light — water and protein, skip the snacks.`;
    case "behind":
      return `You're behind — ${remK} kcal and ${remP}g protein still to hit. Plan your next meal now.`;
    case "ahead":
      return `On pace. Stay steady — ${remP}g protein left to round out the day.`;
    default:
      return `Tracking well. ${remK} kcal / ${remP}g protein still to go.`;
  }
}

async function aiSummary(totals: Totals, targets: Targets, meals: { name: string; calories: number; protein_g: number }[]): Promise<string | null> {
  const tgt = targets
    ? `Target: ${targets.calories} kcal, P ${targets.protein_g}g / C ${targets.carbs_g}g / F ${targets.fat_g}g.`
    : "No target.";
  const so_far = `So far: ${totals.calories} kcal, P ${totals.protein_g}g / C ${totals.carbs_g}g / F ${totals.fat_g}g across ${meals.length} meal${meals.length === 1 ? "" : "s"}.`;
  const last = meals.slice(-3).map((m) => `${m.name} (${m.calories}k/${m.protein_g}p)`).join("; ") || "nothing yet";
  const system = `You are Playboy P — calm, steady coach. Plain words, no fluff. 1-2 sentences, max 28 words. Tell him exactly what to do next with his fuel today. No emojis, no hashtags, no quotes.`;
  const user = `${tgt} ${so_far} Recent: ${last}. Local time hour: ${new Date().getHours()}.`;
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: 90,
        temperature: 0.7,
      }),
    });
    if (!res || !res.ok) return null;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text ? text.replace(/^["']|["']$/g, "").slice(0, 220) : null;
  } catch {
    return null;
  }
}

export const getFuelFeel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<FuelFeel> => {
    const { supabase, userId } = context;
    const date = new Date().toISOString().slice(0, 10);

    // Load today's meals + nutrition target (same shape as getTodayNutrition)
    const [{ data: meals }, { data: planRow }] = await Promise.all([
      supabase.from("food_log")
        .select("name, calories, protein_g, carbs_g, fat_g")
        .eq("user_id", userId).eq("date", date)
        .order("logged_at", { ascending: true }),
      supabase.from("user_plans")
        .select("plan_data")
        .eq("user_id", userId).eq("plan_type", "nutrition").eq("active", true)
        .order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const list = (meals ?? []) as Array<{ name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>;
    const totals = list.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein_g: a.protein_g + m.protein_g,
        carbs_g: a.carbs_g + m.carbs_g,
        fat_g: a.fat_g + m.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
    const plan = planRow?.plan_data as { calories: number; protein_g: number; carbs_g: number; fat_g: number } | undefined;
    const targets: Targets = plan
      ? { calories: plan.calories, protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g }
      : null;
    const tone = classify(totals, targets);
    void data; // force flag is accepted but caching is purely client-side via React Query
    const ai = await aiSummary(totals, targets, list);
    return { summary: ai ?? fallback(totals, targets, tone), tone };
  });
