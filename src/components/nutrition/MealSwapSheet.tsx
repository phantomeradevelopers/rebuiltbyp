import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { regenerateMeal, commitMealOverride, type RegeneratedMeal } from "@/lib/meal-regenerate.functions";
import { RefreshCw, Check, Clock, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: number;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  targetCalories: number;
  targetProteinG: number;
  currentName: string;
};

type AltState =
  | { status: "loading" }
  | { status: "ok"; meal: RegeneratedMeal }
  | { status: "error"; message: string };

export function MealSwapSheet({ open, onOpenChange, day, slot, targetCalories, targetProteinG, currentName }: Props) {
  const qc = useQueryClient();
  const [alts, setAlts] = useState<AltState[]>([{ status: "loading" }, { status: "loading" }, { status: "loading" }]);
  const [committing, setCommitting] = useState<number | null>(null);

  async function loadAlternatives() {
    setAlts([{ status: "loading" }, { status: "loading" }, { status: "loading" }]);
    const seen: string[] = [currentName];
    // fire 3 in parallel
    const promises = [0, 1, 2].map((i) =>
      regenerateMeal({
        data: {
          day,
          slot,
          target_calories: targetCalories,
          target_protein_g: targetProteinG,
          previous_name: currentName,
          avoid_names: seen.slice(),
          preview: true,
          dislike_reason: i === 1 ? "want something different in flavor" : i === 2 ? "want a different cuisine" : undefined,
        },
      })
        .then((r) => {
          if (r.meal?.name) seen.push(r.meal.name);
          return { i, meal: r.meal };
        })
        .catch((e: Error) => ({ i, error: e.message || "Couldn't generate." })),
    );
    const results = await Promise.all(promises);
    setAlts((prev) => {
      const next = [...prev];
      for (const r of results) {
        if ("error" in r) next[r.i] = { status: "error", message: r.error };
        else next[r.i] = { status: "ok", meal: r.meal };
      }
      return next;
    });
  }

  useEffect(() => {
    if (open) loadAlternatives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pick(i: number) {
    const a = alts[i];
    if (a.status !== "ok") return;
    haptic("success");
    setCommitting(i);
    try {
      await commitMealOverride({ data: { day, slot, meal: a.meal } });
      toast.success("Meal swapped.");
      qc.invalidateQueries({ queryKey: ["meal-overrides"] });
      qc.invalidateQueries({ queryKey: ["nutrition-today"] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save.");
    } finally {
      setCommitting(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88vh] overflow-y-auto border-t border-[color:var(--border-strong,rgba(255,255,255,0.10))] bg-[color:var(--bg-raised,#141416)] rounded-t-[24px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-1 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <SheetHeader className="text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
            Swap meal
          </p>
          <SheetTitle className="font-display text-2xl capitalize text-[color:var(--text-primary,#fff)]">
            Swap {slot}
          </SheetTitle>
          <SheetDescription className="text-[color:var(--text-secondary,rgba(255,255,255,0.65))]">
            Pick a replacement. Macros stay within ±10% of your target.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary,rgba(255,255,255,0.45))]">
            3 alternatives
          </p>
          <button
            onClick={loadAlternatives}
            disabled={alts.some((a) => a.status === "loading") || committing !== null}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-[color:var(--text-secondary,rgba(255,255,255,0.7))] hover:text-[color:var(--text-primary,#fff)] active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${alts.some((a) => a.status === "loading") ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 space-y-3 pb-6">
          <AnimatePresence initial={false}>
            {alts.map((a, i) => (
              <motion.article
                key={`${i}-${a.status === "ok" ? a.meal.name : a.status}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-4"
              >
                {a.status === "loading" && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-[color:var(--rebuilt-gold,#d4af37)]/30 border-t-[color:var(--rebuilt-gold,#d4af37)] animate-spin" />
                    <p className="text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.6))]">Generating option {i + 1}…</p>
                  </div>
                )}
                {a.status === "error" && (
                  <div className="py-3">
                    <p className="text-sm text-rose-300">{a.message}</p>
                    <button onClick={loadAlternatives} className="mt-2 text-xs underline text-[color:var(--rebuilt-gold,#d4af37)]">Try again</button>
                  </div>
                )}
                {a.status === "ok" && (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Option {i + 1}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] inline-flex items-center gap-1 text-[color:var(--text-tertiary,rgba(255,255,255,0.5))]">
                        <Clock className="h-3 w-3" /> {a.meal.prep_minutes} min
                      </p>
                    </div>
                    <h3 className="mt-1.5 font-display text-lg leading-snug text-[color:var(--text-primary,#fff)]">{a.meal.name}</h3>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <Pill label="Kcal" value={`${a.meal.calories}`} icon={<Flame className="h-3 w-3" />} />
                      <Pill label="Protein" value={`${a.meal.protein_g}g`} />
                      <Pill label="Carbs" value={`${a.meal.carbs_g}g`} />
                      <Pill label="Fat" value={`${a.meal.fat_g}g`} />
                    </div>
                    {a.meal.swap_note && (
                      <p className="mt-2.5 text-xs text-[color:var(--text-secondary,rgba(255,255,255,0.6))] italic leading-snug">{a.meal.swap_note}</p>
                    )}
                    <button
                      onClick={() => pick(i)}
                      disabled={committing !== null}
                      className="mt-3 w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50 shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
                    >
                      {committing === i ? (
                        <>
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" /> Use this meal
                        </>
                      )}
                    </button>
                  </>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Pill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[color:var(--bg-raised,#141416)] border border-[color:var(--border-hairline,rgba(255,255,255,0.06))] px-2 py-1.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-tertiary,rgba(255,255,255,0.45))] inline-flex items-center justify-center gap-1">{icon}{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold text-[color:var(--text-primary,#fff)] tabular-nums">{value}</p>
    </div>
  );
}
