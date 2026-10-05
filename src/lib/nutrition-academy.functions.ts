import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Food = {
  id: string;
  slug: string;
  name: string;
  category: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  why_it_matters: string;
  best_use: string;
  swaps: string | null;
  tags: string[];
  bookmarked?: boolean;
};

export type Lesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  read_minutes: number;
  category: string;
};

export const listFoods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ foods: Food[]; bookmarkedIds: string[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const [foodsRes, bmRes] = await Promise.all([
      supabase.from("nutrition_foods").select("*").order("category", { ascending: true }).order("name", { ascending: true }),
      supabase.from("user_food_bookmarks").select("food_id").eq("user_id", userId),
    ]);
    const bookmarkedIds = ((bmRes.data ?? []) as Array<{ food_id: string }>).map((r) => r.food_id);
    const set = new Set(bookmarkedIds);
    const foods: Food[] = ((foodsRes.data ?? []) as Food[]).map((f) => ({ ...f, bookmarked: set.has(f.id) }));
    return { foods, bookmarkedIds };
  });

export const getFood = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ context, data }): Promise<Food | null> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row } = await supabase.from("nutrition_foods").select("*").eq("slug", data.slug).maybeSingle();
    if (!row) return null;
    const { data: bm } = await supabase.from("user_food_bookmarks").select("id").eq("user_id", userId).eq("food_id", (row as Food).id).maybeSingle();
    return { ...(row as Food), bookmarked: !!bm };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ foodId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ bookmarked: boolean }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: existing } = await supabase
      .from("user_food_bookmarks").select("id").eq("user_id", userId).eq("food_id", data.foodId).maybeSingle();
    if (existing) {
      await supabase.from("user_food_bookmarks").delete().eq("id", (existing as { id: string }).id);
      return { bookmarked: false };
    }
    await supabase.from("user_food_bookmarks").insert({ user_id: userId, food_id: data.foodId });
    return { bookmarked: true };
  });

export const listLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Lesson[]> => {
    const { supabase } = context as { supabase: any };
    const { data } = await supabase.from("nutrition_lessons").select("*").order("sort_order", { ascending: true });
    return (data ?? []) as Lesson[];
  });

export const getLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ context, data }): Promise<Lesson | null> => {
    const { supabase } = context as { supabase: any };
    const { data: row } = await supabase.from("nutrition_lessons").select("*").eq("slug", data.slug).maybeSingle();
    return (row as Lesson) ?? null;
  });

export const getLessonOfTheDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Lesson | null> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase.from("nutrition_lessons").select("*").order("sort_order", { ascending: true });
    const arr = (data ?? []) as Lesson[];
    if (arr.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const seed = `${userId}-${today}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return arr[h % arr.length];
  });
