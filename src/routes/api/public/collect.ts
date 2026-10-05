import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * First-party analytics collector. The public tracker beacons here; rows land
 * in web_events via the service role so the table stays unreadable to visitors.
 * Never throws back at the browser — analytics must never break a page.
 */
const EventSchema = z.object({
  session_id: z.string().min(1).max(64),
  visitor_id: z.string().min(1).max(64),
  event_type: z.enum(["pageview", "pageleave", "click", "custom", "conversion"]),
  name: z.string().max(120).nullish(),
  path: z.string().max(300).nullish(),
  referrer: z.string().max(500).nullish(),
  utm_source: z.string().max(120).nullish(),
  utm_medium: z.string().max(120).nullish(),
  device: z.enum(["mobile", "tablet", "desktop"]).nullish(),
  screen_w: z.number().int().min(0).max(20000).nullish(),
  duration_ms: z.number().int().min(0).max(3_600_000).nullish(),
  is_new: z.boolean().nullish(),
  href: z.string().max(500).nullish(),
  dead_link: z.boolean().nullish(),
  value_cents: z.number().int().min(0).max(100_000_000).nullish(),
  currency: z.string().max(8).nullish(),
});

function ok() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/public/collect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const parsed = EventSchema.safeParse(JSON.parse(raw));
          if (!parsed.success) return ok();
          const e = parsed.data;
          // Own console traffic never pollutes the numbers.
          if (e.path && /^\/admin(\/|$)/.test(e.path)) return ok();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("web_events").insert({
            site: "rebuiltbyp.com",
            session_id: e.session_id,
            visitor_id: e.visitor_id,
            event_type: e.event_type,
            name: e.name ?? null,
            path: e.path ?? null,
            referrer: e.referrer ?? null,
            utm_source: e.utm_source ?? null,
            utm_medium: e.utm_medium ?? null,
            device: e.device ?? null,
            screen_w: e.screen_w ?? null,
            duration_ms: e.duration_ms ?? null,
            is_new: e.is_new ?? null,
            href: e.href ?? null,
            dead_link: e.dead_link ?? null,
            value_cents: e.value_cents ?? null,
            currency: e.currency ?? null,
          });
        } catch {
          /* analytics is never load-bearing */
        }
        return ok();
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
