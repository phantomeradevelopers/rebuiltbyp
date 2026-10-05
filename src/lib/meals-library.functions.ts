// Server functions for the curated meals library (PUBLIC table `meals`).
// Used by Swap + Fast Food pickers; images are returned as signed URLs.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
const TYPES = ["standard", "fast_food"] as const;

export type LibraryMeal = {
  id: string;
  slot: (typeof SLOTS)[number];
  type: (typeof TYPES)[number];
  brand: string | null;
  title: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
  ingredients: { name: string; amount: string }[];
  dietary_tags: string[];
  image_path: string | null;
  image_url: string | null;
};

const SIGN_TTL = 60 * 60; // 1 hour

async function signImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Sign server-side with the service-role client so meal-images SELECT
  // policy stays admin-only.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("meal-images").createSignedUrl(path, SIGN_TTL);
  return data?.signedUrl ?? null;
}

const ListInput = z.object({
  slot: z.enum(SLOTS),
  type: z.enum(TYPES),
  excludeId: z.string().uuid().optional(),
  dietaryTags: z.array(z.string()).optional(),
});

export const listMealsBySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }): Promise<LibraryMeal[]> => {
    const { supabase } = context;
    let q = supabase
      .from("meals")
      .select("id, slot, type, brand, title, kcal, protein_g, carbs_g, fat_g, prep_minutes, ingredients, dietary_tags, image_path")
      .eq("active", true)
      .eq("slot", data.slot)
      .eq("type", data.type);
    if (data.excludeId) q = q.neq("id", data.excludeId);
    if (data.dietaryTags?.length) q = q.contains("dietary_tags", data.dietaryTags);
    const { data: rows, error } = await q.order("title");
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Omit<LibraryMeal, "image_url"> & { ingredients: unknown }>;
    return Promise.all(
      list.map(async (r) => ({
        ...r,
        ingredients: Array.isArray(r.ingredients) ? (r.ingredients as { name: string; amount: string }[]) : [],
        image_url: await signImage(r.image_path),
      })),
    );
  });

export const getMealById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<LibraryMeal | null> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("meals")
      .select("id, slot, type, brand, title, kcal, protein_g, carbs_g, fat_g, prep_minutes, ingredients, dietary_tags, image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      ...row,
      ingredients: Array.isArray(row.ingredients) ? (row.ingredients as { name: string; amount: string }[]) : [],
      image_url: await signImage(row.image_path as string | null),
    } as LibraryMeal;
  });
