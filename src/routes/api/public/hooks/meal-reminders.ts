import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";
import {
  analyzeMealHistory,
  generateReminderText,
  missedSlots7d,
  SUBSTITUTIONS,
  type EatingPattern,
  type FoodLogRow,
  type MealSlot,
} from "@/lib/meal-reminders.server";

// Runs hourly. For each enabled user whose typical eating time for some slot falls
// inside the current UTC hour, send an adaptive AI-written push reminder.
// Idempotent per (user, slot, day). Skips slots already logged today.

const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

function parseHM(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inQuietHours(nowMin: number, quiet: { start: string; end: string }) {
  const s = parseHM(quiet.start) ?? 22 * 60;
  const e = parseHM(quiet.end) ?? 6 * 60;
  if (s === e) return false;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e; // wraps midnight
}

export const Route = createFileRoute("/api/public/hooks/meal-reminders")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/meal-reminders", id: "hooks/meal-reminders", perMinute: 10, requireCron: true }, async () => {
        const now = new Date();
        const hourUtc = now.getUTCHours();
        const today = now.toISOString().slice(0, 10);

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("meal_reminder_profile")
          .select("user_id, eating_pattern, typical_times, quiet_hours, reminders_enabled")
          .eq("reminders_enabled", true);
        if (pErr) return Response.json({ ok: false, error: pErr.message }, { status: 500 });

        let scanned = 0, sent = 0, skipped = 0;

        for (const p of profiles ?? []) {
          scanned++;
          const userId = p.user_id as string;
          const pattern = (p.eating_pattern as EatingPattern) ?? "unknown";
          const typical = (p.typical_times as Record<MealSlot, string | null>) ?? {};
          const quiet = (p.quiet_hours as { start: string; end: string }) ?? { start: "22:00", end: "06:00" };

          // Check user opt-out at profile level too
          const { data: up } = await supabaseAdmin
            .from("user_profile")
            .select("first_name, meal_reminders_enabled")
            .eq("user_id", userId)
            .maybeSingle();
          if (up?.meal_reminders_enabled === false) { skipped++; continue; }
          if (inQuietHours(hourUtc * 60, quiet)) { skipped++; continue; }

          // Which slot is due this hour?
          const dueSlots: MealSlot[] = [];
          for (const s of ALL_SLOTS) {
            const min = parseHM(typical[s] ?? null);
            if (min === null) {
              // No learned time yet — fall back to defaults: 8/13/19
              const defaults: Record<MealSlot, number> = { breakfast: 8 * 60, lunch: 13 * 60, dinner: 19 * 60, snack: -1 };
              if (Math.floor(defaults[s] / 60) === hourUtc) dueSlots.push(s);
            } else if (Math.floor(min / 60) === hourUtc) {
              dueSlots.push(s);
            }
          }
          if (dueSlots.length === 0) continue;

          // Today's logged meals
          const { data: todayLogs } = await supabaseAdmin
            .from("food_log")
            .select("meal")
            .eq("user_id", userId)
            .eq("date", today);
          const loggedToday = new Set<string>((todayLogs ?? []).map((r) => r.meal as string));

          for (const slot of dueSlots) {
            if (loggedToday.has(slot)) { skipped++; continue; }
            const dedupeType = `meal_reminder_${slot}`;
            const { data: existing } = await supabaseAdmin
              .from("notification_queue")
              .select("id")
              .eq("user_id", userId)
              .eq("type", dedupeType)
              .gte("scheduled_for", `${today}T00:00:00Z`)
              .lte("scheduled_for", `${today}T23:59:59Z`)
              .limit(1)
              .maybeSingle();
            if (existing) { skipped++; continue; }

            const missedToday: MealSlot[] = ALL_SLOTS.filter(
              (s) => s !== slot && !loggedToday.has(s) && (parseHM(typical[s] ?? null) ?? -1) < hourUtc * 60,
            );

            // Pick substitution for chaotic eaters or 2+ missed
            let sub: typeof SUBSTITUTIONS[number] | null = null;
            if (pattern === "chaotic" || missedToday.length >= 2) {
              const idx = (today.charCodeAt(today.length - 1) + slot.length) % SUBSTITUTIONS.length;
              sub = SUBSTITUTIONS[idx];
            }

            // Try to fetch planned meal name from active nutrition plan
            let plannedName: string | null = null;
            try {
              const { data: plan } = await supabaseAdmin
                .from("user_plans")
                .select("plan_data")
                .eq("user_id", userId)
                .eq("plan_type", "nutrition")
                .eq("active", true)
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              const mp = (plan?.plan_data as { meal_plan?: { meals?: Array<{ slot?: string; name?: string }> } } | null)?.meal_plan;
              const match = mp?.meals?.find((m) => (m.slot ?? "").toLowerCase() === slot);
              if (match?.name) plannedName = match.name;
            } catch { /* noop */ }

            const typicalMin = parseHM(typical[slot] ?? null) ?? hourUtc * 60;
            const minutesLate = Math.max(0, hourUtc * 60 - typicalMin);

            const { title, body } = await generateReminderText({
              firstName: (up?.first_name as string | null) ?? null,
              pattern,
              slot,
              plannedMealName: plannedName,
              missedToday,
              minutesLate,
              substitution: sub,
            });

            const deepLink = missedToday.length >= 2 ? "/app?log=catchup" : "/app";

            const { error: insErr } = await supabaseAdmin.from("notification_queue").insert({
              user_id: userId,
              channel: "push",
              type: dedupeType,
              subject: title,
              body,
              scheduled_for: now.toISOString(),
              status: "sent",
              sent_at: now.toISOString(),
            });
            if (insErr) { skipped++; continue; }

            try {
              const r = await sendPushToUser(userId, { title, body, url: deepLink, tag: `meal-${slot}` });
              sent += r.sent;
            } catch (e) {
              console.warn("meal push fan-out failed", (e as Error).message);
            }
          }
        }

        // Refresh stale patterns opportunistically (10% of scans)
        if (scanned > 0 && Math.random() < 0.1) {
          try {
            const { data: stalest } = await supabaseAdmin
              .from("meal_reminder_profile")
              .select("user_id, last_analyzed_at")
              .order("last_analyzed_at", { ascending: true, nullsFirst: true })
              .limit(5);
            for (const row of stalest ?? []) {
              const userId = row.user_id as string;
              const fourteenAgo = new Date();
              fourteenAgo.setUTCDate(fourteenAgo.getUTCDate() - 14);
              const { data: logs } = await supabaseAdmin
                .from("food_log")
                .select("date, meal, logged_at")
                .eq("user_id", userId)
                .gte("date", fourteenAgo.toISOString().slice(0, 10));
              const rows = (logs ?? []) as FoodLogRow[];
              const analysis = analyzeMealHistory(rows);
              const missed = missedSlots7d(rows);
              await supabaseAdmin.from("meal_reminder_profile").upsert(
                {
                  user_id: userId,
                  eating_pattern: analysis.pattern,
                  typical_times: analysis.typical,
                  missed_slots_7d: missed,
                  last_analyzed_at: new Date().toISOString(),
                },
                { onConflict: "user_id" },
              );
            }
          } catch (e) {
            console.warn("opportunistic pattern refresh failed", (e as Error).message);
          }
        }

        return Response.json({ ok: true, scanned, sent, skipped });
      }),
    },
  },
});
