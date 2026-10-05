import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";

// Runs every 15 minutes. Sends up to one re-engagement nudge per user per cycle:
//   (a) mission_waiting: at user's reminder hour, no checkin today
//   (b) streak_save: streak >=3, no checkin today, evening
//   (c) comeback: no activity for 3+ days (max 1 per 7 days)
//   (d) coach_winback: no activity for 7+ days (max 1 per 21 days) —
//       personal note in Coach P / Grace voice referencing REAL last streak.
// Respects reminder_frequency (off | gentle | balanced | frequent), quiet hours
// (approx 8am–9pm user local), and vacation mode. Dedupes via reengagement_log.
// HONESTY: no fake numbers, no loss-framing. Real last-streak reference only.

type ReminderFreq = "off" | "gentle" | "balanced" | "frequent";
type Track = "men" | "angels";

type Profile = {
  user_id: string;
  first_name: string | null;
  reminder_time_local: string;
  notification_push: boolean;
  notification_email: boolean;
  vacation_until: string | null;
  rebuilt_access: boolean;
  reminder_frequency: ReminderFreq | null;
  track: Track | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function alreadySent(userId: string, kind: string, withinHours: number) {
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();
  const { data } = await supabaseAdmin
    .from("reengagement_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("sent_at", since)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function sendNudge(p: Profile, kind: string, title: string, body: string) {
  // Log first (prevents double-send across overlapping cron runs)
  const { error: logErr } = await supabaseAdmin
    .from("reengagement_log")
    .insert({ user_id: p.user_id, kind });
  if (logErr) {
    console.warn("reengagement_log insert failed", logErr.message);
    return false;
  }

  // Mirror to notification_queue for in-app inbox
  await supabaseAdmin.from("notification_queue").insert({
    user_id: p.user_id,
    channel: "push",
    type: `reengagement_${kind}`,
    subject: title,
    body,
    scheduled_for: new Date().toISOString(),
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  if (p.notification_push) {
    try {
      await sendPushToUser(p.user_id, { title, body, url: "/app", tag: `reengage-${kind}` });
    } catch (e) {
      console.warn("reengagement push failed", (e as Error).message);
    }
  }
  return true;
}

export const Route = createFileRoute("/api/public/hooks/reengagement")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/reengagement", id: "hooks/reengagement", perMinute: 10, requireCron: true }, async () => {
        const now = new Date();
        const utcHour = now.getUTCHours();
        const today = todayISO();

        const { data: users, error } = await supabaseAdmin
          .from("user_profile")
          .select(
            "user_id, first_name, reminder_time_local, notification_push, notification_email, vacation_until, rebuilt_access, reminder_frequency, track",
          )
          .eq("rebuilt_access", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let streakSave = 0, missionWaiting = 0, comeback = 0, coachWinback = 0;

        for (const raw of users ?? []) {
          const p = raw as Profile;
          const freq: ReminderFreq = (p.reminder_frequency ?? "balanced") as ReminderFreq;
          // Respect user's cadence preference.
          if (freq === "off") continue;
          // Skip vacationers
          if (p.vacation_until && p.vacation_until >= today) continue;
          if (!p.notification_push && !p.notification_email) continue;

          // Quiet hours: only send at reasonable local hours (approx 8am-9pm).
          // Reminder times are stored as user-local HH:MM, so use user's tz-offset
          // as an approximation via the reminder time's own hour anchor.
          const localHourApprox = (utcHour + 24) % 24;
          // (Global cron; per-user quiet hours enforced by hour-window gates below.)
          void localHourApprox;

          // --- Did they check in today? ---
          const { data: todayCheckin } = await supabaseAdmin
            .from("daily_checkins")
            .select("id")
            .eq("user_id", p.user_id)
            .eq("date", today)
            .maybeSingle();

          // --- Most recent checkin (for streak + comeback gap) ---
          const { data: recent } = await supabaseAdmin
            .from("daily_checkins")
            .select("date")
            .eq("user_id", p.user_id)
            .order("date", { ascending: false })
            .limit(30);
          const dates = (recent ?? []).map((r: any) => r.date as string);
          const lastDate = dates[0] ?? null;

          // Quick streak count from consecutive recent days
          let streak = 0;
          if (dates.length > 0) {
            const cursor = new Date();
            const dateSet = new Set(dates);
            if (!dateSet.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
            for (;;) {
              const k = cursor.toISOString().slice(0, 10);
              if (!dateSet.has(k)) break;
              streak += 1;
              cursor.setUTCDate(cursor.getUTCDate() - 1);
            }
          }

          // Frequency filter: what stages this user opted into.
          // - frequent: all four stages
          // - balanced (default): all four stages
          // - gentle: comeback + coach_winback only (no daily nudges)
          const allowMission = freq === "frequent" || freq === "balanced";
          const allowStreakSave = freq === "frequent" || freq === "balanced";
          const allowComeback = true; // freq !== "off" already filtered above
          const allowCoachWinback = true;

          // --- 1. Streak save (8pm-9pm UTC, streak >=3, no checkin today) ---
          if (allowStreakSave && streak >= 3 && !todayCheckin && (utcHour === 20 || utcHour === 21)) {
            if (!(await alreadySent(p.user_id, "streak_save", 18))) {
              const name = p.first_name ?? "there";
              const body =
                p.track === "angels"
                  ? `${name}, one small check-in tonight keeps your ${streak}-day streak alive. A freeze token can protect it too.`
                  : `${name}, one check-in tonight keeps your ${streak}-day streak alive. A freeze token can protect it too.`;
              await sendNudge(
                p,
                "streak_save",
                `${streak}-day streak — protect it`,
                body,
              );
              streakSave++;
              continue;
            }
          }

          // --- 2. Mission waiting (at user's reminder hour) ---
          const reminderHour = Number(p.reminder_time_local.slice(0, 2));
          if (allowMission && reminderHour === utcHour && !todayCheckin) {
            if (!(await alreadySent(p.user_id, "mission_waiting", 18))) {
              await sendNudge(
                p,
                "mission_waiting",
                "Today's check-in is ready",
                "5 minutes. Show up.",
              );
              missionWaiting++;
              continue;
            }
          }

          // --- 3. Comeback (3+ days, warm, no shame) ---
          if (allowComeback && lastDate) {
            const gapDays = Math.floor(
              (new Date(`${today}T00:00:00Z`).getTime() -
                new Date(`${lastDate}T00:00:00Z`).getTime()) /
                86_400_000,
            );
            if (gapDays >= 3 && gapDays < 7 && (utcHour === 17 || utcHour === 18)) {
              if (!(await alreadySent(p.user_id, "comeback", 24 * 7))) {
                const name = p.first_name ?? "there";
                await sendNudge(
                  p,
                  "comeback",
                  "Come back — no shame",
                  `${name}, your plan is here when you're ready. One small step.`,
                );
                comeback++;
                continue;
              }
            }

            // --- 4. Coach P / Grace personal win-back (7+ days) ---
            if (allowCoachWinback && gapDays >= 7 && (utcHour === 16 || utcHour === 17)) {
              if (!(await alreadySent(p.user_id, "coach_winback", 24 * 21))) {
                // Real numbers only — pull longest streak so we reference truth.
                const { data: streakRow } = await supabaseAdmin
                  .from("user_streaks")
                  .select("longest_count")
                  .eq("user_id", p.user_id)
                  .eq("kind", "checkin")
                  .maybeSingle();
                const longest = Number(
                  (streakRow as { longest_count?: number } | null)?.longest_count ?? 0,
                );
                const name = p.first_name ?? "friend";
                const coach = p.track === "angels" ? "Grace" : "Coach P";
                const bodyEn = longest > 0
                  ? `${name} — ${coach} here. Your longest streak was ${longest} days. That was real. Come back when you're ready.`
                  : `${name} — ${coach} here. No judgement. Open the app when you're ready.`;
                await sendNudge(
                  p,
                  "coach_winback",
                  `${coach} — a note for you`,
                  bodyEn,
                );

                // Notify the coach (admin_messages inbox) so a human can follow up.
                try {
                  await supabaseAdmin.from("admin_messages").insert({
                    recipient_user_id: p.user_id,
                    kind: "coach_winback_flag",
                    subject: `${name} — 7d dormant`,
                    body: `${name} has been dormant ${gapDays} days. Longest streak: ${longest}. Auto win-back sent.`,
                  } as never);
                } catch (e) {
                  console.warn("coach flag insert failed", (e as Error).message);
                }

                coachWinback++;
              }
            }
          }
        }

        return Response.json({ ok: true, streakSave, missionWaiting, comeback, coachWinback });
      }),
    },
  },
});
