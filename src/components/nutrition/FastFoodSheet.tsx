// Fast-food chain picker (2-step bottom sheet). Stages a preview on the
// meal card; the user must press Done on the card to commit it.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { swapMealForFastFood, type FastFoodMeal } from "@/lib/meal-fastfood.functions";
import { ChevronLeft, Check, Clock, RefreshCw, Utensils } from "lucide-react";
import { haptic } from "@/lib/haptics";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: number;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  targetCalories: number;
  targetProteinG: number;
  currentName: string;
  onStage: (meal: FastFoodMeal) => void;
};

const DEFAULT_CHAINS = [
  "Chipotle",
  "Sweetgreen",
  "Chick-fil-A",
  "Panera",
  "Cava",
  "Subway",
  "McDonald's",
  "Wendy's",
  "Taco Bell",
  "Starbucks",
];

export function FastFoodSheet({ open, onOpenChange, day, slot, targetCalories, targetProteinG, currentName, onStage }: Props) {
  const [chain, setChain] = useState<string | null>(null);
  const [preview, setPreview] = useState<FastFoodMeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committing] = useState(false);

  const chains = DEFAULT_CHAINS;

  useEffect(() => {
    if (!open) {
      setChain(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  async function loadPreview(chosenChain: string) {
    setChain(chosenChain);
    setPreview(null);
    setError(null);
    setLoading(true);
    try {
      const r = await swapMealForFastFood({
        data: {
          day,
          slot,
          target_calories: targetCalories,
          target_protein_g: targetProteinG,
          previous_name: currentName,
          chain: chosenChain,
          preview: true,
        },
      });
      setPreview(r.meal);
    } catch (e) {
      setError((e as Error).message || "Couldn't build an order.");
    } finally {
      setLoading(false);
    }
  }

  function commit() {
    if (!preview) return;
    haptic("success");
    onStage(preview);
    onOpenChange(false);
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
          <div className="flex items-center gap-2">
            {chain && (
              <button
                onClick={() => { setChain(null); setPreview(null); setError(null); }}
                className="p-1.5 -ml-1.5 rounded-md hover:bg-white/5 active:scale-95 text-[color:var(--text-secondary,rgba(255,255,255,0.7))]"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
                Fast food
              </p>
              <SheetTitle className="font-display text-2xl text-[color:var(--text-primary,#fff)] capitalize">
                {chain ? chain : `for ${slot}`}
              </SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-[color:var(--text-secondary,rgba(255,255,255,0.65))]">
            {chain ? "Macros tuned to ±15% of your target." : "Pick a chain — we'll build a macro-matched order."}
          </SheetDescription>
        </SheetHeader>

        {!chain && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            className="mt-4 grid grid-cols-2 gap-2 pb-6"
          >
            {chains.map((c, i) => (
              <motion.button
                key={c}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.025 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { haptic("light"); loadPreview(c); }}
                className="min-h-14 px-3 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] text-left font-medium text-[color:var(--text-primary,#fff)] hover:border-[color:var(--rebuilt-gold,#d4af37)]/40 transition-colors flex items-center gap-2"
              >
                <Utensils className="h-3.5 w-3.5 text-[color:var(--rebuilt-gold,#d4af37)]/70 shrink-0" />
                {c}
              </motion.button>
            ))}
          </motion.div>
        )}

        {chain && (
          <div className="mt-4 space-y-3 pb-6">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="load"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-6 flex items-center gap-3"
                >
                  <div className="h-5 w-5 rounded-full border-2 border-[color:var(--rebuilt-gold,#d4af37)]/30 border-t-[color:var(--rebuilt-gold,#d4af37)] animate-spin" />
                  <p className="text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.6))]">Building your {chain} order…</p>
                </motion.div>
              )}
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-4"
                >
                  <p className="text-sm text-rose-300">{error}</p>
                  <button onClick={() => loadPreview(chain)} className="mt-2 text-xs underline text-[color:var(--rebuilt-gold,#d4af37)] inline-flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Try again
                  </button>
                </motion.div>
              )}
              {preview && !loading && (
                <motion.article
                  key={preview.name}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="rounded-2xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-elevated,#1c1c1f)] p-5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
                      {preview.chain}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] inline-flex items-center gap-1 text-[color:var(--text-tertiary,rgba(255,255,255,0.5))]">
                      <Clock className="h-3 w-3" /> {preview.prep_minutes} min
                    </p>
                  </div>
                  <h3 className="mt-1.5 font-display text-xl leading-snug text-[color:var(--text-primary,#fff)]">{preview.name}</h3>
                  {preview.menu_item && (
                    <p className="mt-1 text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.75))]">
                      <span className="text-[color:var(--text-tertiary,rgba(255,255,255,0.5))]">Menu item:</span> {preview.menu_item}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Pill label="Kcal" value={`${preview.calories}`} />
                    <Pill label="Protein" value={`${preview.protein_g}g`} />
                    <Pill label="Carbs" value={`${preview.carbs_g}g`} />
                    <Pill label="Fat" value={`${preview.fat_g}g`} />
                  </div>

                  {preview.order_lines?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[color:var(--border-hairline,rgba(255,255,255,0.06))]">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
                        What to say at the counter
                      </p>
                      <ol className="mt-2.5 space-y-2">
                        {preview.order_lines.map((line, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <span className="shrink-0 h-5 w-5 rounded-full bg-[color:var(--rebuilt-gold,#d4af37)]/15 text-[color:var(--rebuilt-gold,#d4af37)] text-[11px] font-semibold inline-flex items-center justify-center">{i + 1}</span>
                            <span className="text-[color:var(--text-primary,#fff)]/90 leading-snug">{line}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {preview.swap_note && (
                    <p className="mt-3 text-xs text-[color:var(--text-secondary,rgba(255,255,255,0.6))] italic leading-snug">{preview.swap_note}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => loadPreview(chain)}
                      disabled={committing}
                      className="h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.08))] bg-[color:var(--bg-raised,#141416)] text-sm font-medium text-[color:var(--text-secondary,rgba(255,255,255,0.75))] hover:text-[color:var(--text-primary,#fff)] active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Try another
                    </button>
                    <button
                      onClick={commit}
                      disabled={committing}
                      className="h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--rebuilt-gold,#d4af37)] text-[color:var(--bg-base,#0a0a0b)] text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50 shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)]"
                    >
                      {committing ? (
                        <>
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" /> Use this order
                        </>
                      )}
                    </button>
                  </div>
                </motion.article>
              )}
            </AnimatePresence>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[color:var(--bg-raised,#141416)] border border-[color:var(--border-hairline,rgba(255,255,255,0.06))] px-2 py-1.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-tertiary,rgba(255,255,255,0.45))]">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold text-[color:var(--text-primary,#fff)] tabular-nums">{value}</p>
    </div>
  );
}
