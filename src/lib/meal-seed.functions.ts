// Admin-only seeding + image generation for the curated meals library.
// Image generation routes through Lovable AI Gateway (Gemini Nano Banana).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only.");
}

const IMAGE_MODEL = "google/gemini-3.1-flash-image";

function buildImagePrompt(title: string, ingredients: { name: string; amount: string }[]): string {
  const list = ingredients.map((i) => `${i.amount} ${i.name}`).join(", ");
  return [
    `Overhead photo of a single ${title} meal on a neutral matte ceramic plate or bowl, natural daylight, shallow depth of field, photoreal, no text, no watermark.`,
    `The plate contains exactly: ${list}.`,
    "Show every listed item; do not add any other foods or drinks. No people, no hands.",
  ].join(" ");
}

/** Admin: generate (or regenerate) the image for one meal row. */
export const generateMealImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured.");

    const { data: meal, error } = await supabase
      .from("meals")
      .select("id, title, ingredients")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !meal) throw new Error("Meal not found.");

    const ingredients = Array.isArray(meal.ingredients) ? (meal.ingredients as { name: string; amount: string }[]) : [];
    const prompt = buildImagePrompt(meal.title as string, ingredients);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limited — wait and retry.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Image gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image gateway returned no image.");

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${meal.id}.png`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("meal-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { error: updErr } = await supabaseAdmin
      .from("meals")
      .update({ image_path: path })
      .eq("id", meal.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const, image_path: path };
  });

export const setMealActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("meals").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin: list every meal (active or not) with a signed image url. */
export const listAllMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("meals")
      .select("id, slot, type, brand, title, kcal, protein_g, carbs_g, fat_g, prep_minutes, ingredients, dietary_tags, image_path, active")
      .order("slot")
      .order("type")
      .order("title");
    if (error) throw new Error(error.message);

    const signed = await Promise.all(
      (rows ?? []).map(async (r) => {
        let url: string | null = null;
        if (r.image_path) {
          const { data } = await supabase.storage.from("meal-images").createSignedUrl(r.image_path as string, 3600);
          url = data?.signedUrl ?? null;
        }
        return { ...r, image_url: url };
      }),
    );
    return signed;
  });
