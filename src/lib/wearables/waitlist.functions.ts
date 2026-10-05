import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWearablesWaitlistStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("wearables_waitlist")
      .select("email, provider, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { joined: !!data, email: data?.email ?? null, provider: data?.provider ?? null };
  });

export const joinWearablesWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email().max(255),
      provider: z.string().max(40).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("wearables_waitlist")
      .insert({
        user_id: userId,
        email: data.email.trim().toLowerCase(),
        provider: data.provider ?? null,
      });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error("Could not join the waitlist. Try again.");
    }
    return { ok: true as const };
  });
