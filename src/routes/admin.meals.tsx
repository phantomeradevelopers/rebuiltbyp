// Admin tool: review the curated meals library — see every row's image and
// ingredients side-by-side, generate or regenerate images, and approve rows
// for the live app (active flag).
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listAllMeals, generateMealImage, setMealActive } from "@/lib/meal-seed.functions";
import { Check, X, RefreshCw, ImagePlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/meals")({
  component: AdminMealsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="font-display text-xl">Meals library</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-4 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
});

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type SlotFilter = "all" | (typeof SLOTS)[number];
type TypeFilter = "all" | "standard" | "fast_food";
type ActiveFilter = "all" | "active" | "inactive";

function AdminMealsPage() {
  const qc = useQueryClient();
  const meals = useQuery({ queryKey: ["admin-meals"], queryFn: () => listAllMeals(), staleTime: 30_000 });
  const [slot, setSlot] = useState<SlotFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = (meals.data ?? []).filter((m) => {
    if (slot !== "all" && m.slot !== slot) return false;
    if (type !== "all" && m.type !== type) return false;
    if (activeFilter === "active" && !m.active) return false;
    if (activeFilter === "inactive" && m.active) return false;
    return true;
  });

  const totals = {
    total: meals.data?.length ?? 0,
    active: meals.data?.filter((m) => m.active).length ?? 0,
    withImage: meals.data?.filter((m) => m.image_path).length ?? 0,
  };

  async function genImage(id: string) {
    setBusyId(id);
    try {
      await generateMealImage({ data: { id } });
      toast.success("Image generated.");
      qc.invalidateQueries({ queryKey: ["admin-meals"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    try {
      await setMealActive({ data: { id, active: next } });
      toast.success(next ? "Approved." : "Hidden from app.");
      qc.invalidateQueries({ queryKey: ["admin-meals"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function generateAllMissing() {
    const missing = (meals.data ?? []).filter((m) => !m.image_path);
    if (missing.length === 0) {
      toast.info("Every row already has an image.");
      return;
    }
    toast.info(`Generating ${missing.length} images sequentially…`);
    for (const m of missing) {
      setBusyId(m.id);
      try {
        await generateMealImage({ data: { id: m.id } });
        qc.invalidateQueries({ queryKey: ["admin-meals"] });
      } catch (e) {
        toast.error(`${m.title}: ${(e as Error).message}`);
        break;
      }
    }
    setBusyId(null);
    toast.success("Batch done.");
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="label-mono text-gold text-[10px]">REBUILT ADMIN</p>
          <h1 className="font-display text-2xl">Meals library</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.active}/{totals.total} active · {totals.withImage}/{totals.total} have images
          </p>
        </div>
        <div className="flex gap-3 text-sm items-center">
          <button
            onClick={generateAllMissing}
            disabled={busyId !== null}
            className="h-9 px-3 btn-gold rounded-md text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Generate all missing
          </button>
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">Clients</Link>
          <Link to="/app" className="text-muted-foreground hover:text-foreground">Exit</Link>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap mb-5 text-xs">
        <FilterGroup label="Slot" value={slot} options={[["all","All"],["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snack","Snack"]]} onChange={(v) => setSlot(v as SlotFilter)} />
        <FilterGroup label="Type" value={type} options={[["all","All"],["standard","Standard"],["fast_food","Fast food"]]} onChange={(v) => setType(v as TypeFilter)} />
        <FilterGroup label="Status" value={activeFilter} options={[["all","All"],["active","Active"],["inactive","Inactive"]]} onChange={(v) => setActiveFilter(v as ActiveFilter)} />
      </div>

      {meals.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {meals.error && <p className="text-sm text-rose-400">{(meals.error as Error).message}</p>}

      <ul className="grid sm:grid-cols-2 gap-3">
        {rows.map((m) => {
          const busy = busyId === m.id;
          const ingredients = Array.isArray(m.ingredients) ? (m.ingredients as { name: string; amount: string }[]) : [];
          return (
            <li key={m.id} className="card-elevated p-3">
              <div className="flex gap-3">
                <div className="w-32 h-32 shrink-0 rounded-lg overflow-hidden bg-muted/40 border border-border/60 flex items-center justify-center">
                  {m.image_url ? (
                    // eslint-disable-next-line jsx-a11y/img-redundant-alt
                    <img src={m.image_url} alt={`Image of ${m.title}`} className="w-full h-full object-cover" />
                  ) : busy ? (
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center px-2">No image yet</p>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="label-mono text-[9px] text-gold uppercase">{m.slot} · {m.type === "fast_food" ? `Fast — ${m.brand}` : "Standard"}</p>
                      <h3 className="font-display text-sm leading-tight mt-0.5">{m.title}</h3>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${m.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
                      {m.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {m.kcal} kcal · {m.protein_g}P · {m.carbs_g}C · {m.fat_g}F · {m.prep_minutes}m
                  </p>
                </div>
              </div>

              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ingredients ({ingredients.length})</summary>
                <ul className="mt-1.5 space-y-0.5">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{ing.name}</span>
                      <span className="text-muted-foreground tabular-nums">{ing.amount}</span>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => genImage(m.id)}
                  disabled={busy}
                  className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs hover:border-gold/40 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {m.image_path ? "Regenerate" : "Generate image"}
                </button>
                {m.active ? (
                  <button
                    onClick={() => toggleActive(m.id, false)}
                    disabled={busy}
                    className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-border text-xs text-rose-300 hover:border-rose-400/40 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Hide
                  </button>
                ) : (
                  <button
                    onClick={() => toggleActive(m.id, true)}
                    disabled={busy || !m.image_path}
                    title={!m.image_path ? "Generate an image first" : ""}
                    className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-md btn-gold text-xs disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!meals.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4">No meals match these filters.</p>
      )}
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-md p-1">
      <span className="label-mono text-[9px] text-muted-foreground uppercase px-1.5">{label}</span>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-1 rounded text-[11px] ${value === v ? "bg-gold text-gold-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
        >{l}</button>
      ))}
    </div>
  );
}
