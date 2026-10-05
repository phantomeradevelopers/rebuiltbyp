import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { MindsetIntensity } from "./mindset-intensity";

export const getMindsetIntensity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ intensity: MindsetIntensity }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("user_profile")
      .select("mindset_intensity")
      .eq("user_id", userId)
      .maybeSingle();
    const v = (data as { mindset_intensity?: string } | null)?.mindset_intensity;
    const intensity: MindsetIntensity = v === "calm" || v === "fire" ? v : "balanced";
    return { intensity };
  });

export const setMindsetIntensity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ intensity: z.enum(["calm", "balanced", "fire"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; intensity: MindsetIntensity }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("user_profile")
      .update({ mindset_intensity: data.intensity, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, intensity: data.intensity };
  });
