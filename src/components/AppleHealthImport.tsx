import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Check, FileText, Loader2 } from "lucide-react";
import { importAppleHealthDays, type AppleHealthDay } from "@/lib/wearables/apple-health-import.functions";

/**
 * Manual Apple Health import — bridge for web users until the native iOS
 * app ships. Accepts the `export.xml` from an Apple Health export, parses
 * the last 90 days of Steps / RestingHeartRate / HRV(SDNN) / SleepAnalysis
 * in the browser, aggregates per-day, then bulk-upserts to the backend.
 *
 * XML is parsed with a streaming regex over `<Record ... />` lines instead
 * of DOMParser so multi-hundred-MB exports don't blow up memory.
 */

type Agg = {
  steps: number;
  sleepMinutes: number;
  hrSum: number;
  hrCount: number;
  hrvSum: number;
  hrvCount: number;
};

function emptyAgg(): Agg {
  return { steps: 0, sleepMinutes: 0, hrSum: 0, hrCount: 0, hrvSum: 0, hrvCount: 0 };
}

const RECORD_RE = /<Record\b([^>]*?)\/?>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

function parseAttrs(chunk: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(chunk))) out[m[1]] = m[2];
  return out;
}

function isoDate(d: string): string | null {
  // Apple format: "2025-01-14 07:12:03 -0800"
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(d);
  return m ? m[1] : null;
}

async function parseAppleHealthXml(
  file: File,
  onProgress: (pct: number) => void,
): Promise<AppleHealthDay[]> {
  const byDay = new Map<string, Agg>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let read = 0;
  const total = file.size || 1;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    read += value.byteLength;
    buffer += decoder.decode(value, { stream: true });

    // Only parse up to the last full record boundary; keep the tail for next chunk.
    const lastGt = buffer.lastIndexOf(">");
    if (lastGt < 0) continue;
    const parseable = buffer.slice(0, lastGt + 1);
    buffer = buffer.slice(lastGt + 1);

    let m: RegExpExecArray | null;
    RECORD_RE.lastIndex = 0;
    while ((m = RECORD_RE.exec(parseable))) {
      const attrs = parseAttrs(m[1]);
      const type = attrs.type;
      if (!type) continue;
      const startRaw = attrs.startDate || attrs.creationDate;
      const day = startRaw ? isoDate(startRaw) : null;
      if (!day || day < cutoffStr) continue;
      const value = parseFloat(attrs.value ?? "");
      if (!Number.isFinite(value)) continue;
      let agg = byDay.get(day);
      if (!agg) { agg = emptyAgg(); byDay.set(day, agg); }

      switch (type) {
        case "HKQuantityTypeIdentifierStepCount":
          agg.steps += value;
          break;
        case "HKQuantityTypeIdentifierRestingHeartRate":
          agg.hrSum += value; agg.hrCount += 1;
          break;
        case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
          agg.hrvSum += value; agg.hrvCount += 1;
          break;
        case "HKCategoryTypeIdentifierSleepAnalysis": {
          // Sleep is a duration between startDate and endDate; value is a stage.
          const endRaw = attrs.endDate;
          if (!endRaw) break;
          // Only count actual asleep stages (skip InBed).
          const v = attrs.value;
          const isAsleep = /Asleep|Core|Deep|REM/i.test(v ?? "");
          if (!isAsleep) break;
          const startMs = Date.parse(startRaw.replace(" ", "T").replace(/ ([-+]\d{2})(\d{2})$/, "$1:$2"));
          const endMs = Date.parse(endRaw.replace(" ", "T").replace(/ ([-+]\d{2})(\d{2})$/, "$1:$2"));
          if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
            agg.sleepMinutes += (endMs - startMs) / 60000;
          }
          break;
        }
      }
    }
    onProgress(Math.min(0.98, read / total));
  }

  onProgress(1);

  const days: AppleHealthDay[] = [];
  for (const [date, a] of byDay) {
    days.push({
      metric_date: date,
      steps: a.steps > 0 ? Math.round(a.steps) : null,
      sleep_minutes: a.sleepMinutes > 0 ? Math.round(a.sleepMinutes) : null,
      resting_heart_rate: a.hrCount > 0 ? Math.round(a.hrSum / a.hrCount) : null,
      hrv_ms: a.hrvCount > 0 ? +(a.hrvSum / a.hrvCount).toFixed(1) : null,
    });
  }
  days.sort((x, y) => (x.metric_date < y.metric_date ? -1 : 1));
  return days;
}

export function AppleHealthImport() {
  const importFn = useServerFn(importAppleHealthDays);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setPct(0); setStatus("Reading export…"); setLastCount(null);
    try {
      const days = await parseAppleHealthXml(file, (p) => setPct(p));
      if (!days.length) {
        toast.error("No health records found in that export.");
        return;
      }
      setStatus(`Uploading ${days.length} days…`);
      const res = await importFn({ data: { days } });
      setLastCount(res.imported);
      toast.success(`Imported ${res.imported} days from Apple Health.`);
    } catch (err) {
      toast.error((err as Error).message || "Import failed");
    } finally {
      setBusy(false); setPct(0); setStatus("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="card-elevated p-5 space-y-3">
      <div className="flex items-center gap-2 text-gold">
        <Apple />
        <p className="label-mono">Apple Health · Manual import</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Bridge for web users. Open Apple Health on iPhone → tap your profile →
        Export All Health Data → unzip → upload <code className="text-foreground/80">export.xml</code>.
        We parse the last 90 days of sleep, resting HR, HRV, and steps.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={onFile}
          disabled={busy}
          className="hidden"
          id="apple-health-file"
        />
        <label
          htmlFor="apple-health-file"
          className={`inline-flex items-center gap-2 h-10 px-4 rounded-md text-xs font-medium border border-gold/40 text-gold hover:bg-gold/10 cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? status || "Working…" : "Upload export.xml"}
        </label>
        {lastCount != null && (
          <span className="inline-flex items-center gap-1 text-xs text-gold">
            <Check className="h-3.5 w-3.5" /> {lastCount} days imported
          </span>
        )}
        <a
          href="https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios"
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <FileText className="h-3.5 w-3.5" /> How to export
        </a>
      </div>
      {busy && (
        <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
          <div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

function Apple() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M16.365 12.86c.02 2.19 1.92 2.92 1.94 2.93-.01.05-.31 1.06-1.02 2.1-.62.9-1.26 1.79-2.27 1.81-.99.02-1.31-.59-2.44-.59-1.13 0-1.49.57-2.43.61-.98.04-1.72-.97-2.34-1.87-1.27-1.83-2.24-5.17-.94-7.43.65-1.12 1.8-1.83 3.06-1.85.96-.02 1.87.65 2.46.65.59 0 1.7-.8 2.86-.68.49.02 1.86.2 2.74 1.5-.07.05-1.64.96-1.62 2.82zM14.7 6.86c.53-.64.88-1.53.78-2.42-.76.03-1.68.51-2.22 1.15-.48.57-.9 1.48-.79 2.35.85.07 1.71-.43 2.23-1.08z" />
    </svg>
  );
}
