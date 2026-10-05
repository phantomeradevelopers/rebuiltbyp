import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IDENTITY_MILESTONES, addMonthsISO } from "./identity.server";

export const getActiveContract = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: contract }, { data: profile }] = await Promise.all([
      supabase
        .from("identity_contracts")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("gender" as any)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      contract,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gender: ((profile as any)?.gender as string | null) ?? null,
    };
  });

export const signContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      statement: z.string().min(8).max(800),
      signature_data_url: z.string().max(200_000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("identity_contracts")
      .update({ archived: true })
      .eq("user_id", userId)
      .eq("archived", false);

    const { data: inserted, error } = await supabase
      .from("identity_contracts")
      .insert({
        user_id: userId,
        statement: data.statement,
        signature_data_url: data.signature_data_url ?? null,
      })
      .select("id, signed_at")
      .single();
    if (error) {
      console.error("identity_contracts insert failed", error);
      throw new Error("Couldn't sign the contract. Try again.");
    }

    // Schedule 3/6/9/12-month Mirror check-ins
    const signedAt = (inserted?.signed_at as string) ?? new Date().toISOString();
    const rows = IDENTITY_MILESTONES.map((m) => ({
      user_id: userId,
      contract_id: inserted!.id,
      milestone_month: m,
      due_date: addMonthsISO(signedAt, m),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("identity_checkins" as any) as any).insert(rows);

    return { ok: true, contract_id: inserted!.id, signed_at: signedAt };
  });

export type DueMirror = {
  id: string;
  milestone_month: 3 | 6 | 9 | 12;
  due_date: string;
  contract_id: string;
  contract_statement: string;
  signed_at: string;
};

/** Returns the next un-completed Mirror that is due (or overdue). */
export const getDueMirror = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DueMirror | null> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("identity_checkins" as any) as any)
      .select("id, milestone_month, due_date, contract_id")
      .eq("user_id", userId)
      .is("completed_at", null)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return null;

    const { data: contract } = await supabase
      .from("identity_contracts")
      .select("statement, signed_at")
      .eq("id", data.contract_id)
      .maybeSingle();
    if (!contract) return null;

    return {
      id: data.id,
      milestone_month: data.milestone_month,
      due_date: data.due_date,
      contract_id: data.contract_id,
      contract_statement: contract.statement,
      signed_at: contract.signed_at,
    };
  });

export const getMirror = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkin } = await (supabase.from("identity_checkins" as any) as any)
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!checkin) throw new Error("Check-in not found");
    const { data: contract } = await supabase
      .from("identity_contracts")
      .select("statement, signature_data_url, signed_at")
      .eq("id", checkin.contract_id)
      .maybeSingle();
    return { checkin, contract };
  });

export const saveMirror = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      still_him: z.enum(["yes", "getting_there", "no"]),
      evidence: z.string().max(800).optional().nullable(),
      recommit: z.string().max(800).optional().nullable(),
      score: z.number().int().min(1).max(10),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("identity_checkins" as any) as any)
      .update({
        still_him: data.still_him,
        evidence: data.evidence ?? null,
        recommit: data.recommit ?? null,
        score: data.score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const listMirrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("identity_checkins" as any) as any)
      .select("id, milestone_month, due_date, completed_at, still_him, score")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });
    return { mirrors: data ?? [] };
  });
