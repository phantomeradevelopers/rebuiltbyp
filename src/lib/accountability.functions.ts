import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PartnerStatus = {
  paired: boolean;
  pending_incoming: { pair_id: string; from_name: string | null; from_code: string | null } | null;
  pending_outgoing: { pair_id: string; to_name: string | null } | null;
  partner:
    | {
        pair_id: string;
        partner_user_id: string;
        partner_name: string | null;
        activated_at: string | null;
        partner_checked_in_today: boolean;
        partner_streak: number;
        my_checked_in_today: boolean;
        my_streak: number;
        last_nudge_at: string | null;
        last_nudge_by: string | null;
      }
    | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function partnerCheckin(supabase: any, uid: string) {
  const iso = todayISO();
  const [{ data: c }, { data: s }] = await Promise.all([
    supabase.from("daily_checkins").select("id").eq("user_id", uid).eq("date", iso).maybeSingle(),
    supabase.from("user_streaks").select("current_count").eq("user_id", uid).eq("kind", "checkin").maybeSingle(),
  ]);
  return {
    checked: !!c,
    streak: Number((s as { current_count?: number } | null)?.current_count ?? 0),
  };
}

export const getPartnerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerStatus> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: active } = await supabase
      .from("accountability_pairs")
      .select("id, user_a, user_b, activated_at, last_nudge_at, last_nudge_by")
      .eq("status", "active")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: pendingRows } = await supabase
      .from("accountability_pairs")
      .select("id, user_a, user_b, initiated_by, created_at")
      .eq("status", "pending")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("created_at", { ascending: false });

    let pending_incoming: PartnerStatus["pending_incoming"] = null;
    let pending_outgoing: PartnerStatus["pending_outgoing"] = null;
    for (const row of pendingRows ?? []) {
      const r = row as { id: string; user_a: string; user_b: string; initiated_by: string };
      const otherId = r.user_a === userId ? r.user_b : r.user_a;
      const { data: other } = await supabaseAdmin
        .from("user_profile")
        .select("first_name, referral_code")
        .eq("user_id", otherId)
        .maybeSingle();
      if (r.initiated_by === userId) {
        if (!pending_outgoing) pending_outgoing = { pair_id: r.id, to_name: (other?.first_name as string | null) ?? null };
      } else {
        if (!pending_incoming) pending_incoming = {
          pair_id: r.id,
          from_name: (other?.first_name as string | null) ?? null,
          from_code: (other?.referral_code as string | null) ?? null,
        };
      }
    }

    if (!active) {
      return { paired: false, pending_incoming, pending_outgoing, partner: null };
    }

    const a = active as {
      id: string; user_a: string; user_b: string;
      activated_at: string | null; last_nudge_at: string | null; last_nudge_by: string | null;
    };
    const partnerId = a.user_a === userId ? a.user_b : a.user_a;

    const { data: p } = await supabaseAdmin
      .from("user_profile")
      .select("first_name")
      .eq("user_id", partnerId)
      .maybeSingle();

    const [meCk, themCk] = await Promise.all([
      partnerCheckin(supabaseAdmin, userId),
      partnerCheckin(supabaseAdmin, partnerId),
    ]);

    return {
      paired: true,
      pending_incoming: null,
      pending_outgoing: null,
      partner: {
        pair_id: a.id,
        partner_user_id: partnerId,
        partner_name: (p?.first_name as string | null) ?? null,
        activated_at: a.activated_at,
        partner_checked_in_today: themCk.checked,
        partner_streak: themCk.streak,
        my_checked_in_today: meCk.checked,
        my_streak: meCk.streak,
        last_nudge_at: a.last_nudge_at,
        last_nudge_by: a.last_nudge_by,
      },
    };
  });

export const invitePartnerByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(16) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const code = data.code.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: other } = await supabaseAdmin
      .from("user_profile")
      .select("user_id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!other || (other as { user_id: string }).user_id === userId) {
      return { ok: true, sent: false, reason: "not_found" as const };
    }
    const otherId = (other as { user_id: string }).user_id;

    const [a, b] = userId < otherId ? [userId, otherId] : [otherId, userId];
    const { data: existing } = await supabase
      .from("accountability_pairs")
      .select("id, status")
      .eq("user_a", a).eq("user_b", b)
      .in("status", ["pending", "active"])
      .maybeSingle();
    if (existing) return { ok: true, sent: false, reason: "exists" as const };

    const { error } = await supabase.from("accountability_pairs").insert({
      user_a: a, user_b: b, initiated_by: userId, status: "pending",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, sent: true as const };
  });

export const acceptPartnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pair_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("accountability_pairs")
      .update({ status: "active", activated_at: new Date().toISOString() } as any)
      .eq("id", data.pair_id)
      .eq("status", "pending")
      .neq("initiated_by", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpairPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pair_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase
      .from("accountability_pairs")
      .update({ status: "unpaired", unpaired_at: new Date().toISOString() } as any)
      .eq("id", data.pair_id)
      .in("status", ["pending", "active"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const nudgePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pair_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pair } = await supabase
      .from("accountability_pairs")
      .select("id, user_a, user_b, status, last_nudge_at, last_nudge_by")
      .eq("id", data.pair_id)
      .maybeSingle();
    if (!pair || (pair as any).status !== "active") throw new Error("Pair not active.");
    const p = pair as { user_a: string; user_b: string; last_nudge_at: string | null; last_nudge_by: string | null };
    if (p.user_a !== userId && p.user_b !== userId) throw new Error("Not your pair.");
    const partnerId = p.user_a === userId ? p.user_b : p.user_a;

    if (p.last_nudge_at && Date.now() - new Date(p.last_nudge_at).getTime() < 6 * 3600 * 1000) {
      return { ok: false, reason: "rate_limited" as const };
    }

    await supabase
      .from("accountability_pairs")
      .update({ last_nudge_at: new Date().toISOString(), last_nudge_by: userId } as any)
      .eq("id", data.pair_id);

    const { data: sender } = await supabaseAdmin
      .from("user_profile")
      .select("first_name, track")
      .eq("user_id", userId)
      .maybeSingle();
    const senderName = (sender?.first_name as string | null) ?? "Your partner";
    const track = (sender?.track as string | null) ?? "men";
    const coachTag = track === "angels" ? "Grace" : "Coach P";

    await supabaseAdmin.from("admin_messages").insert({
      recipient_user_id: partnerId,
      sender_user_id: userId,
      kind: "custom",
      subject: `${senderName} says: your turn.`,
      body: `${senderName} checked in on you. One small step — you know the drill. — ${coachTag}`,
      cta_label: "Open today",
      cta_url: "/app",
    } as never);

    try {
      const { sendPushToUser } = await import("@/lib/push.server");
      await sendPushToUser(partnerId, {
        title: `${senderName} says: your turn.`,
        body: "One small step. You know the drill.",
        url: "/app",
        tag: `partner-nudge-${data.pair_id}`,
      });
    } catch { /* non-fatal */ }

    return { ok: true, reason: "sent" as const };
  });
