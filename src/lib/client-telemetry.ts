/**
 * Browser-side telemetry: dedupe + send uncaught errors to the server,
 * and recover from stale-chunk dynamic-import failures with an auto-reload.
 */
import { logClientError } from "./error-telemetry.functions";

const SEEN = new Set<string>();
const RELOAD_TS_KEY = "rebuilt.stale-chunk.reloaded_at";
const RELOAD_COOLDOWN_MS = 30_000; // allow another auto-reload after 30s (covers back-to-back deploys)
const STALE_CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /error loading dynamically imported module/i,
];

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message}` : String(err ?? "");
  return STALE_CHUNK_PATTERNS.some((re) => re.test(msg));
}

async function send(error: unknown, extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const err = error instanceof Error ? error : new Error(String(error ?? "unknown"));
  const key = `${err.message}::${(err.stack ?? "").slice(0, 200)}`;
  if (SEEN.has(key)) return;
  SEEN.add(key);
  if (SEEN.size > 50) SEEN.clear();

  try {
    await logClientError({
      data: {
        message: err.message.slice(0, 2000),
        stack: err.stack?.slice(0, 8000),
        route: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent.slice(0, 500),
        extra,
      },
    });
  } catch { /* swallow */ }
}

export function maybeReloadForStaleChunk(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isStaleChunkError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) ?? "0");
    if (last && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
  } catch { /* sessionStorage blocked */ }
  // Replace to bust in-memory router state; keeps history clean.
  setTimeout(() => window.location.replace(window.location.href), 50);
  return true;
}

let installed = false;
export function installClientTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error ?? event.message;
    if (maybeReloadForStaleChunk(err)) return;
    void send(err);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (maybeReloadForStaleChunk(reason)) return;
    void send(reason);
  });
}

export function reportError(error: unknown, extra?: Record<string, unknown>) {
  void send(error, extra);
}
