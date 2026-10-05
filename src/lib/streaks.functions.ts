import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StreakKind = "checkin" | "journal" | "anchor" | "workout" | "mindset" | "meal";
export type Streak = {
  kind: StreakKind;
  current_count: number;
  longest_count: number;
  last_date: string | null;
  grace_until: string | null;
  saver_balance: number;
};

const KINDS: StreakKind[] = ["checkin", "journal", "anchor", "workout", "mindset", "meal"];

const KindEnum = z.enum(["checkin", "journal", "anchor", "workout", "mindset", "meal"]);
const DayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function serverDayLocal(tz: string): string {
  // Returns YYYY-MM-DD in the given IANA timezone using Intl.
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    return fmt.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

async function loadProfileTz(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_profile")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.timezone as string | undefined) ?? "UTC";
}

export const getMyStreaks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Streak[]> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const [streaksRes, saversRes] = await Promise.all([
      supabase.from("user_streaks")
        .select("kind, current_count, longest_count, last_date, grace_until")
        .eq("user_id", userId),
      supabase.from("streak_savers").select("kind, balance").eq("user_id", userId),
    ]);
    const sMap = new Map<string, any>((streaksRes.data ?? []).map((r: any) => [r.kind, r]));
    const wMap = new Map<string, number>((saversRes.data ?? []).map((r: any) => [r.kind, r.balance ?? 0]));
    return KINDS.map((k) => {
      const r = sMap.get(k);
      return {
        kind: k,
        current_count: r?.current_count ?? 0,
        longest_count: r?.longest_count ?? 0,
        last_date: r?.last_date ?? null,
        grace_until: r?.grace_until ?? null,
        saver_balance: wMap.get(k) ?? 0,
      } satisfies Streak;
    });
  });

export type TickResult = {
  streak: Streak;
  milestone: number | null;
  reason: "tick" | "grace_held" | "reset_comeback" | "reset_break" | "noop" | "noop_same_day";
};

/**
 * Idempotent, timezone-safe streak tick.
 * - source_key = "<kind>:<client_day>" by default; DB-enforced UNIQUE blocks double-counts.
 * - client_day is in the user's local timezone; server clamps to ±1 of its own computation.
 */
export const tickStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      kind: KindEnum,
      client_day: DayStr.optional(),
      source_key: z.string().min(3).max(160).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<TickResult> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const tz = await loadProfileTz(supabase, userId);
    const serverDay = serverDayLocal(tz);

    // Clamp client day to ±1 of server-computed local day (defends against clock spoofing).
    let day = data.client_day ?? serverDay;
    if (data.client_day) {
      const drift = Math.abs(daysBetween(serverDay, data.client_day));
      if (drift > 1) day = serverDay;
    }
    const source = data.source_key ?? `${data.kind}:${day}`;

    const { data: rpc, error } = await supabase.rpc("fn_tick_streak", {
      p_kind: data.kind,
      p_day_local: day,
      p_grace_days: 1,
      p_source: source,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    const reason = (row?.reason ?? "noop") as TickResult["reason"];
    const current = Number(row?.current_count ?? 0);
    const longest = Number(row?.longest_count ?? 0);

    // Award saver +1 at milestones (idempotent via source_key in xp_ledger).
    const milestones = [7, 30, 100];
    let milestone: number | null = null;
    if (reason === "tick" || reason === "grace_held") {
      const hit = milestones.find((m) => m === current);
      if (hit) {
        milestone = hit;
        const grantKey = `saver_grant:${data.kind}:${hit}:${day}`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Idempotent grant: try inserting an xp_ledger marker first.
        const { data: ins } = await supabaseAdmin
          .from("xp_ledger")
          .insert({
            user_id: userId,
            action_type: "streak_saver_grant",
            delta: 0,
            day_local: day,
            source_key: grantKey,
            metadata: { kind: data.kind, milestone: hit } as any,
          })
          .select("id")
          .maybeSingle();
        if (ins) {
          // First time we hit this milestone → bump saver wallet (service-role write).
          const { data: w } = await supabase
            .from("streak_savers")
            .select("balance, earned_total")
            .eq("user_id", userId).eq("kind", data.kind).maybeSingle();
          await supabaseAdmin.from("streak_savers").upsert({
            user_id: userId,
            kind: data.kind,
            balance: (w?.balance ?? 0) + 1,
            earned_total: (w?.earned_total ?? 0) + 1,
            used_total: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,kind" });
        }
      }
    }

    return {
      streak: {
        kind: data.kind,
        current_count: current,
        longest_count: longest,
        last_date: row?.last_date ?? day,
        grace_until: row?.grace_until ?? null,
        saver_balance: 0, // caller can refetch getMyStreaks if needed
      },
      milestone,
      reason,
    };
  });

export const redeemStreakSaver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: KindEnum, source_key: z.string().min(3).max(160).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string; saver_balance: number }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const tz = await loadProfileTz(supabase, userId);
    const today = serverDayLocal(tz);

    const [{ data: wallet }, { data: streak }] = await Promise.all([
      supabase.from("streak_savers").select("*").eq("user_id", userId).eq("kind", data.kind).maybeSingle(),
      supabase.from("user_streaks").select("*").eq("user_id", userId).eq("kind", data.kind).maybeSingle(),
    ]);

    if (!wallet || (wallet.balance ?? 0) <= 0) {
      return { ok: false, reason: "no_savers", saver_balance: wallet?.balance ?? 0 };
    }
    if (!streak || !streak.last_date) {
      return { ok: false, reason: "no_streak", saver_balance: wallet.balance };
    }
    const gap = daysBetween(streak.last_date, today);
    if (gap < 1 || gap > 2) {
      return { ok: false, reason: "out_of_window", saver_balance: wallet.balance };
    }

    const source = data.source_key ?? `saver_used:${data.kind}:${today}`;
    // Idempotency: if event with this source_key exists, no-op.
    const { data: existing } = await supabase
      .from("streak_events").select("id").eq("user_id", userId).eq("source_key", source).maybeSingle();
    if (existing) {
      return { ok: true, reason: "already_redeemed", saver_balance: wallet.balance };
    }

    const restoredCount = streak.current_count + 1; // continue the streak
    const longest = Math.max(streak.longest_count ?? 0, restoredCount);
    const graceUntil = today; // already redeemed for today
    const { supabaseAdmin: admin2 } = await import("@/integrations/supabase/client.server");
    await admin2.from("user_streaks").upsert({
      user_id: userId, kind: data.kind,
      current_count: restoredCount,
      longest_count: longest,
      last_date: today,
      grace_until: graceUntil,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,kind" });

    await admin2.from("streak_savers").update({
      balance: wallet.balance - 1,
      used_total: (wallet.used_total ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("kind", data.kind);

    await admin2.from("streak_events").insert({
      user_id: userId, kind: data.kind,
      from_count: streak.current_count, to_count: restoredCount,
      reason: "saver_used", day_local: today, source_key: source,
      metadata: { restored_from_gap: gap } as any,
    });

    return { ok: true, reason: "redeemed", saver_balance: wallet.balance - 1 };
  });

export const setMyTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ timezone: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    // Validate IANA tz by trying it
    try { new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone }).format(new Date()); }
    catch { throw new Error("Invalid timezone"); }
    await supabase.from("user_profile").update({ timezone: data.timezone }).eq("user_id", userId);
    return { ok: true };
  });
