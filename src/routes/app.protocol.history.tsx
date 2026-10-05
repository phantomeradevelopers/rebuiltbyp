import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ChevronLeft, Download, History, Check, X, Clock } from "lucide-react";
import { listDoseHistory, listUserMedications, type DoseHistoryRow } from "@/lib/medications.functions";
import { MedicalEducationalBanner } from "@/components/MedicalEducationalBanner";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

export const Route = createFileRoute("/app/protocol/history")({
  component: DoseHistoryPage,
  head: () => ({
    meta: [
      { title: "Dose history — REBUILT" },
      { name: "description", content: "Review past medication doses and export your log as a CSV." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="px-4 pt-safe pt-10 max-w-md mx-auto">
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => null,
});

type RangeKey = "7" | "30" | "90" | "365";
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "7", label: "7d", days: 7 },
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "365", label: "1y", days: 365 },
];

function rangeFromKey(key: RangeKey): { from: string; to: string } {
  const days = RANGES.find((r) => r.key === key)!.days;
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function fmtDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: DoseHistoryRow[], from: string, to: string) {
  const header = [
    "scheduled_at", "taken_at", "status", "medication", "dose_amount", "dose_unit", "route", "notes",
  ];
  const body = rows.map((r) => [
    r.scheduled_at,
    r.taken_at ?? "",
    r.status,
    r.display_name,
    r.dose_amount ?? "",
    r.dose_unit ?? "",
    r.route ?? "",
    r.notes ?? "",
  ].map(csvEscape).join(","));
  const csv = [header.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dose-history_${from}_to_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DoseHistoryPage() {
  const historyFn = useServerFn(listDoseHistory);
  const medsFn = useServerFn(listUserMedications);
  const [range, setRange] = useState<RangeKey>("30");
  const [medId, setMedId] = useState<string | "all">("all");
  const { from, to } = useMemo(() => rangeFromKey(range), [range]);

  const meds = useQuery({
    queryKey: ["user-medications"],
    queryFn: () => medsFn(),
    staleTime: 60_000,
  });

  const doses = useQuery({
    queryKey: ["dose-history", from, to, medId],
    queryFn: () => historyFn({ data: { from, to, medication_id: medId === "all" ? null : medId } }),
    staleTime: 15_000,
  });

  const rows = doses.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, DoseHistoryRow[]>();
    for (const r of rows) {
      const k = r.scheduled_at.slice(0, 10);
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const taken = rows.filter((r) => r.status === "taken").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const missed = rows.filter((r) => r.status === "missed" || r.status === "pending").length;
  const adherence = rows.length ? Math.round((taken / rows.length) * 100) : 0;

  const onExport = () => {
    if (!rows.length) {
      toast.error("Nothing to export in this range.");
      return;
    }
    haptic("light");
    downloadCsv(rows, from, to);
    toast.success(`Exported ${rows.length} dose${rows.length === 1 ? "" : "s"}.`);
  };

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto pb-32 space-y-6">
      <MedicalEducationalBanner />
      <header>
        <Link
          to="/app/protocol"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Protocol
        </Link>
        <p className="label-mono text-gold flex items-center gap-1.5">
          <History className="h-3 w-3" /> Dose history
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">
          Every dose, on the record.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Filter by date and medication, then export a clean CSV you can share with your prescriber.
        </p>
      </header>

      <section className="card-elevated p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => { haptic("light"); setRange(r.key); }}
              className={`px-3 h-8 rounded-md text-xs label-mono border transition-colors ${
                range === r.key
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-[color:var(--bg-sunken)] border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select
          value={medId}
          onChange={(e) => setMedId(e.target.value as any)}
          className="w-full h-9 rounded-md bg-[color:var(--bg-sunken)] border border-border px-2 text-sm"
        >
          <option value="all">All medications</option>
          {(meds.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>

        <div className="grid grid-cols-4 gap-2 pt-1">
          <Stat label="Doses" value={rows.length} />
          <Stat label="Taken" value={taken} tone="good" />
          <Stat label="Skipped" value={skipped} tone="warn" />
          <Stat label="Adherence" value={`${adherence}%`} tone="gold" />
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={doses.isLoading || !rows.length}
          className="w-full h-10 rounded-md bg-gold text-gold-foreground label-mono text-xs inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </section>

      <section className="space-y-3">
        {doses.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-[color:var(--bg-sunken)] animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="card-elevated p-6 text-center space-y-1">
            <p className="font-display text-base">No doses logged.</p>
            <p className="text-xs text-muted-foreground">
              Once you start marking doses on the Protocol screen, they'll show up here.
            </p>
          </div>
        ) : (
          grouped.map(([day, items], gi) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: gi * 0.03 }}
              className="card-elevated p-4 space-y-3"
            >
              <p className="label-mono text-[11px] text-muted-foreground">
                {fmtDateKey(day + "T12:00:00")}
              </p>
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="flex items-start gap-3">
                    <StatusIcon status={r.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtTime(r.scheduled_at)}
                        {r.dose_amount != null && ` · ${r.dose_amount}${r.dose_unit ?? ""}`}
                        {r.route && ` · ${r.route}`}
                      </p>
                      {r.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">"{r.notes}"</p>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </motion.div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" | "gold" }) {
  const color =
    tone === "good" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-400" :
    tone === "gold" ? "text-gold" : "text-foreground";
  return (
    <div className="rounded-md bg-[color:var(--bg-sunken)] px-2 py-2 text-center">
      <p className={`font-display text-lg leading-none ${color}`}>{value}</p>
      <p className="label-mono text-[9px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: DoseHistoryRow["status"] }) {
  if (status === "taken") return <div className="h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-400 grid place-items-center shrink-0"><Check className="h-3.5 w-3.5" /></div>;
  if (status === "skipped") return <div className="h-7 w-7 rounded-full bg-amber-500/15 text-amber-400 grid place-items-center shrink-0"><X className="h-3.5 w-3.5" /></div>;
  return <div className="h-7 w-7 rounded-full bg-[color:var(--bg-sunken)] text-muted-foreground grid place-items-center shrink-0"><Clock className="h-3.5 w-3.5" /></div>;
}

function StatusBadge({ status }: { status: DoseHistoryRow["status"] }) {
  const map = {
    taken: "bg-emerald-500/10 text-emerald-400",
    skipped: "bg-amber-500/10 text-amber-400",
    missed: "bg-red-500/10 text-red-400",
    pending: "bg-[color:var(--bg-sunken)] text-muted-foreground",
  } as const;
  return (
    <span className={`label-mono text-[9px] px-2 py-1 rounded-md shrink-0 ${map[status]}`}>
      {status}
    </span>
  );
}
