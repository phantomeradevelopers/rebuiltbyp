import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-card/50 p-8 space-y-3">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      ) : null}
      {action ? action : actionLabel && onAction ? (
        <Button onClick={onAction} size="sm" className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
