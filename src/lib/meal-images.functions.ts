import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Tiny stable hash for cache keying (FNV-1a 32-bit → base36).
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 7);
}

function slotSetting(slot?: string | null): string {
  switch (slot) {
    case "breakfast": return "soft morning daylight from a side window, light wood or marble surface";
    case "lunch": return "bright midday natural light, neutral linen napkin nearby";
    case "dinner": return "warm dim evening light, dark slate or moody wood surface";
    case "snack": return "clean studio light, minimal surface";
    default: return "soft natural daylight, neutral surface";
  }
}

/**
 * Returns a cached food image URL or generates a new one via Lovable AI Gateway.
 * Cache key includes a hash of the sorted main ingredients so the same meal name
 * with different ingredient sets gets a distinct photo.
 */
export const getOrGenerateMealImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(2).max(120),
      ingredients: z.array(z.string().min(1).max(60)).max(20).optional(),
      slot: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const baseSlug = slugify(data.name);
    if (!baseSlug) throw new Error("Invalid meal name");

    const mains = (data.ingredients ?? [])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6)
      .sort();
    const ingHash = mains.length ? shortHash(mains.join("|")) : "";
    const slug = ingHash ? `${baseSlug}-${ingHash}` : baseSlug;

    // 1) cache lookup — exact key first, then fall back to legacy name-only slug.
    const { data: cached } = await supabaseAdmin
      .from("meal_image_cache")
      .select("image_url")
      .eq("slug", slug)
      .maybeSingle();
    if (cached?.image_url) return { url: cached.image_url, cached: true };

    if (ingHash) {
      const { data: legacy } = await supabaseAdmin
        .from("meal_image_cache")
        .select("image_url")
        .eq("slug", baseSlug)
        .maybeSingle();
      // Only reuse legacy if we have nothing better — otherwise generate fresh.
      if (legacy?.image_url && mains.length === 0) {
        return { url: legacy.image_url, cached: true };
      }
    }

    // 2) generate via Lovable AI
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const ingredientPhrase = mains.length
      ? ` Clearly featuring ${mains.join(", ")}.`
      : "";
    const setting = slotSetting(data.slot);
    const prompt = `Ultra-realistic overhead food photograph of "${data.name}".${ingredientPhrase} ${setting}. Shallow depth of field, rustic ceramic plate, professional food styling, vibrant fresh ingredients, appetizing, magazine-quality. The plated dish must visually match the listed ingredients. No text, no watermarks, no people, no utensils labels.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });

    if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`Image gateway error: ${res.status}`);

    const json = await res.json();
    const b64: string | undefined = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");

    // 3) upload to storage
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${slug}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("food-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabaseAdmin.storage.from("food-images").getPublicUrl(path);
    const url = pub.publicUrl;

    // 4) cache
    await supabaseAdmin
      .from("meal_image_cache")
      .upsert({ slug, meal_name: data.name, image_url: url }, { onConflict: "slug" });

    return { url, cached: false };
  });
