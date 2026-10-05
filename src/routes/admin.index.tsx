import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminAnalytics } from "@/lib/admin-app.functions";
import { Stat, Section, Empty, Loading, Bar, money } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/")({
  component: AnalyticsTab,
});

type Range = "today" | "7d" | "30d" | "90d" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

type Bucket = { key: string; visitors: number; sessions: number };

function Trend({ data }: { data: Bucket[] }) {
  if (data.length < 2) return <Empty what="Not enough days yet to draw a trend" />;
  const max = Math.max(...data.map((d) => d.visitors), 1);
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${30 - (d.visitors / max) * 28}`)
    .join(" ");
  return (
    <div className="card-elevated p-3">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-24">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-gold" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{data[0].key}</span>
        <span>peak {max}</span>
        <span>{data[data.length - 1].key}</span>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: { left: string; right: string; pct?: number }[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.left}-${i}`} className="card-elevated p-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{r.left}</span>
            <span className="text-muted-foreground tabular-nums shrink-0">{r.right}</span>
          </div>
          {typeof r.pct === "number" && <div className="mt-2"><Bar pct={r.pct} /></div>}
        </li>
      ))}
    </ul>
  );
}

const secs = (s: number | null) => (s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function AnalyticsTab() {
  const [range, setRange] = useState<Range>("30d");
  const [grain, setGrain] = useState<"byDay" | "byWeek" | "byMonth">("byDay");
  const q = useQuery({ queryKey: ["admin-analytics", range], queryFn: () => adminAnalytics({ data: { range } }) });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Real traffic from this site plus real money from the database. Nothing here is estimated.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`shrink-0 h-10 px-3.5 rounded-md text-sm border transition-colors ${
              range === r.key ? "bg-gold/15 text-gold border-gold/40" : "border-border text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Loading q={q} />

      {d && (
        <>
          {/* ------------------------------------------------------- traffic */}
          <Section title="Traffic" subtitle="Visitors are people; sessions are visits.">
            {!d.hasTraffic ? (
              <Empty what="No activity yet — traffic starts recording from now on." />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Visitors" value={d.traffic.visitors} tone="gold" />
                  <Stat label="Sessions" value={d.traffic.sessions} />
                  <Stat label="Page views" value={d.traffic.pageviews} />
                </div>
                <div className="flex gap-1.5">
                  {(["byDay", "byWeek", "byMonth"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrain(g)}
                      className={`h-9 px-3 rounded-md text-xs border ${
                        grain === g ? "border-gold/40 text-gold" : "border-border text-muted-foreground"
                      }`}
                    >
                      {g === "byDay" ? "Day" : g === "byWeek" ? "Week" : "Month"}
                    </button>
                  ))}
                </div>
                <Trend data={d.traffic[grain]} />
              </>
            )}
          </Section>

          {/* ------------------------------------------------------- sources */}
          <Section title="Where they came from" subtitle="Social platforms are called out by name.">
            <Rows
              rows={d.sources.map((s) => ({
                left: `${s.social ? "◆ " : ""}${s.source}`,
                right: `${s.sessions} session${s.sessions === 1 ? "" : "s"}`,
                pct: d.traffic.sessions ? (s.sessions / d.traffic.sessions) * 100 : 0,
              }))}
            />
          </Section>

          <Section title="Who they are">
            {!d.hasTraffic ? (
              <Empty />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="New" value={d.audience.newVisitors} />
                <Stat label="Returning" value={d.audience.returningVisitors} />
                {d.audience.devices.map((x) => (
                  <Stat key={x.device} label={x.device} value={x.sessions} />
                ))}
              </div>
            )}
          </Section>

          {/* --------------------------------------------------------- pages */}
          <Section title="Page by page" subtitle="Visits, how long people stay, and how often they leave from there.">
            {d.pages.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-2">
                {d.pages.map((p) => (
                  <li key={p.path} className="card-elevated p-3">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm truncate">{p.path}</span>
                      <span className="text-sm tabular-nums shrink-0">{p.visits}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.visitors} visitor{p.visitors === 1 ? "" : "s"} · avg {secs(p.avgSeconds)} · {p.exitRate}% leave from here
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* -------------------------------------------------------- funnel */}
          <Section title="The funnel" subtitle="Landing to purchase, and where the money leaks.">
            {d.funnel.biggestDrop && (
              <div className="card-elevated p-5 border-gold/50 text-center">
                <p className="label-mono text-[10px] text-muted-foreground">BIGGEST DROP-OFF</p>
                <p className="font-display text-6xl text-gold mt-1 tabular-nums">{d.funnel.biggestDrop.dropPct}%</p>
                <p className="text-sm mt-2">{d.funnel.biggestDrop.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{d.funnel.biggestDrop.lost} people lost here</p>
              </div>
            )}
            <ul className="space-y-2">
              {d.funnel.steps.map((s, i) => (
                <li key={s.label} className="card-elevated p-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>
                      {i + 1}. {s.label}
                    </span>
                    <span className="tabular-nums">{s.count}</span>
                  </div>
                  {i > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {s.dropPct}% dropped off ({s.lost} lost)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          {/* -------------------------------------------------------- clicks */}
          <Section title="Clicks" subtitle="Ranked by name, with the page they sit on.">
            <Rows
              rows={d.clicks.ranked.map((c) => ({
                left: `${c.name}${c.dead ? " · goes nowhere" : ""}`,
                right: `${c.count} · ${c.path}`,
              }))}
            />
          </Section>

          <Section title="Clicks that go nowhere">
            {d.clicks.dead.length === 0 ? (
              <Empty what={d.hasTraffic ? "Nothing broken — every tracked click has a destination." : "No activity yet"} />
            ) : (
              <Rows rows={d.clicks.dead.map((c) => ({ left: c.name, right: `${c.count} · ${c.path}` }))} />
            )}
          </Section>

          {/* --------------------------------------------------------- money */}
          <Section title="Money, tied to traffic">
            {!d.money.hasData ? (
              <Empty what="No activity yet — no payments recorded in this range." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Revenue" value={money(d.money.revenueCents)} tone="gold" />
                  <Stat label="Average order" value={money(d.money.aovCents)} />
                  <Stat label="Visitor → buyer" value={`${d.money.conversionPct}%`} />
                  <Stat label="Revenue per visitor" value={money(d.money.revenuePerVisitorCents)} />
                  <Stat label="Refunds" value={`${d.money.refundCount} · ${money(d.money.refundedCents)}`} />
                  <Stat label="Failed payments" value={d.money.failedCount} />
                  <Stat label="Active subscriptions" value={d.money.activeSubs} />
                  <Stat label="Churn" value={`${d.money.churnPct}%`} />
                  <Stat label="Course · 3 payments" value={d.money.coursePlans.installment} />
                  <Stat label="Course · paid in full" value={d.money.coursePlans.full} />
                </div>
                <Rows
                  rows={d.money.byProduct.map((p) => ({
                    left: p.key,
                    right: `${money(p.cents)} · ${p.count} sale${p.count === 1 ? "" : "s"}`,
                    pct: d.money.revenueCents ? (p.cents / d.money.revenueCents) * 100 : 0,
                  }))}
                />
                <Rows rows={d.money.byMonth.map((m) => ({ left: m.key, right: money(m.cents) }))} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
