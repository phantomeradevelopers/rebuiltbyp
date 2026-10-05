import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CatalogItem = {
  id: string;
  slug: string;
  brand_name: string;
  generic_name: string | null;
  category: string;
  source: string;
  default_unit: string;
  typical_route: string;
  guidance_text: string | null;
  sort_order: number;
};

export type ScheduleConfig = {
  days_of_week?: number[]; // 0=Sun..6=Sat
  times?: string[]; // "HH:mm"
  every_n_days?: number;
  cycle_on?: number;
  cycle_off?: number;
};

export type UserMedication = {
  id: string;
  catalog_id: string | null;
  display_name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  route: string | null;
  schedule_type: "daily" | "weekly_days" | "every_n_days" | "cycle" | "as_needed";
  schedule_config: ScheduleConfig;
  start_date: string;
  end_date: string | null;
  source_tag: string;
  notes: string | null;
  active: boolean;
  supply_remaining: number | null;
  supply_unit: string | null;
  low_supply_threshold: number;
  auto_decrement: boolean;
  created_at: string;
  updated_at: string;
};

export type DoseEvent = {
  id: string;
  medication_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: "pending" | "taken" | "skipped" | "missed";
  notes: string | null;
  medication: { display_name: string; dose_amount: number | null; dose_unit: string | null; route: string | null } | null;
};

const scheduleConfigSchema = z.object({
  days_of_week: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(8).optional(),
  every_n_days: z.number().int().min(1).max(60).optional(),
  cycle_on: z.number().int().min(1).max(60).optional(),
  cycle_off: z.number().int().min(0).max(60).optional(),
}).default({});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  catalog_id: z.string().uuid().nullable().optional(),
  display_name: z.string().min(1).max(120),
  dose_amount: z.number().min(0).max(10000).nullable().optional(),
  dose_unit: z.string().max(20).nullable().optional(),
  route: z.string().max(20).nullable().optional(),
  schedule_type: z.enum(["daily", "weekly_days", "every_n_days", "cycle", "as_needed"]),
  schedule_config: scheduleConfigSchema,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  source_tag: z.enum(["candyrx", "other"]).default("other"),
  notes: z.string().max(500).nullable().optional(),
  rx_acknowledged: z.boolean().optional(),
});

export const listMedicationCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("medication_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Could not load medication list.");
    return (data ?? []) as CatalogItem[];
  });

export const getWakeTime = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    wake_time: string;
    midday_time: string;
    evening_time: string;
    used_times: string[];
  }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_profile")
      .select("reminder_time_local, reminder_time_midday_local, reminder_time_evening_local")
      .eq("user_id", userId)
      .maybeSingle();
    const pick = (raw: string | null | undefined, fallback: string) => {
      const v = raw ?? fallback;
      const m = v.match(/^(\d{1,2}):(\d{2})/);
      return m ? `${m[1].padStart(2, "0")}:${m[2]}` : fallback;
    };
    const p = data as {
      reminder_time_local?: string;
      reminder_time_midday_local?: string;
      reminder_time_evening_local?: string;
    } | null;
    const wake_time = pick(p?.reminder_time_local, "07:00");
    const midday_time = pick(p?.reminder_time_midday_local, "12:30");
    const evening_time = pick(p?.reminder_time_evening_local, "20:00");

    // Pull all times already used by the user's active meds so we can stagger.
    const { data: meds } = await supabase
      .from("user_medications")
      .select("schedule_config")
      .eq("user_id", userId)
      .eq("active", true);
    const used = new Set<string>();
    for (const m of (meds ?? []) as { schedule_config: ScheduleConfig | null }[]) {
      for (const t of m.schedule_config?.times ?? []) used.add(t);
    }
    return { wake_time, midday_time, evening_time, used_times: [...used] };
  });


export const listUserMedications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserMedication[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_medications")
      .select("*")
      .eq("user_id", userId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load your medications.");
    return (data ?? []) as unknown as UserMedication[];
  });

export const upsertUserMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      catalog_id: data.catalog_id ?? null,
      display_name: data.display_name,
      dose_amount: data.dose_amount ?? null,
      dose_unit: data.dose_unit ?? null,
      route: data.route ?? null,
      schedule_type: data.schedule_type,
      schedule_config: data.schedule_config,
      start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: data.end_date ?? null,
      source_tag: data.source_tag,
      notes: data.notes ?? null,
      active: true,
      ...(data.rx_acknowledged ? { rx_acknowledged_at: new Date().toISOString() } : {}),
    };
    if (data.id) {
      const { error } = await supabase
        .from("user_medications").update(row).eq("id", data.id).eq("user_id", userId);
      if (error) throw new Error("Could not update medication.");
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("user_medications").insert(row).select("id").single();
    if (error || !created) throw new Error("Could not save medication.");
    return { id: created.id };
  });

export const archiveMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_medications")
      .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error("Could not archive.");
    return { ok: true };
  });

export const deleteMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_medications").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error("Could not delete.");
    return { ok: true };
  });

/**
 * Compute scheduled dose times for a single medication over a date range.
 * Pure JS (no DB calls). Used by getDoses + materialization.
 */
function computeScheduleForRange(med: UserMedication, fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T23:59:59");
  const cfg = med.schedule_config ?? {};
  const times = (cfg.times && cfg.times.length ? cfg.times : ["09:00"]);
  if (med.schedule_type === "as_needed") return [];

  const start = new Date(med.start_date + "T00:00:00");
  const end = med.end_date ? new Date(med.end_date + "T23:59:59") : null;

  for (let d = new Date(Math.max(from.getTime(), start.getTime())); d <= to; d.setDate(d.getDate() + 1)) {
    if (end && d > end) break;
    const dow = d.getDay();
    let include = false;
    if (med.schedule_type === "daily") {
      include = true;
    } else if (med.schedule_type === "weekly_days") {
      include = (cfg.days_of_week ?? []).includes(dow);
    } else if (med.schedule_type === "every_n_days") {
      const n = cfg.every_n_days ?? 1;
      const diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      include = diffDays >= 0 && diffDays % n === 0;
    } else if (med.schedule_type === "cycle") {
      const on = cfg.cycle_on ?? 5;
      const off = cfg.cycle_off ?? 2;
      const period = on + off;
      const diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      include = diffDays >= 0 && (diffDays % period) < on;
    }
    if (!include) continue;
    for (const t of times) {
      const [hh, mm] = t.split(":").map(Number);
      const dt = new Date(d);
      dt.setHours(hh, mm, 0, 0);
      if (dt >= from && dt <= to) out.push(dt.toISOString());
    }
  }
  return out;
}

/**
 * Get today's scheduled doses, virtualizing missing rows on-the-fly.
 * Returns one item per scheduled time, joined with logged status if it exists.
 */
export const getTodayDoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoseEvent[]> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = today + "T00:00:00";
    const endOfDay = today + "T23:59:59";

    const [{ data: meds }, { data: logged }] = await Promise.all([
      supabase.from("user_medications").select("*").eq("user_id", userId).eq("active", true),
      supabase.from("medication_doses").select("*")
        .eq("user_id", userId)
        .gte("scheduled_at", new Date(startOfDay).toISOString())
        .lte("scheduled_at", new Date(endOfDay).toISOString()),
    ]);

    const out: DoseEvent[] = [];
    for (const m of (meds ?? []) as unknown as UserMedication[]) {
      const slots = computeScheduleForRange(m, today, today);
      for (const slot of slots) {
        const existing = (logged ?? []).find(
          (l: any) => l.medication_id === m.id && new Date(l.scheduled_at).toISOString() === slot
        );
        out.push({
          id: existing?.id ?? `virt-${m.id}-${slot}`,
          medication_id: m.id,
          scheduled_at: slot,
          taken_at: existing?.taken_at ?? null,
          status: (existing?.status as DoseEvent["status"]) ?? "pending",
          notes: existing?.notes ?? null,
          medication: {
            display_name: m.display_name,
            dose_amount: m.dose_amount,
            dose_unit: m.dose_unit,
            route: m.route,
          },
        });
      }
    }
    out.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return out;
  });

export const logDose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      medication_id: z.string().uuid(),
      scheduled_at: z.string().datetime(),
      status: z.enum(["taken", "skipped"]),
      notes: z.string().max(280).nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Look at any prior log for this slot so we can keep supply accounting honest.
    const { data: prior } = await supabase
      .from("medication_doses")
      .select("status")
      .eq("medication_id", data.medication_id)
      .eq("scheduled_at", data.scheduled_at)
      .maybeSingle();
    const wasTaken = prior?.status === "taken";

    const { error } = await supabase.from("medication_doses").upsert(
      {
        user_id: userId,
        medication_id: data.medication_id,
        scheduled_at: data.scheduled_at,
        taken_at: data.status === "taken" ? new Date().toISOString() : null,
        status: data.status,
        notes: data.notes ?? null,
      },
      { onConflict: "medication_id,scheduled_at" }
    );
    if (error) throw new Error("Could not log dose.");

    // Supply accounting: decrement on first "taken", restore on "taken → skipped".
    const delta = (!wasTaken && data.status === "taken")
      ? -1
      : (wasTaken && data.status === "skipped" ? 1 : 0);
    if (delta !== 0) {
      const { data: med } = await supabase
        .from("user_medications")
        .select("supply_remaining, auto_decrement")
        .eq("id", data.medication_id)
        .eq("user_id", userId)
        .maybeSingle();
      const m = med as { supply_remaining: number | null; auto_decrement: boolean } | null;
      if (m?.auto_decrement && m.supply_remaining != null) {
        const next = Math.max(0, m.supply_remaining + delta);
        await supabase
          .from("user_medications")
          .update({ supply_remaining: next })
          .eq("id", data.medication_id)
          .eq("user_id", userId);
      }
    }
    return { ok: true };
  });

export const setMedicationSupply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      supply_remaining: z.number().min(0).max(100000).nullable(),
      supply_unit: z.string().max(20).nullable().optional(),
      low_supply_threshold: z.number().int().min(0).max(365).optional(),
      auto_decrement: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      supply_remaining: number | null;
      supply_unit?: string | null;
      low_supply_threshold?: number;
      auto_decrement?: boolean;
    } = { supply_remaining: data.supply_remaining };
    if (data.supply_unit !== undefined) patch.supply_unit = data.supply_unit;
    if (data.low_supply_threshold !== undefined) patch.low_supply_threshold = data.low_supply_threshold;
    if (data.auto_decrement !== undefined) patch.auto_decrement = data.auto_decrement;
    const { error } = await supabase
      .from("user_medications")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Could not update supply.");
    return { ok: true };
  });

export type LowSupplyAlert = {
  id: string;
  display_name: string;
  supply_remaining: number;
  supply_unit: string | null;
  low_supply_threshold: number;
  severity: "out" | "critical" | "low";
};

export const getLowSupplyMedications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LowSupplyAlert[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_medications")
      .select("id, display_name, supply_remaining, supply_unit, low_supply_threshold")
      .eq("user_id", userId)
      .eq("active", true)
      .not("supply_remaining", "is", null);
    const rows = (data ?? []) as Array<{
      id: string;
      display_name: string;
      supply_remaining: number;
      supply_unit: string | null;
      low_supply_threshold: number;
    }>;
    return rows
      .filter((r) => r.supply_remaining <= r.low_supply_threshold)
      .map((r): LowSupplyAlert => ({
        ...r,
        severity:
          r.supply_remaining <= 0
            ? "out"
            : r.supply_remaining <= Math.max(2, Math.floor(r.low_supply_threshold / 2))
              ? "critical"
              : "low",
      }))
      .sort((a, b) => a.supply_remaining - b.supply_remaining);
  });


export type DoseHistoryRow = {
  id: string;
  medication_id: string;
  display_name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  route: string | null;
  scheduled_at: string;
  taken_at: string | null;
  status: "pending" | "taken" | "skipped" | "missed";
  notes: string | null;
};

export const listDoseHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      medication_id: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(2000).default(500),
    }).parse(input ?? {})
  )
  .handler(async ({ data, context }): Promise<DoseHistoryRow[]> => {
    const { supabase, userId } = context;
    const to = data.to ?? new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setDate(fromDefault.getDate() - 29);
    const from = data.from ?? fromDefault.toISOString().slice(0, 10);

    let q = supabase
      .from("medication_doses")
      .select("id, medication_id, scheduled_at, taken_at, status, notes")
      .eq("user_id", userId)
      .gte("scheduled_at", new Date(from + "T00:00:00").toISOString())
      .lte("scheduled_at", new Date(to + "T23:59:59").toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(data.limit);
    if (data.medication_id) q = q.eq("medication_id", data.medication_id);

    const { data: rows, error } = await q;
    if (error) throw new Error("Could not load dose history.");

    const medIds = Array.from(new Set((rows ?? []).map((r: any) => r.medication_id)));
    let medMap = new Map<string, { display_name: string; dose_amount: number | null; dose_unit: string | null; route: string | null }>();
    if (medIds.length) {
      const { data: meds } = await supabase
        .from("user_medications")
        .select("id, display_name, dose_amount, dose_unit, route")
        .in("id", medIds);
      for (const m of (meds ?? []) as any[]) {
        medMap.set(m.id, { display_name: m.display_name, dose_amount: m.dose_amount, dose_unit: m.dose_unit, route: m.route });
      }
    }

    return (rows ?? []).map((r: any): DoseHistoryRow => {
      const m = medMap.get(r.medication_id);
      return {
        id: r.id,
        medication_id: r.medication_id,
        display_name: m?.display_name ?? "Unknown",
        dose_amount: m?.dose_amount ?? null,
        dose_unit: m?.dose_unit ?? null,
        route: m?.route ?? null,
        scheduled_at: r.scheduled_at,
        taken_at: r.taken_at,
        status: r.status,
        notes: r.notes,
      };
    });
  });
