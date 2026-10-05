import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

/**
 * Baseline security headers applied to every response.
 * - HSTS forces HTTPS for a year on subdomains.
 * - X-Frame-Options / frame-ancestors prevent clickjacking.
 * - nosniff blocks MIME sniffing.
 * - Referrer-Policy limits leakage of URLs to third parties.
 * - Permissions-Policy denies powerful features by default (opt-in per-feature elsewhere).
 * A relaxed CSP is intentionally omitted for now (would need a report-only rollout).
 */
function withSecurityHeaders(response: Response, url?: URL): Response {
  const h = new Headers(response.headers);
  // The admin console must never be indexed, archived or cached anywhere.
  if (url && /^\/admin(\/|$)/.test(url.pathname)) {
    h.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    h.set("Cache-Control", "no-store");
  }
  if (!h.has("Strict-Transport-Security")) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (!h.has("X-Frame-Options")) h.set("X-Frame-Options", "DENY");
  if (!h.has("X-Content-Type-Options")) h.set("X-Content-Type-Options", "nosniff");
  if (!h.has("Referrer-Policy")) h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // `payment` must be delegated to Stripe's iframes, otherwise Apple Pay and
  // Google Pay cannot render inside the Express Checkout Element at all.
  if (!h.has("Permissions-Policy"))
    h.set(
      "Permissions-Policy",
      'geolocation=(self), camera=(self), microphone=(self), payment=(self "https://js.stripe.com" "https://pay.google.com" "https://checkout.stripe.com"), interest-cohort=()',
    );

  if (!h.has("Cross-Origin-Opener-Policy")) h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const url = new URL(request.url);
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), url);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(brandedErrorResponse());
    }
  },
};

