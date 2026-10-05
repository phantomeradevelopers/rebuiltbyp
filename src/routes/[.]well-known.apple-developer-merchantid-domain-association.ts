import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe / Apple Pay domain association file.
 *
 * Stripe verifies a payment method domain by fetching
 *   https://<domain>/.well-known/apple-developer-merchantid-domain-association
 * The contents are the single public file Stripe publishes for all accounts.
 * We proxy it (with a long cache) so the file can never drift out of date.
 */
const STRIPE_FILE_URL =
  "https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association";

let cached: { body: string; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export const Route = createFileRoute(
  "/.well-known/apple-developer-merchantid-domain-association",
)({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        if (!cached || now - cached.at > TTL_MS) {
          const res = await fetch(STRIPE_FILE_URL);
          if (!res.ok) {
            if (cached) return text(cached.body);
            return new Response("unavailable", { status: 503 });
          }
          cached = { body: (await res.text()).trim(), at: now };
        }
        return text(cached.body);
      },
    },
  },
});

function text(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
