import { useEffect, useMemo, useState } from "react";
import { X, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MODALITIES, MODALITY_CATEGORIES, modalityById, type ModalityCategory } from "@/lib/training-modalities";
import { springConfig } from "@/lib/motion-rebuilt";

type Props = {
  open: boolean;
  currentModalityId: string | null;
  onClose: () => void;
  onPick: (m: { id: string; category: string; equipment: string[]; label: string }) => Promise<void> | void;
};

export function DailyTrainingModeSheet({ open, currentModalityId, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ModalityCategory | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODALITIES.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.blurb.toLowerCase().includes(q) ||
        m.equipment.some((e) => e.includes(q))
      );
    });
  }, [query, cat]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            key="sheet"
            className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-[24px] border-t border-x border-[color:var(--border-strong,rgba(255,255,255,0.10))] bg-[color:var(--bg-raised,#141416)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springConfig}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/15" />
            </div>

            <header className="flex items-start justify-between px-5 pt-3 pb-4 border-b border-[color:var(--border-hairline,rgba(255,255,255,0.06))]">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold,#d4af37)] font-semibold">
                  Train today
                </p>
                <p className="mt-1 font-display text-xl leading-tight text-[color:var(--text-primary,#fff)]">
                  How will you move?
                </p>
                <p className="text-xs text-[color:var(--text-secondary,rgba(255,255,255,0.6))] mt-1">
                  {currentModalityId
                    ? `Current: ${modalityById(currentModalityId)?.label ?? "—"}`
                    : "Pick anything — your plan adapts."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-10 w-10 -mr-1 inline-flex items-center justify-center rounded-full text-[color:var(--text-secondary,rgba(255,255,255,0.6))] hover:text-[color:var(--text-primary,#fff)] hover:bg-white/5 active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-tertiary,rgba(255,255,255,0.4))]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search yoga, kettlebell, run…"
                  className="h-11 w-full rounded-xl border border-[color:var(--border-hairline,rgba(255,255,255,0.07))] bg-[color:var(--bg-elevated,#1c1c1f)] pl-9 pr-3 text-sm text-[color:var(--text-primary,#fff)] placeholder:text-[color:var(--text-tertiary,rgba(255,255,255,0.4))] focus:border-[color:var(--rebuilt-gold,#d4af37)] focus:outline-none transition-colors"
                />
              </div>
              <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <CatChip label="All" active={cat === "all"} onClick={() => setCat("all")} />
                {MODALITY_CATEGORIES.map((c) => (
                  <CatChip key={c.id} label={c.label} active={cat === c.id} onClick={() => setCat(c.id)} />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-[color:var(--text-secondary,rgba(255,255,255,0.6))]">
                    No match. Try a different search.
                  </p>
                </div>
              )}
              {filtered.map((m, i) => {
                const on = m.id === currentModalityId;
                const isSaving = saving === m.id;
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    disabled={!!saving}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.02, duration: 0.22 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      try {
                        setSaving(m.id);
                        await onPick({ id: m.id, category: m.category, equipment: m.equipment, label: m.label });
                      } finally {
                        setSaving(null);
                      }
                    }}
                    className={`w-full text-left rounded-2xl border p-4 flex items-start justify-between gap-3 transition-all disabled:opacity-60 ${
                      on
                        ? "border-[color:var(--rebuilt-gold,#d4af37)] bg-[color:var(--rebuilt-gold,#d4af37)]/[0.06] shadow-[0_0_0_1px_rgba(212,175,55,0.25),0_8px_24px_-12px_rgba(212,175,55,0.35)]"
                        : "border-[color:var(--border-hairline,rgba(255,255,255,0.07))] bg-[color:var(--bg-elevated,#1c1c1f)] hover:border-[color:var(--border-strong,rgba(255,255,255,0.12))]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text-primary,#fff)]">{m.label}</p>
                      <p className="text-xs text-[color:var(--text-secondary,rgba(255,255,255,0.6))] mt-1 leading-snug">
                        {m.blurb}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] ${
                        on ? "text-[color:var(--rebuilt-gold,#d4af37)]" : "text-[color:var(--text-tertiary,rgba(255,255,255,0.4))]"
                      }`}
                    >
                      {isSaving ? (
                        "Saving…"
                      ) : on ? (
                        <>
                          <Check className="h-3 w-3" /> Selected
                        </>
                      ) : (
                        m.category
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3.5 shrink-0 rounded-full border text-xs font-medium transition-all active:scale-95 ${
        active
          ? "border-[color:var(--rebuilt-gold,#d4af37)] bg-[color:var(--rebuilt-gold,#d4af37)]/10 text-[color:var(--rebuilt-gold,#d4af37)]"
          : "border-[color:var(--border-hairline,rgba(255,255,255,0.07))] bg-[color:var(--bg-elevated,#1c1c1f)] text-[color:var(--text-secondary,rgba(255,255,255,0.6))] hover:text-[color:var(--text-primary,#fff)]"
      }`}
    >
      {label}
    </button>
  );
}
