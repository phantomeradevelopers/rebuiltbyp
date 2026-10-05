import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminCourse } from "@/lib/admin-app.functions";
import { Stat, Empty, Loading, Bar, money } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/course")({
  component: CourseTab,
});

function CourseTab() {
  const q = useQuery({ queryKey: ["admin-course"], queryFn: () => adminCourse() });
  const d = q.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">The REBUILT Course</h2>
        <p className="text-sm text-muted-foreground">$497 one-time or 3 × $199. Who bought, who is mid-course, where they quit.</p>
      </div>

      <Loading q={q} />

      {d?.dropOff ? (
        <div className="rounded-xl border-2 border-gold bg-gold/10 p-4">
          <p className="label-mono text-[10px] text-gold">THEY QUIT HERE</p>
          <p className="font-display text-xl mt-1">{d.dropOff.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {d.dropOff.dropped} started it and never finished — {100 - d.dropOff.completionPct}% of everyone who opened it.
          </p>
        </div>
      ) : d ? (
        <div className="rounded-xl border-2 border-dashed border-gold/40 p-4">
          <p className="label-mono text-[10px] text-gold">THEY QUIT HERE</p>
          <p className="text-sm text-muted-foreground mt-1">No activity yet — nobody has started a module.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Stat label="Buyers" value={d?.buyers ?? "—"} />
        <Stat label="Paid in full" value={d?.fullPay ?? "—"} help="$497" />
        <Stat label="Payment plan" value={d?.installmentPay ?? "—"} help="3 × $199 = $597" />
        <Stat label="Started" value={d?.started ?? "—"} />
        <Stat label="Mid-course" value={d?.midCourse ?? "—"} />
        <Stat label="Finished" value={d?.finished ?? "—"} />
      </div>

      <Stat
        label="Average days to finish"
        value={d ? (d.avgDaysToFinish === null ? "No activity yet" : `${d.avgDaysToFinish} days`) : "—"}
        help="First module opened to last module finished."
      />

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">COMPLETION BY MODULE</p>
        {d && d.modules.length === 0 && <Empty what="No modules published yet" />}
        <ul className="space-y-3">
          {(d?.modules ?? []).map((m) => (
            <li key={m.slug}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm truncate">{m.title}</p>
                <p className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {m.started === 0 ? "No activity yet" : `${m.completed}/${m.started} · ${m.completionPct}%`}
                </p>
              </div>
              <div className="mt-1.5">
                <Bar pct={m.completionPct} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">WHO BOUGHT</p>
        {d && d.recentBuyers.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="text-xs space-y-1">
            {(d?.recentBuyers ?? []).map((b, i) => (
              <li key={`${b.email}-${i}`} className="flex justify-between gap-3">
                <span className="truncate">{b.name || b.email}</span>
                <span className="text-muted-foreground shrink-0">
                  {b.plan} · {money(b.amount)} · {b.at}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
