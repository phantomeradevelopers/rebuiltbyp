import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Palmtree, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { getVacationStatus, setVacationMode, type VacationStatus } from "@/lib/vacation.functions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DAY_PRESETS = [3, 7, 14, 30];

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "traveling", label: "Traveling" },
  { value: "sick", label: "Sick / injured" },
  { value: "busy", label: "Busy week" },
  { value: "mental_health", label: "Mental health" },
  { value: "cant_eat", label: "Can't eat on plan" },
  { value: "cant_train", label: "Can't train" },
  { value: "other", label: "Other" },
];

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASON_OPTIONS.map((r) => [r.value, r.label]),
);

export function VacationCard() {
  const fetchStatus = useServerFn(getVacationStatus);
  const setMode = useServerFn(setVacationMode);
  const [status, setStatus] = useState<VacationStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setStatus(await fetchStatus());
      } catch (e) {
        console.error("vacation status", e);
      }
    })();
  }, [fetchStatus]);

  function toggleReason(value: string) {
    setSelectedReasons((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  }

  async function startWithDays(days: number) {
    await start({ days });
  }

  async function startWithDate(date: Date) {
    await start({ until: format(date, "yyyy-MM-dd") });
  }

  async function start(payload: { days?: number; until?: string }) {
    setSaving(true);
    try {
      const next = await setMode({
        data: {
          ...payload,
          reasons: selectedReasons as any,
          note: note.trim() ? note.trim().slice(0, 240) : null,
        },
      });
      setStatus(next);
      setSelectedReasons([]);
      setNote("");
      setCustomDate(undefined);
      setCustomOpen(false);
      toast.success(`Vacation set until ${next.vacationUntil}. Streaks frozen.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function end() {
    setSaving(true);
    try {
      const next = await setMode({ data: { days: 0 } });
      setStatus(next);
      toast.success("Welcome back. Pick up where you left off.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elevated p-5 space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Palmtree className="h-4 w-4" />
        <p className="label-mono">Vacation mode</p>
      </div>

      {status?.active ? (
        <>
          <p className="text-sm text-muted-foreground">
            Resting until{" "}
            <span className="text-foreground font-medium">{status.vacationUntil}</span>.
            Streaks are frozen. Nudges are off.
          </p>
          {status.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {status.reasons.map((r) => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                >
                  {REASON_LABEL[r] ?? r}
                </span>
              ))}
            </div>
          )}
          {status.note && (
            <p className="text-xs text-foreground/70 border-l-2 border-gold/40 pl-3">
              "{status.note}"
            </p>
          )}
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p><span className="text-foreground font-medium">Still available:</span> Coach chat, lessons, food library, weight log, journal.</p>
            <p><span className="text-foreground font-medium">Paused:</span> daily missions, streak counter, push & email nudges.</p>
          </div>
          <button
            onClick={end}
            disabled={saving}
            className="h-11 w-full rounded-md btn-gold text-sm font-medium disabled:opacity-50"
          >
            End vacation now
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Travelling, sick, or burning out? Pause missions and freeze your streak. No guilt, no broken progress.
          </p>

          <div className="space-y-2">
            <p className="label-mono text-xs text-muted-foreground">WHY (OPTIONAL)</p>
            <div className="flex flex-wrap gap-1.5">
              {REASON_OPTIONS.map((r) => {
                const active = selectedReasons.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleReason(r.value)}
                    className={cn(
                      "px-3 h-8 rounded-full border text-xs transition-colors",
                      active
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 240))}
            placeholder="Anything we should know? (optional)"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-gold focus:outline-none resize-none"
          />

          <div className="space-y-2">
            <p className="label-mono text-xs text-muted-foreground">HOW LONG</p>
            <div className="grid grid-cols-4 gap-2">
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => startWithDays(d)}
                  disabled={saving}
                  className="h-11 rounded-md border border-border bg-card text-sm hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
                >
                  {d}d
                </button>
              ))}
            </div>

            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-11 w-full rounded-md border border-border bg-card text-sm text-muted-foreground hover:border-gold hover:text-gold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {customDate ? `Until ${format(customDate, "PPP")}` : "Pick a return date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setCustomDate(d);
                    startWithDate(d);
                  }}
                  disabled={(date) => {
                    const tomorrow = new Date();
                    tomorrow.setHours(0, 0, 0, 0);
                    return date < tomorrow;
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
    </section>
  );
}
