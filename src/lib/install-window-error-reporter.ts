import { logClientError } from "@/lib/error-telemetry.functions";

/**
 * Installs window-level error reporters that forward to client_errors.
 * Idempotent — safe to call from a useEffect that may run twice.
 */
let installed = false;

export function installWindowErrorReporter(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const report = (message: string, stack?: string, extra?: Record<string, unknown>) => {
    try {
      void logClientError({
        data: {
          message: message.slice(0, 2000),
          stack: stack?.slice(0, 8000),
          route: window.location.pathname,
          userAgent: navigator.userAgent,
          extra,
        },
      });
    } catch {
      // best-effort
    }
  };

  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    report(
      err?.message || event.message || "window.onerror",
      err?.stack,
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const err = reason instanceof Error ? reason : undefined;
    report(
      err?.message || (typeof reason === "string" ? reason : "unhandledrejection"),
      err?.stack,
      { kind: "unhandledrejection" },
    );
  });
}
