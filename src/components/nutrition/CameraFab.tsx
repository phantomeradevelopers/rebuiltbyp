import { useRef, useState } from "react";
import { Camera, X, Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/compress-image";
import { estimateMeal } from "@/lib/meal-estimator.functions";
import { logMeal } from "@/lib/nutrition.functions";
import { supabase } from "@/integrations/supabase/client";
import { celebrate } from "@/lib/celebrate";
import { checkCombinedStreakAndCelebrate } from "@/lib/streak-celebrate";
import { haptic } from "@/lib/haptics";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

function defaultSlotForNow(): Slot {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

type Estimate = {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  advice?: string | null;
};

/**
 * Floating camera shortcut: tap → opens native camera, runs AI estimate,
 * shows an editable confirmation card, then logs the meal with the photo.
 */
export function CameraFab() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"idle" | "reading" | "confirm" | "saving">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState<string>("image/jpeg");
  const [est, setEst] = useState<Estimate | null>(null);
  const [slot, setSlot] = useState<Slot>(defaultSlotForNow());
  const [savePhoto, setSavePhoto] = useState(false);

  function reset() {
    setOpen(false);
    setStage("idle");
    setPreview(null);
    setBlob(null);
    setEst(null);
    setSavePhoto(false);
  }


  async function onPick(file: File) {
    setOpen(true);
    setStage("reading");
    try {
      const c = await compressImage(file, { maxBytes: 900_000 });
      setPreview(c.dataUrl);
      setBlob(c.blob);
      setMime(c.mime);
      const r = await estimateMeal({
        data: { kind: "photo", image_base64: c.base64, mime: c.mime, meal_hint: slot },
      });
      setEst({
        name: r.name,
        calories: r.calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        advice: r.advice,
      });
      setStage("confirm");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that photo.");
      reset();
    }
  }

  async function confirmLog() {
    if (!est || !blob) return;
    setStage("saving");
    try {
      let photo_path: string | null = null;
      if (savePhoto) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("meal-photos")
            .upload(path, blob, { contentType: mime, upsert: false });
          if (!upErr) photo_path = path;
        }
      }

      await logMeal({
        data: {
          meal: slot,
          name: est.name.slice(0, 120),
          calories: Math.max(0, Math.round(est.calories)),
          protein_g: Math.max(0, Math.round(est.protein_g)),
          carbs_g: Math.max(0, Math.round(est.carbs_g)),
          fat_g: Math.max(0, Math.round(est.fat_g)),
          photo_path,
        },
      });
      checkCombinedStreakAndCelebrate();
      celebrate("sparkle", { toast: "Snapped and logged." });
      queryClient.invalidateQueries({ queryKey: ["nutrition-today-totals"] });
      reset();
    } catch (e) {
      toast.error((e as Error).message);
      setStage("confirm");
    }
  }

  function updateEst<K extends keyof Estimate>(key: K, value: Estimate[K]) {
    setEst((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <>
      <button
        type="button"
        aria-label="Snap a photo to log a meal"
        onClick={() => { haptic("medium"); fileRef.current?.click(); }}
        className="fixed right-4 z-40 h-14 w-14 rounded-full btn-gold shadow-[0_18px_40px_-12px_rgba(212,175,55,0.55)] inline-flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
      >
        <Camera className="h-6 w-6" />
      </button>
      <input
        ref={fileRef}
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

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/85 backdrop-blur flex items-end sm:items-center justify-center"
          onClick={stage === "saving" ? undefined : reset}
        >
          <div
            className="w-full max-w-md card-elevated border-t sm:border rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="label-mono text-[11px] text-gold inline-flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> SNAP & LOG
              </p>
              <button
                onClick={reset}
                disabled={stage === "saving"}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview && (
              <img
                src={preview}
                alt="meal preview"
                loading="lazy"
                decoding="async"
                className="w-full max-h-56 object-cover rounded-md border border-border aspect-[4/3]"
              />
            )}

            {stage === "reading" && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                Reading the plate…
              </div>
            )}

            {stage === "confirm" && est && (
              <div className="mt-4 space-y-3">
                <p className="label-mono text-[10px] text-muted-foreground">
                  AI ESTIMATE — ADJUST IF NEEDED. Photo estimates aren't exact.
                </p>

                <input
                  value={est.name}
                  onChange={(e) => updateEst("name", e.target.value)}
                  className="w-full h-11 rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
                  placeholder="What was it?"
                />
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={`shrink-0 h-8 px-3 rounded-full text-[11px] capitalize border ${slot === s ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Num label="kcal" value={est.calories} onChange={(v) => updateEst("calories", v)} />
                  <Num label="P" value={est.protein_g} onChange={(v) => updateEst("protein_g", v)} />
                  <Num label="C" value={est.carbs_g} onChange={(v) => updateEst("carbs_g", v)} />
                  <Num label="F" value={est.fat_g} onChange={(v) => updateEst("fat_g", v)} />
                </div>
                {est.advice && (
                  <p className="text-[11px] italic text-muted-foreground border-l-2 border-gold/40 pl-2">
                    <Sparkles className="inline h-3 w-3 mr-1 text-gold" />
                    {est.advice}
                  </p>
                )}
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={savePhoto}
                    onChange={(e) => setSavePhoto(e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  Save this photo to my log (off by default)
                </label>
                <button

                  type="button"
                  onClick={confirmLog}
                  className="btn-gold h-12 w-full rounded-md text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Log it
                </button>
              </div>
            )}

            {stage === "saving" && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                Saving…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono text-[10px] text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="mt-0.5 w-full h-9 rounded-md border border-border bg-input px-2 text-xs"
      />
    </label>
  );
}
