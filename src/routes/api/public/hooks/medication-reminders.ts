import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";

// Runs every 5 minutes. For each active medication, finds scheduled doses
// whose effective fire time falls in the current ±2.5-min window (UTC),
// inserts an idempotency row, and sends a push.
//
// Morning-stack coordination: if a dose's clock time is within ±5 min of the
// user's morning motivation time (`reminder_time_local`), we shift its
// effective fire time by **+2 minutes** so the medication push lands AFTER
// the motivation push instead of stacking on top of it. The cron's 5-min
// cadence catches the shifted window cleanly.
//
// Skips: as_needed meds, users with notify_medications=false, doses inside
// quiet hours.

type ScheduleType = "daily" | "weekly_days" | "every_n_days" | "cycle" | "as_needed";
type ScheduleConfig = {
  days_of_week?: number[];
  times?: string[];
  every_n_days?: number;
  cycle_on?: number;
  cycle_off?: number;
};

type Med = {
  id: string;
  user_id: string;
  display_name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig | null;
  start_date: string;
  end_date: string | null;
};

function parseHM(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function inQuietHours(nowMin: number, quiet: { start: string; end: string }) {
  const s = parseHM(quiet.start) ?? 22 * 60;
  const e = parseHM(quiet.end) ?? 6 * 60;
  if (s === e) return false;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}

function isDoseDay(med: Med, today: Date): boolean {
  const cfg = med.schedule_config ?? {};
  const start = new Date(med.start_date + "T00:00:00Z");
  const end = med.end_date ? new Date(med.end_date + "T23:59:59Z") : null;
  if (today < start) return false;
  if (end && today > end) return false;

  switch (med.schedule_type) {
    case "daily":
      return true;
    case "weekly_days":
      return (cfg.days_of_week ?? []).includes(today.getUTCDay());
    case "every_n_days": {
      const n = cfg.every_n_days ?? 1;
      const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
      return diff >= 0 && diff % n === 0;
    }
    case "cycle": {
      const on = cfg.cycle_on ?? 5;
      const off = cfg.cycle_off ?? 2;
      const period = on + off;
      const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
      return diff >= 0 && diff % period < on;
    }
    case "as_needed":
      return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/medication-reminders")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/medication-reminders", id: "hooks/medication-reminders", perMinute: 10, requireCron: true }, async () => {
        const now = new Date();
        const halfWindowMs = 2.5 * 60 * 1000; // ±2.5 min, matches 5-min cron cadence
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

        // Pull active, non-as_needed meds for users who allow medication pushes
        const { data: meds, error: medsErr } = await supabaseAdmin
          .from("user_medications")
          .select("id, user_id, display_name, dose_amount, dose_unit, schedule_type, schedule_config, start_date, end_date")
          .eq("active", true)
          .neq("schedule_type", "as_needed");
        if (medsErr) return Response.json({ ok: false, error: medsErr.message }, { status: 500 });

        let scanned = 0, sent = 0, skipped = 0;

        // Cache per-user opts so we don't refetch
        const optCache = new Map<string, {
          notify: boolean;
          quiet: { start: string; end: string };
          morningMin: number | null;
        }>();

        for (const raw of (meds ?? []) as unknown as Med[]) {
          scanned++;

          if (!isDoseDay(raw, today)) continue;
          const times = raw.schedule_config?.times?.length ? raw.schedule_config.times : ["09:00"];

          // Per-user opt-in + quiet hours + morning slot (for stagger offset)
          let opts = optCache.get(raw.user_id);
          if (!opts) {
            const [{ data: up }, { data: mp }] = await Promise.all([
              supabaseAdmin
                .from("user_profile")
                .select("notify_medications, notification_push, reminder_time_local")
                .eq("user_id", raw.user_id)
                .maybeSingle(),
              supabaseAdmin
                .from("meal_reminder_profile")
                .select("quiet_hours")
                .eq("user_id", raw.user_id)
                .maybeSingle(),
            ]);
            opts = {
              notify: (up?.notify_medications ?? true) && (up?.notification_push ?? true),
              quiet: (mp?.quiet_hours as { start: string; end: string } | undefined) ?? { start: "22:00", end: "06:00" },
              morningMin: parseHM((up?.reminder_time_local as string | null) ?? null),
            };
            optCache.set(raw.user_id, opts);
          }
          if (!opts.notify) { skipped++; continue; }
          if (inQuietHours(nowMin, opts.quiet)) { skipped++; continue; }

          // For each scheduled dose time, compute its effective fire time
          // (with +2 min offset when it collides with morning motivation),
          // then check if `now` is inside the ±2.5-min window.
          const dueIso: string[] = [];
          for (const t of times) {
            const m = parseHM(t);
            if (m === null) continue;
            // Detect morning-stack collision: dose within ±5 min of motivation time
            const collidesMorning =
              opts.morningMin !== null && Math.abs(m - opts.morningMin) <= 5;
            const effectiveMin = collidesMorning ? m + 2 : m;
            const dt = new Date(today);
            dt.setUTCHours(Math.floor(effectiveMin / 60), effectiveMin % 60, 0, 0);
            if (Math.abs(dt.getTime() - now.getTime()) <= halfWindowMs) {
              // Use the ORIGINAL scheduled time as the idempotency key so a
              // dose only ever fires once per day regardless of offset logic.
              const original = new Date(today);
              original.setUTCHours(Math.floor(m / 60), m % 60, 0, 0);
              dueIso.push(original.toISOString());
            }
          }
          if (dueIso.length === 0) continue;

          for (const scheduledAt of dueIso) {
            // Idempotency: insert dedup row; on conflict, skip
            const { error: insErr } = await supabaseAdmin
              .from("medication_dose_notifications")
              .insert({
                user_id: raw.user_id,
                medication_id: raw.id,
                scheduled_at: scheduledAt,
              });
            if (insErr) {
              // 23505 = unique violation -> already sent
              skipped++;
              continue;
            }

            const dose = raw.dose_amount != null
              ? `${raw.dose_amount}${raw.dose_unit ?? ""}`
              : "";
            const title = "Medication due";
            const body = dose
              ? `Time for ${raw.display_name} — ${dose}. Tap to log.`
              : `Time for ${raw.display_name}. Tap to log.`;

            // Inbox row for history
            await supabaseAdmin.from("notification_queue").insert({
              user_id: raw.user_id,
              channel: "push",
              type: "medication_dose",
              subject: title,
              body,
              scheduled_for: scheduledAt,
              status: "sent",
              sent_at: new Date().toISOString(),
            });

            try {
              const r = await sendPushToUser(raw.user_id, {
                title,
                body,
                url: "/app/checkin",
                tag: `med-${raw.id}-${scheduledAt}`,
              });
              sent += r.sent;
            } catch (e) {
              console.warn("med push fan-out failed", (e as Error).message);
            }
          }
        }

        return Response.json({ ok: true, scanned, sent, skipped });
      }),
    },
  },
});
