/**
 * Cross-platform health data sync.
 *
 * - Native iOS (Capacitor): reads real data from HealthKit via the
 *   `capacitor-health` plugin. Sleep, resting HR, HRV (SDNN), and steps
 *   for the last 24h.
 * - Native Android (Capacitor): same plugin, Health Connect backend.
 * - Browser / preview: returns realistic mock data so readiness prefill
 *   works in development without a device.
 *
 * The plugin is dynamically imported so the web bundle never resolves it
 * at load time.
 */

export type HealthSample = {
  source: "healthkit" | "health_connect" | "mock" | "manual" | "apple_health_export";
  metric: "sleep_hours" | "resting_hr" | "hrv_ms" | "steps" | "workout_minutes";
  value: number;
  unit?: string;
  recorded_at: string; // ISO
};

type CapacitorGlobal = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => "ios" | "android" | "web";
  };
};

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as CapacitorGlobal).Capacitor?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  return (window as unknown as CapacitorGlobal).Capacitor?.getPlatform?.() ?? "web";
}

function mockSamples(): HealthSample[] {
  const now = new Date().toISOString();
  return [
    { source: "mock", metric: "sleep_hours", value: 7.2, unit: "h", recorded_at: now },
    { source: "mock", metric: "resting_hr", value: 58, unit: "bpm", recorded_at: now },
    { source: "mock", metric: "hrv_ms", value: 64, unit: "ms", recorded_at: now },
    { source: "mock", metric: "steps", value: 4820, unit: "ct", recorded_at: now },
  ];
}

// The `capacitor-health` plugin's typed surface. Kept narrow so we don't have
// to depend on plugin types at compile time.
type QueryOpts = {
  startDate: string;
  endDate: string;
  dataType: string;
  limit?: number;
};
type QueryResult = {
  aggregatedData?: { value: number; startDate?: string; endDate?: string }[];
  resultData?: { value: number; startDate?: string; endDate?: string; unit?: string }[];
};
type HealthPluginLike = {
  requestHealthPermissions?: (opts: { permissions: string[] }) => Promise<unknown>;
  isHealthAvailable?: () => Promise<{ available: boolean }>;
  queryAggregated?: (opts: QueryOpts & { bucket?: "day" | "hour" }) => Promise<QueryResult>;
  query?: (opts: QueryOpts) => Promise<QueryResult>;
};

const HK_TYPES = [
  "READ_STEPS",
  "READ_HEART_RATE",
  "READ_RESTING_HEART_RATE",
  "READ_HRV",
  "READ_SLEEP",
];

async function loadHealth(): Promise<HealthPluginLike | null> {
  try {
    const mod = (await import("capacitor-health")) as unknown as { Health?: HealthPluginLike };
    return mod.Health ?? null;
  } catch {
    return null;
  }
}

async function ensurePermissions(Health: HealthPluginLike): Promise<boolean> {
  try {
    const avail = await Health.isHealthAvailable?.();
    if (avail && !avail.available) return false;
    await Health.requestHealthPermissions?.({ permissions: HK_TYPES });
    return true;
  } catch {
    return false;
  }
}

function toIso(d: Date) {
  return d.toISOString();
}

async function safeQuery(
  Health: HealthPluginLike,
  dataType: string,
  startDate: string,
  endDate: string,
): Promise<number | null> {
  try {
    const res = (await Health.queryAggregated?.({ startDate, endDate, dataType, bucket: "day" })) ??
      (await Health.query?.({ startDate, endDate, dataType, limit: 1000 }));
    if (!res) return null;
    const arr = res.aggregatedData ?? res.resultData ?? [];
    if (!arr.length) return null;
    // For counts we sum; for HR/HRV we average.
    if (dataType === "READ_STEPS") {
      return arr.reduce((s, x) => s + (Number.isFinite(x.value) ? x.value : 0), 0);
    }
    const nums = arr.map((x) => x.value).filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  } catch {
    return null;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (!isNative()) return false;
  const Health = await loadHealth();
  if (!Health) return false;
  return ensurePermissions(Health);
}

export async function readRecentHealth(): Promise<HealthSample[]> {
  if (!isNative()) return mockSamples();
  const Health = await loadHealth();
  if (!Health) return [];
  const ok = await ensurePermissions(Health);
  if (!ok) return [];

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const startDate = toIso(start);
  const endDate = toIso(end);
  const source: HealthSample["source"] = nativePlatform() === "android" ? "health_connect" : "healthkit";
  const nowIso = endDate;

  const [steps, restingHr, hrv, sleepMinutes] = await Promise.all([
    safeQuery(Health, "READ_STEPS", startDate, endDate),
    safeQuery(Health, "READ_RESTING_HEART_RATE", startDate, endDate),
    safeQuery(Health, "READ_HRV", startDate, endDate),
    safeQuery(Health, "READ_SLEEP", startDate, endDate),
  ]);

  const out: HealthSample[] = [];
  if (steps != null) out.push({ source, metric: "steps", value: Math.round(steps), unit: "ct", recorded_at: nowIso });
  if (restingHr != null) out.push({ source, metric: "resting_hr", value: Math.round(restingHr), unit: "bpm", recorded_at: nowIso });
  if (hrv != null) out.push({ source, metric: "hrv_ms", value: Math.round(hrv), unit: "ms", recorded_at: nowIso });
  if (sleepMinutes != null) out.push({ source, metric: "sleep_hours", value: +(sleepMinutes / 60).toFixed(2), unit: "h", recorded_at: nowIso });
  return out;
}

export function summarizeForReadiness(samples: HealthSample[]) {
  const find = (m: HealthSample["metric"]) => samples.find((s) => s.metric === m)?.value;
  return {
    sleep_hours: find("sleep_hours") ?? null,
    resting_hr: find("resting_hr") ?? null,
    hrv_ms: find("hrv_ms") ?? null,
    steps: find("steps") ?? null,
  };
}
