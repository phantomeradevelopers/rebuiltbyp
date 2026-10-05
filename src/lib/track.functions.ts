import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Track = "men" | "angels";

export const setTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = (input as { track?: string })?.track;
    if (v !== "men" && v !== "angels") throw new Error("Invalid track.");
    return { track: v as Track };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ track: data.track, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Could not save your track.");
    return { ok: true as const, track: data.track };
  });
