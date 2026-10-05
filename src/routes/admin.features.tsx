import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminFeatures } from "@/lib/admin-app.functions";
import { Empty, Loading, Bar } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/features")({
  component: FeaturesTab,
});

function FeaturesTab() {
  const q = useQuery({ queryKey: ["admin-features"], queryFn: () => adminFeatures() });
  const d = q.data;
  const max = Math.max(1, ...(d?.ranked ?? []).map((r) => r.count30));
  const maxFirst = Math.max(1, ...(d?.firstTouch ?? []).map((r) => r.count));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg">Features</h2>
        <p className="text-sm text-muted-foreground">What people use, what they touch first, and what pulls them back.</p>
      </div>

      <Loading q={q} />
      {d && !d.hasData && <Empty what="No activity yet — nothing logged in the last 90 days." />}

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">MOST USED · LAST 30 DAYS</p>
        <ul className="space-y-3">
          {(d?.ranked ?? []).map((r) => (
            <li key={r.key}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {r.count30 === 0 ? "No activity yet" : `${r.count30} · ${r.users30} people`}
                </span>
              </div>
              <div className="mt-1.5">
                <Bar pct={(r.count30 / max) * 100} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-1">FIRST THING THEY TOUCH</p>
        <p className="text-[11px] text-muted-foreground mb-3">The first feature each member ever used, counted per member.</p>
        {d && d.firstTouch.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {(d?.firstTouch ?? []).map((r) => (
              <li key={r.key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">{r.count}</span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={(r.count / maxFirst) * 100} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-1">WHAT KEEPS THEM COMING BACK</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Share of people who used the feature on three or more separate days.
        </p>
        {d && d.sticky.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {(d?.sticky ?? []).map((r) => (
              <li key={r.key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {r.stickyPct}% · {r.repeat}/{r.users}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={r.stickyPct} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-1">NOBODY TOUCHES THIS</p>
        <p className="text-[11px] text-muted-foreground mb-3">Zero use in the last 90 days — candidates to cut.</p>
        {(d?.ranked ?? []).filter((r) => r.count90 === 0).length === 0 ? (
          <Empty what="Every feature has been used at least once." />
        ) : (
          <ul className="space-y-1.5 text-sm">
            {(d?.ranked ?? [])
              .filter((r) => r.count90 === 0)
              .map((r) => (
                <li key={r.key} className="text-muted-foreground">
                  {r.label}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
