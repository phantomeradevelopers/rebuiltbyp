import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Witness loop — coach-facing visibility into who missed check-ins yesterday,
 * plus a one-tap "nudge" that sends the client a warm, pre-written message
 * from the coach. Encouraging tone, never shaming.
 */

async function assertCoach(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "coach"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Not authorized.");
}

export type MissedClient = {
  user_id: string;
  first_name: string | null;
  email: string | null;
  last_checkin_date: string | null;
  streak: number;
};

/** Users who checked in in the last 14 days but skipped yesterday. */
export const coachListMissed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ missed: MissedClient[]; date: string }> => {
    await assertCoach(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);

    // Pull recent check-ins in one shot, group in memory.
    const { data: rows, error } = await supabaseAdmin
      .from("daily_checkins")
      .select("user_id, date")
      .gte("date", fourteenAgo);
    if (error) throw new Error(error.message);

    const byUser = new Map<string, string[]>();
    for (const r of rows ?? []) {
      const arr = byUser.get(r.user_id as string) ?? [];
      arr.push(r.date as string);
      byUser.set(r.user_id as string, arr);
    }

    const missedIds: string[] = [];
    for (const [uid, dates] of byUser.entries()) {
      if (dates.includes(yesterday)) continue;
      missedIds.push(uid);
    }
    if (missedIds.length === 0) return { missed: [], date: yesterday };

    const { data: profiles } = await supabaseAdmin
      .from("user_profile")
      .select("user_id, first_name, email")
      .in("user_id", missedIds);

    const { data: streaks } = await supabaseAdmin
      .from("user_streaks")
      .select("user_id, current_count")
      .eq("kind", "checkin")
      .in("user_id", missedIds);
    const streakMap = new Map((streaks ?? []).map((s) => [s.user_id as string, s.current_count as number]));

    const missed: MissedClient[] = (profiles ?? []).map((p) => {
      const dates = (byUser.get(p.user_id as string) ?? []).slice().sort().reverse();
      return {
        user_id: p.user_id as string,
        first_name: (p.first_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        last_checkin_date: dates[0] ?? null,
        streak: streakMap.get(p.user_id as string) ?? 0,
      };
    });
    // Sort: longest streak first (biggest to lose)
    missed.sort((a, b) => b.streak - a.streak);
    return { missed, date: yesterday };
  });

const NUDGE_MESSAGES = [
  {
    subject: "Saw you yesterday, brother.",
    body: "No shame, no story — just noticing. Life gets loud. The check-in takes 90 seconds. I'm rooting for you. — Coach P",
  },
  {
    subject: "One small move today.",
    body: "You skipped yesterday. Not a big deal — it happens to all of us. Tap in when you can. Even a rough check-in beats a silent one. — Coach P",
  },
  {
    subject: "Still with you.",
    body: "Missed you yesterday. The streak isn't the point — the honesty is. Take 90 seconds when you're ready. — Coach P",
  },
];

export const coachNudgeClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rotate messages so a coach nudging 10 clients doesn't send identical copy.
    const pick = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];

    const { error } = await supabaseAdmin.from("admin_messages").insert({
      recipient_user_id: data.userId,
      sender_user_id: context.userId,
      kind: "check_in",
      subject: pick.subject,
      body: pick.body,
      cta_label: "Check in",
      cta_url: "/app/checkin",
    });
    if (error) throw new Error(error.message);

    // Best-effort push
    try {
      const { sendPushToUser } = await import("@/lib/push.server");
      await sendPushToUser(data.userId, {
        title: pick.subject,
        body: "Coach P sent you a message.",
        url: "/app/checkin",
        tag: "coach-nudge",
      });
    } catch (e) {
      console.warn("nudge push failed", (e as Error).message);
    }
    return { ok: true as const };
  });
