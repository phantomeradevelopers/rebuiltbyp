import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, Waves, Scale } from "lucide-react";
import { getMindsetIntensity, setMindsetIntensity } from "@/lib/mindset-intensity.functions";
import type { MindsetIntensity } from "@/lib/mindset-intensity";
import { useTranslation } from "react-i18next";

const ORDER: MindsetIntensity[] = ["calm", "balanced", "fire"];
const ICONS: Record<MindsetIntensity, React.ComponentType<{ className?: string }>> = {
  calm: Waves,
  balanced: Scale,
  fire: Flame,
};

export function IntensitySection() {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const load = useServerFn(getMindsetIntensity);
  const save = useServerFn(setMindsetIntensity);
  const [value, setValue] = useState<MindsetIntensity>("balanced");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await load();
        setValue(r.intensity);
      } catch { /* keep default */ }
      finally { setLoaded(true); }
    })();
  }, [load]);

  async function pick(v: MindsetIntensity) {
    if (v === value) return;
    setBusy(true);
    const prev = value;
    setValue(v);
    try {
      await save({ data: { intensity: v } });
      toast.success(isEs ? "Guardado." : "Saved.");
    } catch (e) {
      setValue(prev);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const labels: Record<MindsetIntensity, { label: string; desc: string }> = {
    calm:     { label: isEs ? "Calma"     : "Calm",     desc: isEs ? "Firme, constante, suave."                 : "Grounded, steady, gentle." },
    balanced: { label: isEs ? "Balanceado" : "Balanced", desc: isEs ? "Calma casi siempre, fuego cuando toca." : "Mix — calm most days, fire when it fits." },
    fire:     { label: isEs ? "Fuego"     : "Fire",     desc: isEs ? "Apasionado, directo, alta intensidad." : "Passionate, direct, high intensity." },
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold flex items-center gap-1.5">
        <Flame className="h-3 w-3" /> {isEs ? "Intensidad del mensaje diario" : "Daily mindset intensity"}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {isEs
          ? "Controla el tono de tu frase diaria de mentalidad y reflexión."
          : "Controls the tone of your daily mindset & reflect line."}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("more.mindset_intensity", "Mindset intensity")}>
        {ORDER.map((k) => {
          const Icon = ICONS[k];
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(k)}
              disabled={busy || !loaded}
              className={[
                "min-tap rounded-md border p-3 text-left transition",
                active
                  ? "border-gold bg-gold/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-gold/50 hover:text-foreground",
                busy || !loaded ? "opacity-70" : "",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="h-3.5 w-3.5" /> {labels[k].label}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
                {labels[k].desc}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {isEs
          ? "Grace-fuego se mantiene fuerte y cálido. Coach P-fuego es directo, nunca condescendiente."
          : "Grace-fire stays strong and warm. Coach P-fire is direct, never condescending."}
      </p>
    </section>
  );
}
