import { cn } from "@/lib/utils";

export type StatPillProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "gold" | "muted";
  className?: string;
};

const toneMap: Record<NonNullable<StatPillProps["tone"]>, string> = {
  default: "bg-[color:var(--bg-sunken)] border-border",
  primary: "bg-primary/10 border-primary/30",
  gold: "bg-gold/10 border-gold/30",
  muted: "bg-surface border-border/60",
};

export function StatPill({ label, value, hint, tone = "default", className }: StatPillProps) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 text-center min-w-0",
        toneMap[tone],
        className,
      )}
    >
      <div className="font-display text-base font-semibold leading-tight truncate">{value}</div>
      <div className="label-mono text-[11px] uppercase tracking-wide text-foreground/70 leading-tight mt-0.5 truncate">
        {label}
      </div>
      {hint && <div className="text-[11px] text-foreground/60 leading-tight mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

export function StatPillRow({ children, cols = 3, className }: { children: React.ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const colMap = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;
  return <div className={cn("grid gap-1.5", colMap[cols], className)}>{children}</div>;
}
