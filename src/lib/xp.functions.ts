import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type XpAward = {
  awarded: boolean;
  delta: number;
  balance: number;
  source_key: string;
};

export type XpLedgerRow = {
  id: string;
  action_type: string;
  delta: number;
  balance_after: number | null;
  day_local: string | null;
  source_key: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

async function computeBalance(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from("xp_ledger")
    .select("delta")
    .eq("user_id", userId);
  return (data ?? []).reduce((s: number, r: { delta: number }) => s + (r.delta ?? 0), 0);
}

/**
 * Idempotent XP award. UNIQUE (user_id, source_key) prevents double-counting
 * across retries, double-submits, refreshes, etc.
 */
export const awardXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      action_type: z.string().min(1).max(64),
      delta: z.number().int(),
      source_key: z.string().min(3).max(160),
      day_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<XpAward> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try insert; uniqueness on (user_id, source_key) makes it idempotent.
    const { data: inserted, error } = await supabaseAdmin
      .from("xp_ledger")
      .insert({
        user_id: userId,
        action_type: data.action_type,
        delta: data.delta,
        day_local: data.day_local ?? null,
        source_key: data.source_key,
        metadata: (data.metadata ?? {}) as any,
      })
      .select("id")
      .maybeSingle();

    const awarded = !!inserted && !error;
    const balance = await computeBalance(supabase, userId);

    if (awarded) {
      await supabaseAdmin.from("xp_ledger").update({ balance_after: balance }).eq("id", inserted.id);
    }

    return { awarded, delta: awarded ? data.delta : 0, balance, source_key: data.source_key };
  });

export const getXpBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ balance: number }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    return { balance: await computeBalance(supabase, userId) };
  });

export const getXpLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: XpLedgerRow[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rows } = await supabase
      .from("xp_ledger")
      .select("id, action_type, delta, balance_after, day_local, source_key, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    return { rows: (rows ?? []) as XpLedgerRow[] };
  });
