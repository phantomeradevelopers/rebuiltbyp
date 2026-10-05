import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";

// Runs every 5 minutes. For each user, fires a gentle "log today's check-in"
// push ~4 minutes after their morning motivation time — the third (and final)
// beat of the morning stack:
//
//   T+0  Daily Motivation       (daily-enqueue)
//   T+2  Medication reminder    (medication-reminders, if a morning dose)
//   T+4  Check-in nudge         (this hook)
//
// Only fires when:
//   - daily_motivation_enabled = true and rebuilt_access = true
//   - notification_push = true (push allowed at all)
//   - no daily_checkins row for TODAY yet
//   - user had a check-in YESTERDAY (active user) — lapsed users go to the
//     re-engagement track instead, so we don't pile shame on them here
//   - not in quiet hours
//   - hasn't already been nudged today (idempotency on notification_queue)

function parseHM(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function inQuietHours(nowMin: number, quiet: { start: string; end: string }) {
  const s = parseHM(quiet.start) ?? 22 * 60;
  const e = parseHM(quiet.end) ?? 6 * 60;
  if (s === e) return false;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}

export const Route = createFileRoute("/api/public/hooks/morning-checkin-nudge")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/morning-checkin-nudge", id: "hooks/morning-checkin-nudge", perMinute: 10, requireCron: true }, async () => {
        const now = new Date();
        const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
        const halfWindow = 2.5; // ±2.5 min, matches 5-min cron cadence
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

        // Candidate users: opted-in to morning push channel
        const { data: users, error: uErr } = await supabaseAdmin
          .from("user_profile")
          .select("user_id, first_name, reminder_time_local, notification_push")
          .eq("daily_motivation_enabled", true)
          .eq("rebuilt_access", true);
        if (uErr) return Response.json({ ok: false, error: uErr.message }, { status: 500 });

        let scanned = 0, sent = 0, skipped = 0;

        for (const u of users ?? []) {
          scanned++;
          if (u.notification_push === false) { skipped++; continue; }

          const morningMin = parseHM(u.reminder_time_local as string | null);
          if (morningMin === null) { skipped++; continue; }

          // Fire when `now` is in [morning+1.5, morning+6.5] — a 5-min window
          // centered on +4 min. The every-5-min cron lands inside this exactly
          // once per morning.
          const delta = nowMin - morningMin;
          if (delta < 1.5 || delta > 6.5) { skipped++; continue; }

          // Quiet hours
          const { data: mp } = await supabaseAdmin
            .from("meal_reminder_profile")
            .select("quiet_hours")
            .eq("user_id", u.user_id)
            .maybeSingle();
          const quiet = (mp?.quiet_hours as { start: string; end: string } | undefined)
            ?? { start: "22:00", end: "06:00" };
          if (inQuietHours(nowMin, quiet)) { skipped++; continue; }

          // Already checked in today? Skip.
          const { data: todayCheckin } = await supabaseAdmin
            .from("daily_checkins")
            .select("id")
            .eq("user_id", u.user_id)
            .eq("date", today)
            .maybeSingle();
          if (todayCheckin) { skipped++; continue; }

          // Active user only: had a check-in yesterday
          const { data: yCheckin } = await supabaseAdmin
            .from("daily_checkins")
            .select("id")
            .eq("user_id", u.user_id)
            .eq("date", yesterday)
            .maybeSingle();
          if (!yCheckin) { skipped++; continue; }

          // Idempotent per day
          const { data: existing } = await supabaseAdmin
            .from("notification_queue")
            .select("id")
            .eq("user_id", u.user_id)
            .eq("type", "morning_checkin_nudge")
            .gte("scheduled_for", `${today}T00:00:00Z`)
            .lte("scheduled_for", `${today}T23:59:59Z`)
            .limit(1)
            .maybeSingle();
          if (existing) { skipped++; continue; }

          const name = (u.first_name as string | null) ?? null;
          const subject = name ? `One minute, ${name}.` : "One minute.";
          const body = "Log today's check-in and lock the win.";

          await supabaseAdmin.from("notification_queue").insert({
            user_id: u.user_id,
            channel: "push",
            type: "morning_checkin_nudge",
            subject,
            body,
            scheduled_for: now.toISOString(),
            status: "sent",
            sent_at: now.toISOString(),
          });

          try {
            const r = await sendPushToUser(u.user_id, {
              title: subject,
              body,
              url: "/app",
              tag: "morning-checkin-nudge",
            });
            sent += r.sent;
          } catch (e) {
            console.warn("checkin nudge push failed", (e as Error).message);
          }
        }

        return Response.json({ ok: true, scanned, sent, skipped });
      }),
    },
  },
});
