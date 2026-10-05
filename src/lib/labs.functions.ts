import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLabsWaitlistStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("labs_waitlist")
      .select("email, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { joined: !!data, email: data?.email ?? null };
  });

export const joinLabsWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email().max(255) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("labs_waitlist")
      .insert({ user_id: userId, email: data.email.trim().toLowerCase() });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error("Could not join the waitlist. Try again.");
    }
    return { ok: true as const };
  });
