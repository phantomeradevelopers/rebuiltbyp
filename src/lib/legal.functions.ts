import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MEDICAL_DISCLAIMER_VERSION = "medical-v1";

export const getMyAcceptances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("legal_acceptances")
      .select("document, version, accepted_at")
      .eq("user_id", userId);
    return { acceptances: data ?? [] };
  });

export const acceptDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      document: z.string().min(1).max(64),
      version: z.string().min(1).max(32),
      user_agent: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("legal_acceptances").insert({
      user_id: userId,
      document: data.document,
      version: data.version,
      user_agent: data.user_agent ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });
