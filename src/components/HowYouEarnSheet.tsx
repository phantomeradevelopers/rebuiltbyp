import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Flame, Wind, Utensils, Dumbbell, Mountain, HeartHandshake, Shield, Sparkles } from "lucide-react";
import { getRetentionSummary } from "@/lib/retention.functions";

/**
 * How You Earn — the honest reps + rewards sheet.
 * Reps come from real actions. They unlock ONLY earned rewards: freeze tokens
 * (protect a streak) and future cosmetic themes/badges. No purchasable currency.
 */

type Lang = "en" | "es";

const COPY = {
  en: {
    title: "Reps & rewards",
    subtitle: "Every action counts. Nothing is fake, nothing is for sale.",
    balance: "Your reps",
    today: "today",
    week: "this week",
    freezes: "Freeze tokens",
    freezesDesc:
      "Earned at 7, 14, 30, 60, 90-day streaks. One freeze protects one missed day. Never purchasable.",
    earnTitle: "How you earn reps",
    rewardsTitle: "What reps unlock",
    close: "Close",
    freezeUse: "Use a freeze token from your streak card when you've missed a day.",
    cosmeticSoon: "Cosmetic themes and badges — arriving soon.",
    honesty: "Honesty rule: reps map to real actions. No streak buys, no whales, no dark patterns.",
    milestone: (day: number) => `Next milestone: ${day}-day streak`,
    noMilestone: "You're past every published milestone. Keep going.",
  },
  es: {
    title: "Reps y recompensas",
    subtitle: "Cada acción cuenta. Nada es falso, nada está en venta.",
    balance: "Tus reps",
    today: "hoy",
    week: "esta semana",
    freezes: "Escudos de racha",
    freezesDesc:
      "Se ganan a los 7, 14, 30, 60, 90 días. Un escudo protege un día perdido. Nunca se compran.",
    earnTitle: "Cómo ganar reps",
    rewardsTitle: "Qué desbloquean",
    close: "Cerrar",
    freezeUse: "Usa un escudo desde tu tarjeta de racha cuando se te haya escapado un día.",
    cosmeticSoon: "Temas y medallas cosméticas — muy pronto.",
    honesty: "Regla de honestidad: los reps salen de acciones reales. No hay compras ni patrones oscuros.",
    milestone: (day: number) => `Próximo hito: racha de ${day} días`,
    noMilestone: "Superaste cada hito publicado. Sigue.",
  },
} as const;

const EARN_ROWS_EN = [
  { icon: HeartHandshake, action: "Daily check-in", reps: 10 },
  { icon: Dumbbell, action: "Completed workout", reps: 15 },
  { icon: Utensils, action: "Logged meal", reps: 4 },
  { icon: Wind, action: "Breathe session", reps: 6 },
  { icon: Mountain, action: "Step Outside loop", reps: 8 },
  { icon: Sparkles, action: "Spirit reflection", reps: 6 },
] as const;

const EARN_ROWS_ES = [
  { icon: HeartHandshake, action: "Check-in diario", reps: 10 },
  { icon: Dumbbell, action: "Entrenamiento completo", reps: 15 },
  { icon: Utensils, action: "Comida registrada", reps: 4 },
  { icon: Wind, action: "Sesión de respiración", reps: 6 },
  { icon: Mountain, action: "Vuelta al aire libre", reps: 8 },
  { icon: Sparkles, action: "Reflexión de espíritu", reps: 6 },
] as const;

export function HowYouEarnSheet({
  open,
  onClose,
  lang = "en",
}: {
  open: boolean;
  onClose: () => void;
  lang?: Lang;
}) {
  const t = COPY[lang];
  const earnRows = lang === "es" ? EARN_ROWS_ES : EARN_ROWS_EN;
  const fetchSummary = useServerFn(getRetentionSummary);

  const { data } = useQuery({
    queryKey: ["retention-summary"],
    queryFn: () => fetchSummary(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const totalFreezes =
    (data?.freeze_tokens.checkin ?? 0) +
    (data?.freeze_tokens.workout ?? 0) +
    (data?.freeze_tokens.meal ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
          color: "var(--text-primary)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-mono text-[10px]" style={{ color: "var(--rebuilt-gold)" }}>
              Reps
            </p>
            <h2 className="font-display text-2xl mt-1" style={{ color: "var(--text-primary)" }}>
              {t.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {t.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-tap grid place-items-center rounded-full active:scale-95 transition"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Balance row */}
        <div
          className="mt-4 rounded-xl p-4 flex items-baseline justify-between gap-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <div>
            <p className="label-mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {t.balance}
            </p>
            <p
              className="font-display text-4xl tabular-nums leading-none mt-1"
              style={{ color: "var(--rebuilt-gold)" }}
            >
              {data?.reps.balance ?? 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              +{data?.reps.today ?? 0} {t.today}
            </p>
            <p className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              +{data?.reps.week ?? 0} {t.week}
            </p>
          </div>
        </div>

        {/* Freeze tokens */}
        <div
          className="mt-3 rounded-xl p-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "var(--rebuilt-gold)" }} />
            <p className="label-mono text-[10px]" style={{ color: "var(--rebuilt-gold)" }}>
              {t.freezes}
            </p>
            <span
              className="ml-auto font-display text-lg tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {totalFreezes}
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {t.freezesDesc}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
            {t.freezeUse}
          </p>
        </div>

        {/* Earn rows */}
        <p
          className="label-mono text-[10px] mt-5 mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t.earnTitle}
        </p>
        <ul className="space-y-1.5">
          {earnRows.map((row) => {
            const Icon = row.icon;
            return (
              <li
                key={row.action}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {row.action}
                </span>
                <span
                  className="label-mono text-xs tabular-nums"
                  style={{ color: "var(--rebuilt-gold)" }}
                >
                  +{row.reps}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Rewards */}
        <p
          className="label-mono text-[10px] mt-5 mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t.rewardsTitle}
        </p>
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Shield className="h-4 w-4" style={{ color: "var(--rebuilt-gold)" }} />
            {lang === "es"
              ? "Escudos de racha (uno protege un día perdido)."
              : "Freeze tokens (one protects a missed day)."}
          </p>
          <p className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <Sparkles className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            {t.cosmeticSoon}
          </p>
        </div>

        {/* Milestone */}
        <div className="mt-4 flex items-center gap-2">
          <Flame className="h-3.5 w-3.5" style={{ color: "var(--rebuilt-gold)" }} />
          <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {data?.next_milestone
              ? t.milestone(data.next_milestone.day)
              : data
              ? t.noMilestone
              : "…"}
          </p>
        </div>

        {/* Honesty */}
        <p
          className="mt-4 text-[11px] leading-snug"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t.honesty}
        </p>
      </div>
    </div>
  );
}

// A small trigger pill that shows the current Reps balance.
export function RepsPill({ onOpen, lang = "en" }: { onOpen: () => void; lang?: Lang }) {
  const fetchSummary = useServerFn(getRetentionSummary);
  const { data } = useQuery({
    queryKey: ["retention-summary"],
    queryFn: () => fetchSummary(),
    staleTime: 60_000,
  });
  const label = lang === "es" ? "reps" : "reps";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 label-mono text-[10px] active:scale-95 transition min-tap"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        color: "var(--text-primary)",
      }}
      aria-label={lang === "es" ? "Reps y recompensas" : "Reps and rewards"}
    >
      <Flame className="h-3 w-3" style={{ color: "var(--rebuilt-gold)" }} />
      <span className="tabular-nums" style={{ color: "var(--rebuilt-gold)" }}>
        {data?.reps.balance ?? 0}
      </span>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
    </button>
  );
}

// Placeholder to keep tree-shakers happy if referenced.
export const _RETENTION_UI_LOADED = true as const;

// Local no-op to satisfy the "used" contract when only pill is imported.
export function useIsFirstRender() {
  const [first, setFirst] = useState(true);
  useEffect(() => setFirst(false), []);
  return first;
}
