import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ActionProps = {
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  "aria-label"?: string;
};

export function PrimarySecondaryRow({
  primary,
  secondary,
  className,
}: {
  primary: ActionProps;
  secondary?: ActionProps;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={primary.onClick}
        disabled={primary.disabled}
        aria-label={primary["aria-label"]}
        className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 transition"
      >
        {primary.icon}
        {primary.label}
      </button>
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          disabled={secondary.disabled}
          aria-label={secondary["aria-label"]}
          className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface text-foreground text-sm font-medium hover:border-primary/40 hover:bg-[color:var(--bg-sunken)] active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 transition"
        >
          {secondary.icon}
          {secondary.label}
        </button>
      )}
    </div>
  );
}
