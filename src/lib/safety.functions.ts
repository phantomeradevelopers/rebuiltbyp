import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  source: z.enum(["journal", "coach", "checkin"]),
  matched: z.array(z.string().min(1).max(80)).min(1).max(20),
  severity: z.enum(["low", "medium", "high"]),
  excerpt: z.string().max(1000).optional(),
});

export const logSafetyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("safety_events").insert({
      user_id: userId,
      source: data.source,
      matched_terms: data.matched,
      severity: data.severity,
      excerpt: data.excerpt ?? null,
    });
    if (error) throw new Error("Could not log safety event.");
    return { ok: true };
  });

export const listSafetyEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("safety_events")
      .select("id, source, severity, excerpt, matched_terms, created_at, acknowledged_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Array<{
      id: string; source: string; severity: string; excerpt: string | null;
      matched_terms: string[]; created_at: string; acknowledged_at: string | null;
    }>;
  });
