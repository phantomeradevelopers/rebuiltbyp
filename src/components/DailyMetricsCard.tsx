import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Footprints, Moon, HeartPulse, Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getTodayMetrics,
  upsertDailyMetrics,
  type DailyMetricsRow,
} from "@/lib/wearables/metrics.functions";

type FieldKey = "steps" | "sleep_hours" | "resting_heart_rate" | "weight_kg";

type FieldState = {
  steps: string;
  sleep_hours: string;
  resting_heart_rate: string;
  weight_kg: string;
};

function rowToState(row: DailyMetricsRow | null): FieldState {
  return {
    steps: row?.steps != null ? String(row.steps) : "",
    sleep_hours: row?.sleep_minutes != null ? (row.sleep_minutes / 60).toFixed(1) : "",
    resting_heart_rate: row?.resting_heart_rate != null ? String(row.resting_heart_rate) : "",
    weight_kg: row?.weight_kg != null ? String(row.weight_kg) : "",
  };
}

export function DailyMetricsCard() {
  const getFn = useServerFn(getTodayMetrics);
  const saveFn = useServerFn(upsertDailyMetrics);

  const today = new Date().toISOString().slice(0, 10);
  const query = useQuery({ queryKey: ["today-metrics"], queryFn: () => getFn() });

  const [values, setValues] = useState<FieldState>(rowToState(null));
  const [saving, setSaving] = useState<FieldKey | null>(null);

  useEffect(() => {
    if (query.data !== undefined) setValues(rowToState(query.data));
  }, [query.data]);

  async function commit(field: FieldKey) {
    const raw = values[field].trim();

    const payload: Record<string, number | null | string> = { metric_date: today };
    if (field === "steps") {
      payload.steps = raw === "" ? null : Number.parseInt(raw, 10);
      if (raw !== "" && Number.isNaN(payload.steps as number)) return;
    } else if (field === "sleep_hours") {
      const hrs = raw === "" ? null : Number.parseFloat(raw);
      if (raw !== "" && (hrs === null || Number.isNaN(hrs))) return;
      payload.sleep_minutes = hrs === null ? null : Math.round(hrs * 60);
    } else if (field === "resting_heart_rate") {
      payload.resting_heart_rate = raw === "" ? null : Number.parseInt(raw, 10);
      if (raw !== "" && Number.isNaN(payload.resting_heart_rate as number)) return;
    } else if (field === "weight_kg") {
      payload.weight_kg = raw === "" ? null : Number.parseFloat(raw);
      if (raw !== "" && Number.isNaN(payload.weight_kg as number)) return;
    }

    setSaving(field);
    try {
      await saveFn({ data: payload as never });
      query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  const isEmpty =
    !values.steps && !values.sleep_hours && !values.resting_heart_rate && !values.weight_kg;

  return (
    <section className="card-elevated p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold font-medium">
            Today's numbers
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isEmpty ? "Log it. We'll track the streak." : "Tap to edit. Saves on blur."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricField
          icon={<Footprints className="h-4 w-4 text-gold" />}
          label="Steps"
          suffix=""
          inputMode="numeric"
          placeholder="0"
          value={values.steps}
          saving={saving === "steps"}
          onChange={(v) => setValues((s) => ({ ...s, steps: v }))}
          onBlur={() => commit("steps")}
        />
        <MetricField
          icon={<Moon className="h-4 w-4 text-gold" />}
          label="Sleep"
          suffix="hrs"
          inputMode="decimal"
          placeholder="0.0"
          value={values.sleep_hours}
          saving={saving === "sleep_hours"}
          onChange={(v) => setValues((s) => ({ ...s, sleep_hours: v }))}
          onBlur={() => commit("sleep_hours")}
        />
        <MetricField
          icon={<HeartPulse className="h-4 w-4 text-gold" />}
          label="Resting HR"
          suffix="bpm"
          inputMode="numeric"
          placeholder="0"
          value={values.resting_heart_rate}
          saving={saving === "resting_heart_rate"}
          onChange={(v) => setValues((s) => ({ ...s, resting_heart_rate: v }))}
          onBlur={() => commit("resting_heart_rate")}
        />
        <MetricField
          icon={<Scale className="h-4 w-4 text-gold" />}
          label="Weight"
          suffix="kg"
          inputMode="decimal"
          placeholder="0.0"
          value={values.weight_kg}
          saving={saving === "weight_kg"}
          onChange={(v) => setValues((s) => ({ ...s, weight_kg: v }))}
          onBlur={() => commit("weight_kg")}
        />
      </div>
    </section>
  );
}

function MetricField({
  icon,
  label,
  suffix,
  value,
  saving,
  inputMode,
  placeholder,
  onChange,
  onBlur,
}: {
  icon: React.ReactNode;
  label: string;
  suffix: string;
  value: string;
  saving: boolean;
  inputMode: "numeric" | "decimal";
  placeholder: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="rounded-lg border border-border bg-background/40 p-3 block">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-[0.14em]">{label}</span>
        {saving && <Loader2 className="h-3 w-3 animate-spin ml-auto text-gold" />}
      </div>
      <div className="flex items-baseline gap-1 mt-2">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="font-serif text-2xl bg-transparent outline-none w-full min-w-0 placeholder:text-muted-foreground/40"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
