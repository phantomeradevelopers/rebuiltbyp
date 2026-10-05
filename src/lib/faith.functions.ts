import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRADITION_VALUES } from "./spirit.functions";

export type FaithSettings = {
  faith_mode_enabled: boolean;
  tradition: string;
  tribe_label: string | null;
};

export const getFaithSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FaithSettings> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_profile")
      .select("faith_mode_enabled, tradition, tribe_label")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      faith_mode_enabled: Boolean(data?.faith_mode_enabled ?? false),
      tradition: (data?.tradition as string) ?? "secular",
      tribe_label: ((data as { tribe_label?: string | null } | null)?.tribe_label ?? null),
    };
  });

export const setFaithSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      faith_mode_enabled: z.boolean().optional(),
      tradition: z.enum(TRADITION_VALUES).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { faith_mode_enabled?: boolean; tradition?: string } = {};
    if (typeof data.faith_mode_enabled === "boolean") patch.faith_mode_enabled = data.faith_mode_enabled;
    if (data.tradition) patch.tradition = data.tradition;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabase.from("user_profile").update(patch).eq("user_id", userId);
    if (error) throw new Error("Could not update faith settings.");
    return { ok: true as const };
  });

export const setTribeLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      tribe_label: z.string().trim().max(80).nullable(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const value = data.tribe_label && data.tribe_label.length > 0 ? data.tribe_label : null;
    const { error } = await supabase
      .from("user_profile")
      .update({ tribe_label: value } as never)
      .eq("user_id", userId);
    if (error) throw new Error("Could not save tribe.");
    return { ok: true as const };
  });
