import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";

/**
 * Daily coach digest — runs once per morning. Finds users who checked in
 * in the last 14 days but skipped yesterday, then drops one summary
 * admin_message into every coach/admin's inbox listing them by name, plus a
 * push notification. Coaches open /admin to see the list with one-tap nudge
 * buttons.
 */

export const Route = createFileRoute("/api/public/hooks/coach-digest")({
  server: {
    handlers: {
      POST: wrapPublicHandler(
        { route: "hooks/coach-digest", id: "hooks/coach-digest", perMinute: 5, requireCron: true },
        async () => {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
          const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
          const today = now.toISOString().slice(0, 10);

          // 1. Find candidate users (checked in at least once in the last 14 days)
          const { data: rows, error: cErr } = await supabaseAdmin
            .from("daily_checkins")
            .select("user_id, date")
            .gte("date", fourteenAgo);
          if (cErr) return Response.json({ ok: false, error: cErr.message }, { status: 500 });

          const byUser = new Map<string, Set<string>>();
          for (const r of rows ?? []) {
            const s = byUser.get(r.user_id as string) ?? new Set<string>();
            s.add(r.date as string);
            byUser.set(r.user_id as string, s);
          }
          const missedIds: string[] = [];
          for (const [uid, dates] of byUser.entries()) {
            if (!dates.has(yesterday)) missedIds.push(uid);
          }

          // 2. Get missed users' names + yesterday's outdoor session count
          let namedList = "";
          let missedCount = 0;
          if (missedIds.length > 0) {
            const { data: profiles } = await supabaseAdmin
              .from("user_profile")
              .select("first_name, email")
              .in("user_id", missedIds);
            missedCount = profiles?.length ?? 0;
            namedList = (profiles ?? [])
              .map((p) => (p.first_name as string | null) ?? (p.email as string | null) ?? "someone")
              .slice(0, 20)
              .join(", ");
            if (missedCount > 20) namedList += `, +${missedCount - 20} more`;
          }

          // Yesterday's step-outside completions across the whole cohort.
          const { data: walks } = await supabaseAdmin
            .from("outdoor_sessions")
            .select("user_id, distance_meters")
            .gte("ended_at", `${yesterday}T00:00:00Z`)
            .lte("ended_at", `${yesterday}T23:59:59Z`);
          const walkerCount = new Set((walks ?? []).filter((w) => (w.distance_meters as number) >= 200).map((w) => w.user_id as string)).size;

          // 3. Every coach + admin gets the digest
          const { data: coaches, error: rErr } = await supabaseAdmin
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["coach", "admin"]);
          if (rErr) return Response.json({ ok: false, error: rErr.message }, { status: 500 });

          const coachIds = Array.from(new Set((coaches ?? []).map((c) => c.user_id as string)));
          let delivered = 0, pushed = 0;

          for (const cid of coachIds) {
            // Idempotent per (coach, day) — one digest per day.
            const { data: existing } = await supabaseAdmin
              .from("admin_messages")
              .select("id")
              .eq("recipient_user_id", cid)
              .eq("kind", "check_in")
              .gte("created_at", `${today}T00:00:00Z`)
              .lte("created_at", `${today}T23:59:59Z`)
              .ilike("subject", "Witness digest%")
              .limit(1)
              .maybeSingle();
            if (existing) continue;

            const subject = missedCount === 0
              ? "Witness digest — clean sweep."
              : `Witness digest — ${missedCount} missed yesterday`;
            const walksLine = walkerCount > 0 ? `\n\n${walkerCount} client${walkerCount === 1 ? "" : "s"} stepped outside yesterday.` : "";
            const body = missedCount === 0
              ? `Every active client checked in yesterday. Rare and beautiful. Ride it.${walksLine}`
              : `${namedList}\n\nOpen /admin to send a warm nudge. Message stays supportive — never shaming.${walksLine}`;

            const { error: insErr } = await supabaseAdmin.from("admin_messages").insert({
              recipient_user_id: cid,
              sender_user_id: cid,
              kind: "check_in",
              subject,
              body,
              cta_label: missedCount === 0 ? null : "Open witness list",
              cta_url: missedCount === 0 ? null : "/admin",
            });
            if (insErr) { console.warn("digest insert", insErr.message); continue; }
            delivered++;

            try {
              const r = await sendPushToUser(cid, {
                title: subject,
                body: missedCount === 0 ? "Clean sweep — nice." : "Tap to see who could use a nudge.",
                url: "/admin",
                tag: "coach-digest",
              });
              pushed += r.sent;
            } catch (e) {
              console.warn("digest push failed", (e as Error).message);
            }
          }

          return Response.json({ ok: true, missedCount, coachesNotified: delivered, pushed });
        },
      ),
    },
  },
});
