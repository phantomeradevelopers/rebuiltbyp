import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CUISINE_OPTIONS = [
  "Mexican", "Italian", "Mediterranean", "Japanese", "Chinese",
  "Thai", "Indian", "Greek", "Middle Eastern", "BBQ / American",
] as const;

export const getMyCuisines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_profile")
      .select("taste_profile")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const tp = (data?.taste_profile ?? {}) as { cuisines?: string[] };
    return { cuisines: Array.isArray(tp.cuisines) ? tp.cuisines : [] };
  });

export const updateMyCuisines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      cuisines: z.array(z.string().min(1).max(40)).max(20),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("user_profile")
      .select("taste_profile")
      .eq("user_id", userId)
      .maybeSingle();
    const tp = ((existing?.taste_profile ?? {}) as Record<string, unknown>);
    const next = { ...tp, cuisines: data.cuisines };
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ taste_profile: next as never, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, cuisines: data.cuisines };
  });
