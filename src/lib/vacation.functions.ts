import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VacationStatus = {
  active: boolean;
  vacationUntil: string | null; // YYYY-MM-DD
  startedAt: string | null;
  reasons: string[];
  note: string | null;
};

const ALLOWED_REASONS = [
  "traveling",
  "sick",
  "busy",
  "mental_health",
  "cant_eat",
  "cant_train",
  "other",
] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const getVacationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VacationStatus> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase
      .from("user_profile")
      .select("vacation_until, vacation_started_at, vacation_reason, vacation_note")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const today = todayISO();
    const until: string | null = data?.vacation_until ?? null;
    return {
      active: !!until && until >= today,
      vacationUntil: until,
      startedAt: data?.vacation_started_at ?? null,
      reasons: (data?.vacation_reason ?? []) as string[],
      note: data?.vacation_note ?? null,
    };
  });

export const setVacationMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // Either days (1-180) OR an explicit until date. 0 days = turn off.
        days: z.number().int().min(0).max(180).optional(),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        reasons: z.array(z.enum(ALLOWED_REASONS)).max(7).optional(),
        note: z.string().max(240).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VacationStatus> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    let vacation_until: string | null = null;
    let vacation_started_at: string | null = null;
    let reasons: string[] = [];
    let note: string | null = null;

    const turnOff = data.days === 0 && !data.until;
    if (!turnOff) {
      if (data.until) {
        vacation_until = data.until;
      } else if (data.days && data.days > 0) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + data.days);
        vacation_until = d.toISOString().slice(0, 10);
      }
      if (vacation_until && vacation_until >= todayISO()) {
        vacation_started_at = new Date().toISOString();
        reasons = data.reasons ?? [];
        note = data.note ?? null;
      } else {
        vacation_until = null;
      }
    }

    const { error } = await supabase
      .from("user_profile")
      .update({
        vacation_until,
        vacation_started_at,
        vacation_reason: reasons,
        vacation_note: note,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    // Unlock the "vacation_planner" trophy on first activation.
    if (vacation_until) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("user_achievements")
        .insert({
          user_id: userId,
          achievement_key: "vacation_planner",
          progress: { at: new Date().toISOString() } as any,
        })
        .then(() => {}, () => {}); // ignore unique-conflict
    }

    return {
      active: !!vacation_until,
      vacationUntil: vacation_until,
      startedAt: vacation_started_at,
      reasons,
      note,
    };
  });
