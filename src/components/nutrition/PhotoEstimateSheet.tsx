// AI photo estimate confirm sheet. Shown after the camera flow returns a
// vision-model estimate (or after it fails). User can edit values, add a
// note, retry on failure, or log the meal.
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Sparkles, Check, X, Pencil, RotateCw, AlertTriangle } from "lucide-react";
import type { MealEstimate } from "@/lib/meal-estimator.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: MealEstimate | null;
  busy?: boolean;
  /** Error message when the estimate call failed; sheet shows a retry view. */
  error?: string | null;
  /** Whether a retry is currently in-flight. */
  retrying?: boolean;
  onRetry?: () => void;
  onLog: (final: {
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    note: string;
  }) => void | Promise<void>;
};

const CONFIDENCE_META = {
  high:   { color: "text-emerald-300", dot: "bg-emerald-400", hint: "AI is fairly sure — quick glance and log." },
  medium: { color: "text-amber-300",   dot: "bg-amber-400",   hint: "Worth a quick double-check before logging." },
  low:    { color: "text-rose-300",    dot: "bg-rose-400",    hint: "Likely off — edit the numbers that look wrong." },
} as const;

export function PhotoEstimateSheet({
  open, onOpenChange, estimate, busy, error, retrying, onRetry, onLog,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [cal, setCal] = useState(0);
  const [p, setP] = useState(0);
  const [c, setC] = useState(0);
  const [f, setF] = useState(0);

  useEffect(() => {
    if (estimate) {
      setName(estimate.name);
      setCal(estimate.calories);
      setP(estimate.protein_g);
      setC(estimate.carbs_g);
      setF(estimate.fat_g);
      setNote("");
      // Auto-open the edit affordance for low-confidence estimates so the
      // user immediately sees the values are editable.
      setEditing(estimate.confidence === "low");
    }
  }, [estimate]);

  if (!estimate && !error) return null;

  const meta = estimate ? CONFIDENCE_META[estimate.confidence] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto border-t border-[color:var(--border-strong,rgba(255,255,255,0.10))] bg-[color:var(--bg-raised,#141416)] rounded-t-[24px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-1 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <SheetHeader className="text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> AI estimate
          </p>
          <SheetTitle className="font-display text-2xl text-[color:var(--text-primary,#fff)]">
            {error ? "Couldn't read the photo" : "Confirm your meal"}
          </SheetTitle>
          <SheetDescription className="text-[color:var(--text-secondary,rgba(255,255,255,0.65))]">
            {error
              ? "The vision model didn't return a usable estimate. Try again, or close and re-take the photo."
              : "Estimated from your photo. Edit anything that's off, then log it."}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="mt-4 space-y-3 pb-6">
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rose-300">Estimate failed</p>
                  <p className="text-sm text-white/80 leading-snug break-words">{error}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenChange(false)}
                disabled={retrying}
                className="h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[color:var(--bg-elevated,#1c1c1f)] text-sm font-medium text-white/80 hover:text-white active:scale-[0.97] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Close
              </button>
              <button
                onClick={() => onRetry?.()}
                disabled={retrying || !onRetry}
                className="h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] text-sm font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-50 shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
              >
                {retrying ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                {retrying ? "Retrying…" : "Try again"}
              </button>
            </div>
          </div>
        ) : estimate && meta ? (
          <div className="mt-4 space-y-3 pb-6">
            <div className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`font-mono text-[10px] uppercase tracking-[0.2em] inline-flex items-center gap-1.5 ${meta.color}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {estimate.confidence} confidence
                </p>
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-[color:var(--text-secondary,rgba(255,255,255,0.7))] hover:text-white"
                >
                  <Pencil className="h-3 w-3" /> {editing ? "Done editing" : "Edit"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-white/55 leading-snug">{meta.hint}</p>

              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-3 w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-base font-display text-white"
                />
              ) : (
                <h3 className="mt-2 font-display text-xl leading-snug text-white">{name}</h3>
              )}

              <div className="mt-4 grid grid-cols-4 gap-2">
                <Field label="Kcal" value={cal} editing={editing} onChange={setCal} />
                <Field label="Protein" value={p} editing={editing} onChange={setP} suffix="g" />
                <Field label="Carbs" value={c} editing={editing} onChange={setC} suffix="g" />
                <Field label="Fat" value={f} editing={editing} onChange={setF} suffix="g" />
              </div>

              {estimate.advice && (
                <p className="mt-3 text-xs italic text-[color:var(--text-secondary,rgba(255,255,255,0.65))] leading-snug">
                  {estimate.advice}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-4">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 240))}
                placeholder="e.g. shared with someone, no sauce, larger portion"
                rows={2}
                className="mt-2 w-full resize-none bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
              />
              <p className="mt-1 text-[10px] text-white/35 tabular-nums text-right">{note.length}/240</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[color:var(--bg-elevated,#1c1c1f)] text-sm font-medium text-white/80 hover:text-white active:scale-[0.97] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                onClick={() => onLog({
                  name: name.slice(0, 120),
                  calories: Math.max(0, Math.round(cal)),
                  protein_g: Math.max(0, Math.round(p)),
                  carbs_g: Math.max(0, Math.round(c)),
                  fat_g: Math.max(0, Math.round(f)),
                  note: note.trim(),
                })}
                disabled={busy || !name.trim()}
                className="h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] text-sm font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-50 shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
              >
                {busy ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {busy ? "Logging…" : "Log it"}
              </button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, editing, onChange, suffix }: { label: string; value: number; editing: boolean; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="rounded-lg bg-[color:var(--bg-raised,#141416)] border border-white/5 px-2 py-1.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{label}</p>
      {editing ? (
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="mt-0.5 w-full bg-transparent text-center font-display text-sm font-semibold text-white tabular-nums outline-none"
        />
      ) : (
        <p className="mt-0.5 font-display text-sm font-semibold text-white tabular-nums">
          {value}{suffix ?? ""}
        </p>
      )}
    </div>
  );
}
