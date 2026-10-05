import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";

/**
 * Pre-renewal reminder (California ARL friendly).
 *
 * Sends one notice ~3 days before every recurring charge — trial-to-paid and
 * every renewal after that. Source of truth is Stripe, not our database, so a
 * charge date can never drift from what the customer is told.
 *
 * Idempotency: one reengagement_log row per (user, renewal timestamp).
 * Cadence: pg_cron calls this daily.
 */
export const Route = createFileRoute("/api/public/hooks/renewal-reminder")({
  server: {
    handlers: {
      POST: wrapPublicHandler(
        { route: "hooks/renewal-reminder", id: "hooks/renewal-reminder", perMinute: 4 },
        async () => {
          const { stripeSecretKey } = await import("@/lib/stripe-server");
          const secret = stripeSecretKey();
          if (!secret) {
            return new Response(JSON.stringify({ ok: false, error: "Stripe not configured" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }

          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(secret);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");
          const { CATALOG } = await import("@/lib/stripe-catalog");

          const now = Date.now();
          const windowStart = Math.floor((now + 2.5 * 86_400_000) / 1000);
          const windowEnd = Math.floor((now + 3.5 * 86_400_000) / 1000);

          let sent = 0;
          let skipped = 0;
          let candidates = 0;

          for await (const sub of stripe.subscriptions.list({
            status: "active",
            limit: 100,
            expand: ["data.items.data.price"],
          })) {
            const item = sub.items.data[0];
            const periodEnd = (item as unknown as { current_period_end?: number })
              ?.current_period_end;
            if (!periodEnd || periodEnd < windowStart || periodEnd > windowEnd) continue;
            if (sub.cancel_at_period_end) continue;
            candidates++;

            const userId = sub.metadata?.["supabase_user_id"];
            if (!userId) { skipped++; continue; }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: p } = await (supabaseAdmin as any)
              .from("user_profile")
              .select("user_id, email, first_name, notification_email")
              .eq("user_id", userId)
              .maybeSingle();
            if (!p?.email || p.notification_email === false) { skipped++; continue; }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: already } = await (supabaseAdmin as any)
              .from("reengagement_log")
              .select("id")
              .eq("user_id", userId)
              .eq("kind", `renewal_notice:${periodEnd}`)
              .limit(1)
              .maybeSingle();
            if (already) { skipped++; continue; }

            const planKey = sub.metadata?.["plan"] as keyof typeof CATALOG | undefined;
            const entry = planKey ? CATALOG[planKey] : undefined;
            const amountCents = item?.price?.unit_amount ?? entry?.amount ?? 0;
            const amountLabel = `$${(amountCents / 100).toFixed(2).replace(/\.00$/, "")}`;
            const chargeDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            const res = await enqueueRebuiltEmail({
              templateName: "renewal-reminder",
              recipientEmail: p.email,
              templateData: {
                firstName: p.first_name ?? "brother",
                planLabel: entry?.name ?? "Your REBUILT membership",
                amountLabel,
                chargeDate,
              },
              idempotencyKey: `renewal-notice:${userId}:${periodEnd}`,
            });

            if (res.ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabaseAdmin as any)
                .from("reengagement_log")
                .insert({ user_id: userId, kind: `renewal_notice:${periodEnd}` });
              sent++;
            } else {
              skipped++;
            }
          }

          return new Response(JSON.stringify({ ok: true, sent, skipped, candidates }), {
            headers: { "content-type": "application/json" },
          });
        },
      ),
    },
  },
});
