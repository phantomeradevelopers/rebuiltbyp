import { Component, type ReactNode } from "react";
import { logClientError } from "@/lib/error-telemetry.functions";
import { isStaleChunkError, maybeReloadForStaleChunk } from "@/lib/client-telemetry";


interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level boundary above the router. Catches render errors that escape
 * route-level errorComponents and forwards them to client_errors telemetry.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Stale chunk after a fresh deploy: silently reload instead of showing a wall.
    if (isStaleChunkError(error) && maybeReloadForStaleChunk(error)) return;
    try {
      void logClientError({
        data: {
          message: error.message || "Render error",
          stack: error.stack ?? undefined,
          route:
            typeof window !== "undefined" ? window.location.pathname : undefined,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          extra: { componentStack: info.componentStack ?? null },
        },
      });
    } catch {
      // never throw from a boundary
    }
    console.error("[AppErrorBoundary]", error);
  }


  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="label-mono">Something gave way</p>
          <h1 className="mt-4 font-display text-3xl text-foreground">
            We hit a wall.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                this.reset();
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reload
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
