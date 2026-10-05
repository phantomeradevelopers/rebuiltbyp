import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";

// Sends a trial-ending reminder ~2 days before the user's Stripe trial ends.
// Idempotency: one row per (user_id, kind='trial_ending_2d') in reengagement_log.
// Cadence: pg_cron calls this hourly.
export const Route = createFileRoute("/api/public/hooks/trial-ending-reminder")({
  server: {
    handlers: {
      POST: wrapPublicHandler(
        { route: "hooks/trial-ending-reminder", id: "hooks/trial-ending-reminder", perMinute: 4 },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");

          // Window: trials ending between ~40h and ~52h from now (safe overlap for hourly cron).
          const now = Date.now();
          const windowStart = new Date(now + 40 * 3_600_000).toISOString();
          const windowEnd = new Date(now + 52 * 3_600_000).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profiles, error } = await (supabaseAdmin as any)
            .from("user_profile")
            .select("user_id, email, first_name, trial_ends_at, subscription_status, subscription_plan, notification_email")
            .eq("subscription_status", "trialing")
            .gte("trial_ends_at", windowStart)
            .lte("trial_ends_at", windowEnd);

          if (error) {
            console.error("[trial-ending-reminder] query error", error);
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
          }

          let sent = 0;
          let skipped = 0;

          for (const p of (profiles ?? []) as Array<{
            user_id: string; email: string | null; first_name: string | null;
            trial_ends_at: string | null; subscription_plan: string | null;
            notification_email: boolean | null;
          }>) {
            if (!p.email || p.notification_email === false) { skipped++; continue; }

            // Dedupe: one send per user per trial cycle.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: already } = await (supabaseAdmin as any)
              .from("reengagement_log")
              .select("id")
              .eq("user_id", p.user_id)
              .eq("kind", "trial_ending_2d")
              .gte("sent_at", new Date(now - 40 * 24 * 3_600_000).toISOString())
              .limit(1)
              .maybeSingle();
            if (already) { skipped++; continue; }

            const trialEnd = p.trial_ends_at ? new Date(p.trial_ends_at) : null;
            const trialEndDate = trialEnd
              ? trialEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "in 2 days";

            const priceLabel =
              p.subscription_plan === "pro_annual" ? "$129/yr" :
              p.subscription_plan === "elite_monthly" ? "$24.99/mo" :
              p.subscription_plan === "elite_annual" ? "$219/yr" :
              "$14.99/mo";

            const res = await enqueueRebuiltEmail({
              templateName: "trial-ending-soon",
              recipientEmail: p.email,
              templateData: {
                firstName: p.first_name ?? "brother",
                trialEndDate,
                priceLabel,
              },
              idempotencyKey: `trial-ending-2d:${p.user_id}:${p.trial_ends_at ?? ""}`,
            });

            if (res.ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabaseAdmin as any)
                .from("reengagement_log")
                .insert({ user_id: p.user_id, kind: "trial_ending_2d" });
              sent++;
            } else {
              skipped++;
            }
          }

          return new Response(JSON.stringify({ ok: true, sent, skipped, candidates: profiles?.length ?? 0 }), {
            headers: { "content-type": "application/json" },
          });
        },
      ),
    },
  },
});
