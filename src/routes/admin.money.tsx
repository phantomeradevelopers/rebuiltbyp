import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminMoney } from "@/lib/admin-app.functions";
import { Stat, Empty, Loading, Bar, money } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/money")({
  component: MoneyTab,
});

function MoneyTab() {
  const q = useQuery({ queryKey: ["admin-money"], queryFn: () => adminMoney() });
  const d = q.data;
  const maxMonth = Math.max(1, ...(d?.byMonth ?? []).map((m) => m.cents));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">Money</h2>
        <p className="text-sm text-muted-foreground">Revenue, subscriptions, refunds and lifetime value. Real payments only.</p>
      </div>

      <Loading q={q} />
      {d && !d.hasData && <Empty what="No activity yet — no payments, subscriptions or course sales recorded." />}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Stat label="Net revenue" value={d ? money(d.netCents) : "—"} tone="gold" help="Paid minus refunded." />
        <Stat label="Gross" value={d ? money(d.revenueCents) : "—"} />
        <Stat label="Refunded" value={d ? money(d.refundedCents) : "—"} help={`${d?.refundCount ?? 0} refunds`} />
        <Stat label="Failed payments" value={d?.failedCount ?? "—"} />
        <Stat label="Active subscriptions" value={d?.activeSubs ?? "—"} />
        <Stat label="Churn" value={d ? `${d.churnPct}%` : "—"} help={`${d?.canceledSubs ?? 0} cancelled of all time.`} />
        <Stat label="Lifetime value" value={d ? money(d.ltvCents) : "—"} help={`Across ${d?.payers ?? 0} paying members.`} />
        <Stat label="One-time" value={d ? money(d.oneTimeCents) : "—"} />
        <Stat label="Payment plans" value={d ? money(d.planCents) : "—"} />
      </div>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-1">THE 3 × $199 SURCHARGE</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Three payments of $199 is $597 — $100 more than paying $497 once.
        </p>
        {d && d.surcharge.installments === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet — nobody is on the payment plan.</p>
        ) : (
          <p className="text-sm">
            <span className="font-display text-2xl text-gold">{d?.surcharge.installments ?? 0}</span> on the plan vs{" "}
            {d?.surcharge.full ?? 0} paying in full — {money(d?.surcharge.extraTotalCents ?? 0)} extra collected.
          </p>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">SHARE OF REVENUE BY PRODUCT</p>
        {d && d.byProduct.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {(d?.byProduct ?? []).map((p) => (
              <li key={p.key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{p.label}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {money(p.cents)} · {p.sharePct}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={p.sharePct} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">REVENUE BY MONTH</p>
        {d && d.byMonth.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="space-y-2">
            {(d?.byMonth ?? []).map((m) => (
              <li key={m.month}>
                <div className="flex justify-between text-xs">
                  <span>{m.month}</span>
                  <span className="tabular-nums text-muted-foreground">{money(m.cents)}</span>
                </div>
                <div className="mt-1">
                  <Bar pct={(m.cents / maxMonth) * 100} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-3">PLAN MIX BY HEAD COUNT</p>
        <ul className="text-sm space-y-1">
          {(d?.tierCounts ?? []).map((t) => (
            <li key={t.tier} className="flex justify-between">
              <span>{t.label}</span>
              <span className="tabular-nums text-muted-foreground">{t.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
