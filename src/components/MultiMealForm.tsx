import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Camera } from "lucide-react";
import { estimateMeal } from "@/lib/meal-estimator.functions";
import { logMealsBulk } from "@/lib/nutrition-bulk.functions";
import { celebrate } from "@/lib/celebrate";
import { checkCombinedStreakAndCelebrate } from "@/lib/streak-celebrate";
import { compressImage } from "@/lib/compress-image";
import { supabase } from "@/integrations/supabase/client";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

type Row = {
  id: string;
  meal: Slot;
  time: string;
  description: string;
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  estimating: boolean;
  estimated: boolean;
  photoPreview: string | null;
  photoBlob: Blob | null;
  photoMime: string | null;
};

const DEFAULT_TIMES: Record<Slot, string> = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "19:00",
  snack: nowHHMM(),
};

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function newRow(slot: Slot): Row {
  return {
    id: crypto.randomUUID(),
    meal: slot,
    time: DEFAULT_TIMES[slot],
    description: "",
    name: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    estimating: false,
    estimated: false,
    photoPreview: null,
    photoBlob: null,
    photoMime: null,
  };
}

function localTimeToIso(date: string, hhmm: string): string {
  const d = new Date(`${date}T00:00:00`);
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (m) {
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  }
  return d.toISOString();
}

export function MultiMealForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => [newRow("breakfast"), newRow("lunch")]);
  const [submitting, setSubmitting] = useState(false);

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function add() {
    const used = new Set(rows.map((r) => r.meal));
    const order: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
    const next = order.find((s) => !used.has(s)) ?? "snack";
    setRows((rs) => [...rs, newRow(next)]);
  }

  function remove(id: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  }

  async function estimate(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (row.description.trim().length < 2) {
      toast.error("Describe what you ate first.");
      return;
    }
    update(id, { estimating: true });
    try {
      const result = await estimateMeal({
        data: { kind: "text", description: row.description.trim(), meal_hint: row.meal },
      });
      update(id, {
        name: result.name,
        kcal: String(result.calories),
        protein: String(result.protein_g),
        carbs: String(result.carbs_g),
        fat: String(result.fat_g),
        estimating: false,
        estimated: true,
      });
    } catch (e) {
      toast.error((e as Error).message);
      update(id, { estimating: false });
    }
  }

  async function estimateFromPhoto(id: string, file: File) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    update(id, { estimating: true });
    try {
      const { base64, mime, dataUrl, blob } = await compressImage(file, { maxBytes: 900_000 });
      update(id, { photoPreview: dataUrl, photoBlob: blob, photoMime: mime });
      const result = await estimateMeal({
        data: { kind: "photo", image_base64: base64, mime, meal_hint: row.meal },
      });
      update(id, {
        name: result.name,
        description: row.description || result.name,
        kcal: String(result.calories),
        protein: String(result.protein_g),
        carbs: String(result.carbs_g),
        fat: String(result.fat_g),
        estimating: false,
        estimated: true,
      });
      if (result.advice) toast.message(result.advice);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that photo.");
      update(id, { estimating: false });
    }
  }


  async function submit() {
    const ready = rows
      .map((r) => {
        const name = (r.name || r.description).trim();
        const calories = Number(r.kcal) || 0;
        if (!name || calories <= 0) return null;
        return {
          row: r,
          payload: {
            meal: r.meal,
            name: name.slice(0, 120),
            calories,
            protein_g: Number(r.protein) || 0,
            carbs_g: Number(r.carbs) || 0,
            fat_g: Number(r.fat) || 0,
            logged_at: localTimeToIso(date, r.time),
            photo_path: null as string | null,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (ready.length === 0) {
      toast.error("Estimate or fill in at least one meal before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload any photos in parallel, then attach paths
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all(
          ready.map(async (r) => {
            if (!r.row.photoBlob) return;
            const ext = (r.row.photoMime?.split("/")[1] || "jpg").replace("jpeg", "jpg");
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage
              .from("meal-photos")
              .upload(path, r.row.photoBlob, { contentType: r.row.photoMime ?? "image/jpeg", upsert: false });
            if (!error) r.payload.photo_path = path;
          }),
        );
      }
      const res = await logMealsBulk({ data: { meals: ready.map((r) => r.payload) } });
      checkCombinedStreakAndCelebrate();
      celebrate("sparkle", { toast: `Logged ${res.count} meal${res.count === 1 ? "" : "s"}.` });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Backfill multiple meals at once. Pick a time, describe, hit estimate.
      </p>

      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className="rounded-md border border-border bg-background/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="label-mono text-xs text-gold w-6">0{i + 1}</span>
              <select
                value={r.meal}
                onChange={(e) => update(r.id, { meal: e.target.value as Slot, time: DEFAULT_TIMES[e.target.value as Slot] })}
                className="h-9 rounded-md border border-border bg-input px-2 text-xs flex-1 min-w-0"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
              <input
                type="time"
                value={r.time}
                onChange={(e) => update(r.id, { time: e.target.value })}
                className="h-9 rounded-md border border-border bg-input px-2 text-xs w-24"
              />
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={rows.length === 1}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive disabled:opacity-40"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={r.description}
              onChange={(e) => update(r.id, { description: e.target.value, estimated: false })}
              placeholder="e.g. 3 eggs, toast, coffee"
              className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
            />

            {r.photoPreview && (
              <img
                src={r.photoPreview}
                alt="Meal"
                loading="lazy"
                className="h-24 w-full object-cover rounded-md border border-border"
              />
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <PhotoButton disabled={r.estimating} onPick={(file) => estimateFromPhoto(r.id, file)} />
              <button
                type="button"
                onClick={() => estimate(r.id)}
                disabled={r.estimating || r.description.trim().length < 2}
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/5 hover:bg-gold/10 text-gold text-xs font-medium disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" /> {r.estimating ? "Estimating…" : r.estimated ? "Re-estimate" : "AI estimate"}
              </button>
              {r.estimated && (
                <span className="label-mono text-xs text-muted-foreground truncate">
                  {r.kcal} kcal · P{r.protein} C{r.carbs} F{r.fat}
                </span>
              )}
            </div>


            {r.estimated && (
              <div className="grid grid-cols-4 gap-2">
                <input value={r.kcal} onChange={(e) => update(r.id, { kcal: e.target.value })} placeholder="kcal" className="h-9 rounded-md border border-border bg-input px-2 text-xs" />
                <input value={r.protein} onChange={(e) => update(r.id, { protein: e.target.value })} placeholder="P" className="h-9 rounded-md border border-border bg-input px-2 text-xs" />
                <input value={r.carbs} onChange={(e) => update(r.id, { carbs: e.target.value })} placeholder="C" className="h-9 rounded-md border border-border bg-input px-2 text-xs" />
                <input value={r.fat} onChange={(e) => update(r.id, { fat: e.target.value })} placeholder="F" className="h-9 rounded-md border border-border bg-input px-2 text-xs" />
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        disabled={rows.length >= 8}
        className="w-full h-10 rounded-md border border-dashed border-border hover:border-gold/60 text-xs text-muted-foreground hover:text-gold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add another meal
      </button>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="h-12 w-full btn-gold rounded-md text-sm font-medium disabled:opacity-70"
      >
        {submitting ? "Saving…" : `Log all (${rows.length})`}
      </button>
    </div>
  );
}

function PhotoButton({ disabled, onPick }: { disabled?: boolean; onPick: (file: File) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium disabled:opacity-50"
      >
        <Camera className="h-3.5 w-3.5" /> Photo
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
