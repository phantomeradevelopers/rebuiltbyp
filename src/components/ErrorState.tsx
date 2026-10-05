import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * Calm, recoverable error UI. Replaces raw thrown errors and toast spam
 * inside data sections. Pair with TanStack Query's `isError`.
 */
export function ErrorState({
  title = "Something didn't load",
  description = "Tap to try again. Your data is safe.",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={
        compact
          ? "flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3"
          : "flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-card/40 p-6 space-y-3"
      }
    >
      <AlertCircle
        className={compact ? "h-4 w-4 text-muted-foreground shrink-0" : "h-6 w-6 text-muted-foreground"}
        aria-hidden
      />
      <div className={compact ? "min-w-0 flex-1" : ""}>
        <p className={compact ? "text-sm font-medium text-foreground" : "text-base font-semibold text-foreground"}>
          {title}
        </p>
        {description ? (
          <p className={compact ? "text-xs text-muted-foreground truncate" : "text-sm text-muted-foreground mt-1"}>
            {description}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          onClick={onRetry}
          size={compact ? "sm" : "default"}
          variant="outline"
          className="shrink-0 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
