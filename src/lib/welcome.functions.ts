import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WelcomeStatus = {
  hasIdentityContract: boolean;
  hasFirstReadiness: boolean;
  hasFirstCoachMessage: boolean;
};

export const getWelcomeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WelcomeStatus> => {
    const { supabase, userId } = context;
    const [c, r, m] = await Promise.all([
      supabase
        .from("identity_contracts")
        .select("id")
        .eq("user_id", userId)
        .eq("archived", false)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("readiness_checkins")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_coach_conversations")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      hasIdentityContract: Boolean(c.data?.id),
      hasFirstReadiness: Boolean(r.data?.id),
      hasFirstCoachMessage: Boolean(m.data?.id),
    };
  });
