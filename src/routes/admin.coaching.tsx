import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminCoaching } from "@/lib/admin-app.functions";
import { Stat, Empty, Loading, money } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/coaching")({
  component: CoachingTab,
});

function CoachingTab() {
  const q = useQuery({ queryKey: ["admin-coaching"], queryFn: () => adminCoaching() });
  const d = q.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">1-on-1 coaching</h2>
        <p className="text-sm text-muted-foreground">The $3,000 program. Applications, pipeline and who is active right now.</p>
      </div>

      <Loading q={q} />
      {d && !d.hasData && <Empty what="No activity yet — no applications or seats." />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Applications" value={d?.applications.length ?? "—"} />
        <Stat label="Active clients" value={d?.activeSeats ?? "—"} tone="gold" />
        <Stat label="Sessions booked" value={d?.sessionsBooked ?? "—"} />
        <Stat label="Program value" value={d ? money(d.programValueCents) : "—"} help="Active seats × $3,000." />
      </div>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">PIPELINE</p>
        <ul className="text-sm space-y-1">
          {(d?.pipeline ?? []).map((p) => (
            <li key={p.stage} className="flex justify-between">
              <span className="capitalize">{p.stage}</span>
              <span className="tabular-nums text-muted-foreground">{p.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">APPLICATIONS</p>
        {d && d.applications.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {(d?.applications ?? []).map((a) => (
              <li key={a.id} className="border-b border-border/50 pb-2 last:border-0">
                <div className="flex justify-between gap-3">
                  <p className="text-sm truncate">{a.name || a.email || "Applicant"}</p>
                  <span className="text-[11px] uppercase tracking-wide text-gold shrink-0">{a.status}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{a.email} · {a.at}</p>
                {a.want && <p className="text-xs mt-1 line-clamp-2">{a.want}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">CURRENTLY ACTIVE</p>
        {d && d.seats.filter((s) => s.status === "active").length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="text-xs space-y-1">
            {(d?.seats ?? [])
              .filter((s) => s.status === "active")
              .map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className="truncate">{s.name || s.email}</span>
                  <span className="text-muted-foreground">since {s.started ?? "—"}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
