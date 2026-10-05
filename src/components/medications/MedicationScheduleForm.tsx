import { useMemo, useState } from "react";
import { X, Plus, Phone, ChevronDown, Minus } from "lucide-react";
import type { CatalogItem, ScheduleConfig, UserMedication } from "@/lib/medications.functions";
import { ShipmentForm, type ShipmentFormValue } from "./ShipmentForm";
import { TimeDial } from "@/components/TimeDial";


export type ScheduleFormValue = {
  display_name: string;
  catalog_id: string | null;
  dose_amount: number | null;
  dose_unit: string;
  route: string;
  schedule_type: "daily" | "weekly_days" | "every_n_days" | "cycle" | "as_needed";
  schedule_config: ScheduleConfig;
  source_tag: "candyrx" | "other";
  notes: string | null;
  rx_acknowledged: boolean;
  shipment?: ShipmentFormValue;
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

type SchedOpt = { v: ScheduleFormValue["schedule_type"]; l: string };
const PRIMARY_SCHEDULES: SchedOpt[] = [
  { v: "daily", l: "Daily" },
  { v: "weekly_days", l: "Weekly" },
  { v: "as_needed", l: "As needed" },
];
const MORE_SCHEDULES: SchedOpt[] = [
  { v: "every_n_days", l: "Every N days" },
  { v: "cycle", l: "Cycle on/off" },
];

/** Common label doses per catalog slug — for reference only. Follow your prescriber. */
const DOSE_PRESETS: Record<string, { a: number; u: string }[]> = {
  "compounded-semaglutide": [{ a: 0.25, u: "mg" }, { a: 0.5, u: "mg" }, { a: 1, u: "mg" }, { a: 1.7, u: "mg" }, { a: 2.4, u: "mg" }],
  "compounded-tirzepatide-inj": [{ a: 2.5, u: "mg" }, { a: 5, u: "mg" }, { a: 7.5, u: "mg" }, { a: 10, u: "mg" }, { a: 12.5, u: "mg" }, { a: 15, u: "mg" }],
  "compounded-tirzepatide-odt": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "mounjaro": [{ a: 2.5, u: "mg" }, { a: 5, u: "mg" }, { a: 7.5, u: "mg" }, { a: 10, u: "mg" }, { a: 12.5, u: "mg" }, { a: 15, u: "mg" }],
  "glp-squared": [{ a: 2.5, u: "mg" }, { a: 5, u: "mg" }, { a: 7.5, u: "mg" }, { a: 10, u: "mg" }],
  "testosterone-cypionate": [{ a: 100, u: "mg" }, { a: 120, u: "mg" }, { a: 150, u: "mg" }, { a: 200, u: "mg" }],
  "testosterone-cream": [{ a: 0.5, u: "ml" }, { a: 1, u: "ml" }, { a: 2, u: "ml" }],
  "testosterone-troche": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "enclomiphene": [{ a: 6.25, u: "mg" }, { a: 12.5, u: "mg" }, { a: 25, u: "mg" }],
  "anastrozole": [{ a: 0.25, u: "mg" }, { a: 0.5, u: "mg" }, { a: 1, u: "mg" }],
  "hcg": [{ a: 250, u: "iu" }, { a: 500, u: "iu" }, { a: 1000, u: "iu" }],
  "tadalafil": [{ a: 2.5, u: "mg" }, { a: 5, u: "mg" }, { a: 10, u: "mg" }, { a: 20, u: "mg" }],
  "sildenafil": [{ a: 25, u: "mg" }, { a: 50, u: "mg" }, { a: 100, u: "mg" }],
  "vardenafil-troche": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "trimix-t105": [{ a: 0.1, u: "ml" }, { a: 0.2, u: "ml" }, { a: 0.3, u: "ml" }],
  "finasteride": [{ a: 1, u: "mg" }, { a: 5, u: "mg" }],
  "minoxidil-oral": [{ a: 1.25, u: "mg" }, { a: 2.5, u: "mg" }, { a: 5, u: "mg" }],
  "minoxidil-topical": [{ a: 0.5, u: "ml" }, { a: 1, u: "ml" }],
  "tretinoin": [{ a: 1, u: "pump" }, { a: 2, u: "pump" }],
  "tretinoin-niacinamide-sh-cream": [{ a: 1, u: "pump" }, { a: 2, u: "pump" }, { a: 3, u: "pump" }],
  "caffeine-ghk-niacinamide-tretinoin-cream": [{ a: 1, u: "pump" }, { a: 2, u: "pump" }, { a: 3, u: "pump" }],
  "estriol-niacinamide-tretinoin-cream": [{ a: 1, u: "pump" }, { a: 2, u: "pump" }, { a: 3, u: "pump" }],
  "azelaic-niacinamide-tranexamic-cream": [{ a: 1, u: "pump" }, { a: 2, u: "pump" }, { a: 3, u: "pump" }],
  "ketoconazole-latanoprost-minoxidil": [{ a: 0.5, u: "ml" }, { a: 1, u: "ml" }],
  "latanoprost-minoxidil": [{ a: 0.5, u: "ml" }, { a: 1, u: "ml" }],
  "finasteride-minoxidil-biotin-caps": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "minoxidil-ghk-apigenin-fisetin-tabs": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "nad-injection": [{ a: 50, u: "mg" }, { a: 100, u: "mg" }, { a: 200, u: "mg" }],
  "nad-nasal": [{ a: 1, u: "spray" }, { a: 2, u: "spray" }],
  "nad-troche": [{ a: 1, u: "tablet" }, { a: 2, u: "tablet" }],
  "sermorelin": [{ a: 0.2, u: "mg" }, { a: 0.3, u: "mg" }, { a: 0.5, u: "mg" }],
  "ipamorelin-cjc": [{ a: 0.2, u: "mg" }, { a: 0.3, u: "mg" }],
  "bpc-157": [{ a: 0.25, u: "mg" }, { a: 0.5, u: "mg" }],
  "micc-injection": [{ a: 0.5, u: "ml" }, { a: 1, u: "ml" }],
};

/** Natural stepper increment per medication slug. */
const DOSE_STEPS: Record<string, number> = {
  "compounded-semaglutide": 0.25,
  "compounded-tirzepatide-inj": 2.5,
  "mounjaro": 2.5,
  "glp-squared": 2.5,
  "testosterone-cypionate": 10,
  "testosterone-cream": 0.25,
  "enclomiphene": 6.25,
  "anastrozole": 0.25,
  "hcg": 50,
  "tadalafil": 2.5,
  "sildenafil": 25,
  "finasteride": 1,
  "minoxidil-oral": 1.25,
  "minoxidil-topical": 0.25,
  "nad-injection": 25,
  "sermorelin": 0.1,
  "ipamorelin-cjc": 0.1,
  "bpc-157": 0.25,
  "micc-injection": 0.25,
  "trimix-t105": 0.05,
  "ketoconazole-latanoprost-minoxidil": 0.25,
  "latanoprost-minoxidil": 0.25,
};
function roundStep(n: number, step: number) {
  return Math.round(n / step) * step;
}

/** Pluralize the unit label for dropdown display. */
function unitLabel(u: string, n: number): string {
  // mass/volume units are never pluralized
  if (u === "mg" || u === "ml" || u === "iu") return u;
  // count units pluralize
  const plural = n === 1 ? u : `${u}s`;
  return plural;
}


/** Smart defaults from CandyRx catalog category + slug. */
function defaultsFor(c: CatalogItem | null, time: string): {
  schedule_type: ScheduleFormValue["schedule_type"];
  schedule_config: ScheduleConfig;
} {
  if (!c) return { schedule_type: "daily", schedule_config: { times: [time] } };
  const cat = c.category;
  const slug = c.slug;

  if (cat === "Sexual Health") return { schedule_type: "as_needed", schedule_config: {} };
  if (cat === "Weight Loss") {
    if (slug === "compounded-tirzepatide-odt") return { schedule_type: "daily", schedule_config: { times: [time] } };
    return { schedule_type: "weekly_days", schedule_config: { days_of_week: [0], times: [time] } };
  }
  if (cat === "Hormonal Therapy") {
    if (slug === "testosterone-cypionate") return { schedule_type: "every_n_days", schedule_config: { every_n_days: 7, times: [time] } };
    return { schedule_type: "daily", schedule_config: { times: [time] } };
  }
  if (cat === "Wellness / Anti-Aging" && slug === "nad-injection") {
    return { schedule_type: "weekly_days", schedule_config: { days_of_week: [0], times: [time] } };
  }
  return { schedule_type: "daily", schedule_config: { times: [time] } };
}

/** Find the next 15-min slot after wake that isn't already used by another reminder. */
function suggestStaggeredTime(wake: string, taken: string[]): string {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const fromMin = (n: number) => {
    const x = ((n % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  const used = new Set(taken);
  let m = toMin(wake) + 15;
  for (let i = 0; i < 4; i++) {
    const t = fromMin(m);
    if (!used.has(t)) return t;
    m += 15;
  }
  return fromMin(toMin(wake) + 15);
}

function blankFromCatalog(c: CatalogItem | null, defaultTime: string): ScheduleFormValue {
  const sched = defaultsFor(c, defaultTime);
  return {
    display_name: c?.brand_name ?? "",
    catalog_id: c?.id ?? null,
    dose_amount: null,
    dose_unit: c?.default_unit ?? "mg",
    route: c?.typical_route ?? "oral",
    schedule_type: sched.schedule_type,
    schedule_config: sched.schedule_config,
    source_tag: c?.source === "candyrx" ? "candyrx" : "other",
    notes: null,
    rx_acknowledged: true,
    shipment: { enabled: false, carrier: "USPS", tracking_number: "" },
  };
}


export function MedicationScheduleForm({
  catalog,
  initialCatalog,
  initial,
  onSubmit,
  onCancel,
  submitting,
  wakeTime = "07:00",
  middayTime = "12:30",
  eveningTime = "20:00",
  usedTimes = [],
}: {
  catalog: CatalogItem | null;
  initialCatalog: CatalogItem | null;
  initial?: UserMedication;
  onSubmit: (v: ScheduleFormValue) => void;
  onCancel: () => void;
  submitting?: boolean;
  wakeTime?: string;
  middayTime?: string;
  eveningTime?: string;
  usedTimes?: string[];
}) {
  const cat = catalog ?? initialCatalog;

  // Default time: staggered 15 min after wake, skipping any slot already in use.
  const reservedTimes = useMemo(
    () => [wakeTime, middayTime, eveningTime, ...usedTimes],
    [wakeTime, middayTime, eveningTime, usedTimes],
  );
  const defaultTime = useMemo(
    () => suggestStaggeredTime(wakeTime, reservedTimes),
    [wakeTime, reservedTimes],
  );

  const [v, setV] = useState<ScheduleFormValue>(() =>
    initial
      ? {
          display_name: initial.display_name,
          catalog_id: initial.catalog_id,
          dose_amount: initial.dose_amount,
          dose_unit: initial.dose_unit ?? "mg",
          route: initial.route ?? "oral",
          schedule_type: initial.schedule_type,
          schedule_config: initial.schedule_config ?? {},
          source_tag: (initial.source_tag === "candyrx" ? "candyrx" : "other") as "candyrx" | "other",
          notes: initial.notes,
          rx_acknowledged: true,
          shipment: { enabled: false, carrier: "USPS", tracking_number: "" },
        }
      : blankFromCatalog(cat, defaultTime),
  );

  const [showMoreSchedules, setShowMoreSchedules] = useState(
    () => !!initial && (initial.schedule_type === "every_n_days" || initial.schedule_type === "cycle"),
  );
  const [customDose, setCustomDose] = useState(() => {
    // Edit mode: open "Custom" if the existing dose doesn't match a preset.
    if (!initial || !cat) return false;
    const presets = DOSE_PRESETS[cat.slug] ?? [];
    if (!presets.length) return true;
    return !presets.some((p) => p.a === initial.dose_amount && p.u === (initial.dose_unit ?? cat.default_unit));
  });

  const times = v.schedule_config.times ?? [];
  const dow = v.schedule_config.days_of_week ?? [];
  const isED = cat?.category === "Sexual Health";
  const dosePresets = (cat && DOSE_PRESETS[cat.slug]) || [];
  const hasPresets = dosePresets.length > 0;

  function setCfg(patch: Partial<ScheduleConfig>) {
    setV((s) => ({ ...s, schedule_config: { ...s.schedule_config, ...patch } }));
  }

  const valid = useMemo(() => {
    if (!v.display_name.trim()) return false;
    if (v.schedule_type !== "as_needed") {
      if (v.dose_amount == null || v.dose_amount <= 0) return false;
      if ((v.schedule_config.times ?? []).length === 0) return false;
    }
    if (v.schedule_type === "weekly_days" && dow.length === 0) return false;
    return true;
  }, [v, dow]);

  const inputCls = "w-full h-11 px-3 rounded-md border border-border bg-background text-sm";
  const labelCls = "label-mono text-[10.5px] text-muted-foreground";
  const chipBase = "h-9 px-3 rounded-md border text-xs whitespace-nowrap touch-manipulation transition-colors";
  const chipOn = "border-gold/60 bg-gold/10 text-gold";
  const chipOff = "border-border text-muted-foreground hover:text-foreground";

  const submitLabel = submitting
    ? "Saving…"
    : initial
      ? "Save changes"
      : v.dose_amount != null && v.dose_amount > 0 && v.schedule_type !== "as_needed"
        ? `Add · ${v.dose_amount} ${v.dose_unit}`
        : "Add medication";



  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(v); }}
      className="flex flex-col gap-3"
    >
      {/* Dose — native dropdown with prescriber-typical doses; falls back to stepper for Custom */}
      {v.schedule_type !== "as_needed" && (() => {
        const defaultUnit = cat?.default_unit ?? v.dose_unit ?? "mg";
        const stepBase = (cat && DOSE_STEPS[cat.slug]) ?? 0.5;
        const stepDose = (dir: 1 | -1) => {
          const cur = v.dose_amount ?? 0;
          const next = Math.max(0, Math.min(10000, roundStep(cur + dir * stepBase, stepBase)));
          setV({ ...v, dose_amount: next < stepBase / 2 ? stepBase : Number(next.toFixed(3)), dose_unit: v.dose_unit || defaultUnit });
        };
        const matchedPreset = hasPresets
          ? dosePresets.find((p) => p.a === v.dose_amount && p.u === v.dose_unit)
          : undefined;
        const selectValue = customDose
          ? "__custom"
          : matchedPreset
            ? `${matchedPreset.a}|${matchedPreset.u}`
            : "";
        return (
          <div className="space-y-2">
            <span className={labelCls}>Dose</span>

            {hasPresets && !customDose && (
              <div className="relative">
                <select
                  value={selectValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__custom") {
                      setCustomDose(true);
                      return;
                    }
                    if (!val) return;
                    const [aStr, u] = val.split("|");
                    setV({ ...v, dose_amount: Number(aStr), dose_unit: u });
                  }}
                  className="w-full h-12 pl-3 pr-9 rounded-md border border-border bg-background text-base appearance-none tabular-nums"
                  aria-label="Dose"
                >
                  <option value="" disabled>Choose dose…</option>
                  {dosePresets.map((p) => (
                    <option key={`${p.a}-${p.u}`} value={`${p.a}|${p.u}`}>
                      {p.a} {unitLabel(p.u, p.a)}
                    </option>
                  ))}
                  <option value="__custom">Custom amount…</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            )}

            {(customDose || !hasPresets) && (
              <div className="space-y-2">
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => stepDose(-1)}
                    className="h-12 w-12 rounded-md border border-border text-foreground/80 inline-flex items-center justify-center active:bg-accent touch-manipulation"
                    aria-label="Decrease dose"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number" step="any" min={0} max={10000}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-full h-12 pl-3 pr-14 rounded-md border border-border bg-background text-center text-lg font-medium tabular-nums"
                      value={v.dose_amount ?? ""}
                      onChange={(e) => setV({ ...v, dose_amount: e.target.value === "" ? null : Number(e.target.value), dose_unit: v.dose_unit || defaultUnit })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground tabular-nums pointer-events-none">
                      {unitLabel(v.dose_unit || defaultUnit, v.dose_amount ?? 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepDose(1)}
                    className="h-12 w-12 rounded-md border border-border text-foreground/80 inline-flex items-center justify-center active:bg-accent touch-manipulation"
                    aria-label="Increase dose"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {hasPresets && (
                  <button
                    type="button"
                    onClick={() => setCustomDose(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    ← Use a preset dose
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}


      {/* Schedule — 3 primary chips + More to reveal advanced */}
      <div className="space-y-1.5">
        <span className={labelCls}>Schedule</span>
        <div className="flex flex-wrap gap-1.5">
          {[...PRIMARY_SCHEDULES, ...(showMoreSchedules ? MORE_SCHEDULES : [])].map((s) => {
            const on = v.schedule_type === s.v;
            return (
              <button
                key={s.v}
                type="button"
                onClick={() => {
                  const next: ScheduleConfig = (() => {
                    if (s.v === "as_needed") return {};
                    if (s.v === "weekly_days") return { days_of_week: dow.length ? dow : [0], times: times.length ? times : [defaultTime] };
                    if (s.v === "every_n_days") return { every_n_days: v.schedule_config.every_n_days ?? 7, times: times.length ? times : [defaultTime] };
                    if (s.v === "cycle") return { cycle_on: v.schedule_config.cycle_on ?? 5, cycle_off: v.schedule_config.cycle_off ?? 2, times: times.length ? times : [defaultTime] };
                    return { times: times.length ? times : [defaultTime] };
                  })();
                  setV({ ...v, schedule_type: s.v, schedule_config: next });
                }}
                className={`${chipBase} ${on ? chipOn : chipOff}`}
              >
                {s.l}
              </button>
            );
          })}
          {!showMoreSchedules && (
            <button
              type="button"
              onClick={() => setShowMoreSchedules(true)}
              className={`${chipBase} ${chipOff}`}
            >
              More…
            </button>
          )}
        </div>
      </div>

      {isED && v.schedule_type === "as_needed" && (
        <p className="text-[11px] text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-[color:var(--bg-sunken)]/40 p-2.5">
          Typically taken before sex per your prescriber's label. No reminder will be scheduled —
          you'll log a dose when you take one.
        </p>
      )}

      {v.schedule_type === "weekly_days" && (
        <div className="space-y-1.5">
          <span className={labelCls}>Days</span>
          <div className="grid grid-cols-7 gap-1">
            {DOW.map((label, i) => {
              const on = dow.includes(i);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    const next = on ? dow.filter((d) => d !== i) : [...dow, i].sort();
                    setCfg({ days_of_week: next });
                  }}
                  className={`h-10 rounded border text-xs font-medium transition-colors ${
                    on ? "bg-gold text-gold-foreground border-gold" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {v.schedule_type === "every_n_days" && (
        <div className="space-y-1.5">
          <span className={labelCls}>Every N days</span>
          <input
            type="number" min={1} max={60}
            inputMode="numeric"
            className={inputCls}
            value={v.schedule_config.every_n_days ?? 7}
            onChange={(e) => setCfg({ every_n_days: Math.max(1, Number(e.target.value || 1)) })}
          />
        </div>
      )}

      {v.schedule_type === "cycle" && (
        <div className="space-y-1.5">
          <span className={labelCls}>Days on / off</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min={1} max={60} inputMode="numeric" aria-label="Days on" placeholder="On"
              className={inputCls}
              value={v.schedule_config.cycle_on ?? 5}
              onChange={(e) => setCfg({ cycle_on: Number(e.target.value || 1) })}
            />
            <input
              type="number" min={0} max={60} inputMode="numeric" aria-label="Days off" placeholder="Off"
              className={inputCls}
              value={v.schedule_config.cycle_off ?? 2}
              onChange={(e) => setCfg({ cycle_off: Number(e.target.value || 0) })}
            />
          </div>
        </div>
      )}

      {v.schedule_type !== "as_needed" && (
        <div className="space-y-1.5">
          <span className={labelCls}>Time{times.length > 1 ? "s" : ""}</span>
          <div className="space-y-1.5">
            {(times.length ? times : [defaultTime]).map((t, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <TimeDial
                    value={t}
                    ariaLabel={`Reminder time ${i + 1}`}
                    onChange={(next) => {
                      const arr = [...(times.length ? times : [defaultTime])];
                      arr[i] = next;
                      setCfg({ times: arr });
                    }}
                  />
                </div>
                {times.length > 1 && (
                  <button
                    type="button"
                    className="h-11 w-11 rounded-md border border-border text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setCfg({ times: times.filter((_, j) => j !== i) })}
                    aria-label="Remove time"
                  >
                    <X className="h-4 w-4 mx-auto" />
                  </button>
                )}
              </div>
            ))}
            {times.length <= 1 && (
              <p className="text-[10.5px] text-muted-foreground">
                Spaced 15 min after your wake-up so reminders don't pile up.
              </p>
            )}
            {times.length >= 1 && times.length < 6 && (
              <button
                type="button"
                onClick={() => setCfg({ times: [...times, suggestStaggeredTime(wakeTime, [...reservedTimes, ...times])] })}
                className="text-xs text-gold inline-flex items-center gap-1 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add another time
              </button>
            )}
          </div>
        </div>
      )}

      <details className="group rounded-md border border-border/60 bg-[color:var(--bg-sunken)]/30">
        <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span>More options (notes, shipment tracking)</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div className="space-y-1.5">
            <span className={labelCls}>Notes</span>
            <textarea
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              rows={2}
              maxLength={500}
              value={v.notes ?? ""}
              onChange={(e) => setV({ ...v, notes: e.target.value || null })}
              placeholder="e.g. With food. Right thigh."
              autoCapitalize="sentences"
            />
          </div>
          <ShipmentForm
            value={v.shipment ?? { enabled: false, carrier: "USPS", tracking_number: "" }}
            onChange={(s) => setV({ ...v, shipment: s })}
          />
        </div>
      </details>

      <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
        <Phone className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
        Severe reaction, chest pain, fainting, or erection &gt;4 hours — call 911 or go to the nearest ER.
      </p>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border/60 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-md border border-border text-sm"
        >Cancel</button>
        <button
          type="submit"
          disabled={submitting || !valid}
          className="flex-1 h-11 rounded-md bg-gold text-gold-foreground text-sm font-medium disabled:opacity-60"
        >{submitLabel}</button>
      </div>
    </form>
  );
}
