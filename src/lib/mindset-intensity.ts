// Shared types + client-side helpers for the mindset intensity setting.
// The DB check constraint (see migration) enforces this same set.
export type MindsetIntensity = "calm" | "balanced" | "fire";

export function isIntensity(v: unknown): v is MindsetIntensity {
  return v === "calm" || v === "balanced" || v === "fire";
}

export const INTENSITY_LABELS: Record<MindsetIntensity, { en: string; es: string; desc_en: string; desc_es: string }> = {
  calm:     { en: "Calm",     es: "Calma",     desc_en: "Grounded, steady, gentle.",             desc_es: "Firme, constante, suave." },
  balanced: { en: "Balanced", es: "Balanceado", desc_en: "A mix — calm most days, fire when it fits.", desc_es: "Una mezcla — calma casi siempre, fuego cuando toca." },
  fire:     { en: "Fire",     es: "Fuego",     desc_en: "Passionate, direct, high intensity.",   desc_es: "Apasionado, directo, alta intensidad." },
};
