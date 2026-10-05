import type { ReactNode } from "react";

export function money(cents: number | null | undefined) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v % 1 ? 2 : 0 });
}

export function Stat({
  label,
  value,
  help,
  tone,
}: {
  label: string;
  value: ReactNode;
  help?: string;
  tone?: "gold" | "plain";
}) {
  return (
    <div className={`card-elevated p-3 ${tone === "gold" ? "border-gold/50" : ""}`}>
      <p className="label-mono text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${tone === "gold" ? "text-gold" : ""}`}>{value}</p>
      {help && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{help}</p>}
    </div>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ what = "No activity yet" }: { what?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{what}</p>
    </div>
  );
}

export function Loading({ q }: { q: { isLoading: boolean; error: unknown } }) {
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  return null;
}

export function Bar({ pct, tone = "gold" }: { pct: number; tone?: "gold" | "muted" }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={tone === "gold" ? "h-full bg-gold" : "h-full bg-muted-foreground/50"}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
