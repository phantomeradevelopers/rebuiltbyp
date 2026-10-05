/**
 * Graceful-degrade helper for createServerFn handlers that touch external
 * services (AI gateway, Stripe, plan generation). Logs and returns a typed
 * `{ ok: false, error }` shape instead of throwing a 500.
 */
import { logServer } from "./server-log";

export type SafeResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export async function safeHandler<T>(
  opName: string,
  fn: () => Promise<T>,
  opts?: { userId?: string | null },
): Promise<SafeResult<T>> {
  const start = Date.now();
  try {
    const value = await fn();
    logServer({
      route: "serverFn",
      action: opName,
      outcome: "ok",
      userId: opts?.userId ?? null,
      latencyMs: Date.now() - start,
    });
    return { ok: true, ...(value as object) } as SafeResult<T>;
  } catch (err) {
    const message = (err as Error)?.message ?? "Unexpected error.";
    logServer({
      route: "serverFn",
      action: opName,
      outcome: "error",
      userId: opts?.userId ?? null,
      latencyMs: Date.now() - start,
      error: message,
    });
    return { ok: false, error: message };
  }
}
