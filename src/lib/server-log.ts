/**
 * Structured server-side logger for /api/public/* handlers and key server fns.
 *
 * Emits a single JSON line to console (Cloudflare Worker logs pick this up).
 * Leaves a clearly-marked init point for Sentry: wire SENTRY_DSN later.
 */
import { enforceRateLimit, type RateLimitOpts } from "./rate-limit";

export type LogEntry = {
  route: string;
  action: string;
  userId?: string | null;
  outcome: "ok" | "error" | "denied" | string;
  latencyMs?: number;
  error?: string;
  extra?: Record<string, unknown>;
};

export function logServer(entry: LogEntry): void {
  const line = {
    ts: new Date().toISOString(),
    ...entry,
  };
  if (entry.outcome === "error") {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }

  // ====== SENTRY_INIT_HERE ======
  // To enable Sentry, set the SENTRY_DSN env var and uncomment below:
  // if (process.env.SENTRY_DSN && entry.outcome === "error") {
  //   import("@sentry/cloudflare").then((Sentry) => {
  //     Sentry.captureMessage(`${entry.route}:${entry.action}`, {
  //       level: "error",
  //       extra: line,
  //     });
  //   }).catch(() => { /* best-effort */ });
  // }
}

/**
 * Timing-safe string equality — prevents timing attacks on secret comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Verify a cron request carries the shared CRON_SECRET. Accepts either
 *   Authorization: Bearer <secret>
 *   x-cron-secret: <secret>
 * Returns null on success, or a Response to short-circuit on failure.
 */
export function requireCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed if the secret isn't configured — never allow anonymous cron.
    return new Response("Cron secret not configured", { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-cron-secret") ?? "";
  const provided = bearer || header;
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/**
 * Wraps a /api/public/* handler with rate limiting + structured logs.
 * Set `requireCron: true` on internal cron/scheduler endpoints so anonymous
 * callers can't trigger them.
 * Accepts the handler ctx loosely (params shape varies by route).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapPublicHandler<F extends (ctx: any) => Promise<Response>>(
  opts: { route: string; requireCron?: boolean } & RateLimitOpts,
  fn: F,
): F {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = async (ctx: any) => {
    const start = Date.now();
    if (opts.requireCron) {
      const denied = requireCronSecret(ctx.request);
      if (denied) {
        logServer({
          route: opts.route,
          action: "cron_auth",
          outcome: "denied",
          latencyMs: Date.now() - start,
        });
        return denied;
      }
    }
    const rl = enforceRateLimit(ctx.request, opts);
    if (rl) {
      logServer({
        route: opts.route,
        action: "rate_limit",
        outcome: "denied",
        latencyMs: Date.now() - start,
      });
      return rl;
    }
    try {
      const res = await fn(ctx);
      logServer({
        route: opts.route,
        action: "handle",
        outcome: res.status >= 500 ? "error" : "ok",
        latencyMs: Date.now() - start,
        extra: { status: res.status },
      });
      return res;
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      logServer({
        route: opts.route,
        action: "handle",
        outcome: "error",
        latencyMs: Date.now() - start,
        error: message,
      });
      // Sanitized response — no stack traces or internal messages leak to callers.
      return new Response("Internal Error", { status: 500 });
    }
  };
  return wrapped as F;
}

