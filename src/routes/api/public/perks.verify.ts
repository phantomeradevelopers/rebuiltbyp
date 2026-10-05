import { createFileRoute } from "@tanstack/react-router";
import { wrapPublicHandler } from "@/lib/server-log";

// Public partner-site endpoint. Requires HMAC-SHA256 signature of the raw body
// in the `x-perk-signature` header, keyed with PERK_SYNC_SECRET. Never returns
// PII — only { valid, discount_percent, tier_required }.
export const Route = createFileRoute("/api/public/perks/verify")({
  server: {
    handlers: {
      POST: wrapPublicHandler(
        { route: "perks/verify", id: "perks/verify", perMinute: 60 },
        async ({ request }) => {
          const secret = process.env.PERK_SYNC_SECRET;
          if (!secret) {
            return new Response("Perk verify not configured", { status: 503 });
          }

          const sigHeader = request.headers.get("x-perk-signature") ?? "";
          if (!sigHeader) {
            return new Response("Missing signature", { status: 401 });
          }

          const raw = await request.text();

          // HMAC-SHA256 via Web Crypto (Worker runtime)
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const macBuf = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(raw),
          );
          const expected = Array.from(new Uint8Array(macBuf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          if (!timingSafeEqualHex(sigHeader.trim().toLowerCase(), expected)) {
            return new Response("Invalid signature", { status: 401 });
          }

          let payload: { code?: unknown; partner?: unknown } = {};
          try {
            payload = JSON.parse(raw);
          } catch {
            return Response.json({ valid: false }, { status: 400 });
          }

          const code = typeof payload.code === "string" ? payload.code : "";
          const partner =
            typeof payload.partner === "string" ? payload.partner : "";
          if (
            !code ||
            code.length > 32 ||
            (partner !== "youthfullab" && partner !== "candyrx")
          ) {
            return Response.json({ valid: false }, { status: 200 });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabaseAdmin.rpc as any)(
            "verify_perk_code",
            { p_code: code, p_partner: partner },
          );
          if (error) {
            return Response.json({ valid: false }, { status: 200 });
          }
          const row = Array.isArray(data) ? data[0] : data;
          if (!row?.valid) {
            return Response.json({ valid: false }, { status: 200 });
          }
          return Response.json({
            valid: true,
            partner,
            discount_percent: row.discount_percent,
            tier_required: row.tier_required,
          });
        },
      ),
    },
  },
});

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}
