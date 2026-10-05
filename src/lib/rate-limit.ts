/**
 * Token-bucket rate limiter for /api/public/* handlers.
 *
 * In-memory Map keyed by (routeId, clientIp). Cloudflare Workers isolate per
 * instance, so this is best-effort flood protection — not a globally
 * consistent limit. Swap to KV / Durable Object when stricter caps are needed.
 */

type Bucket = { count: number; resetAt: number };
const BUCKETS: Map<string, Bucket> = new Map();

function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export type RateLimitOpts = { id: string; perMinute: number };

/**
 * Returns a 429 Response if over the cap, otherwise null (allowed).
 */
export function enforceRateLimit(
  request: Request,
  opts: RateLimitOpts,
): Response | null {
  const ip = clientIp(request);
  const key = `${opts.id}:${ip}`;
  const now = Date.now();
  const existing = BUCKETS.get(key);
  if (!existing || existing.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + 60_000 });
    return null;
  }
  if (existing.count >= opts.perMinute) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }
  existing.count += 1;
  return null;
}

export { clientIp };
