import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Flame, Pill, Check } from "lucide-react";
import { submitWeeklyCheckin, type WeeklyCheckinStatus } from "@/lib/weekly-checkin.functions";
import { playChime } from "@/lib/sound";
import { celebrate } from "@/lib/celebrate";
import { GoldMeridian } from "@/components/brand/GoldMeridian";
import { MedicationAddSheet } from "@/components/medications/MedicationAddSheet";

const FOCUS_LABELS: Record<string, string> = {
  six_pack: "abs",
  bigger_arms: "arms",
  bigger_glutes: "glutes",
  bigger_chest: "chest",
  wider_shoulders: "shoulders",
  stronger_back: "back",
  bigger_legs: "legs",
  slimmer_waist: "waist",
  lose_belly_fat: "belly",
  tone_all_over: "tone",
};

export function WeeklyCheckinCard({
  status,
  onSubmitted,
}: {
  status: WeeklyCheckinStatus;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Answers
  const [focus, setFocus] = useState<Record<string, "bigger" | "same" | "smaller">>({});
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [weight, setWeight] = useState("");
  const [ratingTouched, setRatingTouched] = useState(false);
  const [rating, setRating] = useState(7);
  const [notes, setNotes] = useState("");
  const [medUpdate, setMedUpdate] = useState<"no_changes" | "update" | null>(null);
  const [medSheetOpen, setMedSheetOpen] = useState(false);

  const askMeds = status.currentWeek > 0 && status.currentWeek % 4 === 0;
  const hasMeasurement =
    status.success_metric?.type === "measurement" && !!status.success_metric.body_part;
  const focuses = status.physique_focus;
  const bodyPart = status.success_metric?.body_part ?? null;

  const headline = focuses.length
    ? focuses.map((f) => FOCUS_LABELS[f] ?? f.replace(/_/g, " ")).join(", ")
    : "your plan";

  // Refs for auto-advance scroll
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setRowRef = (key: string) => (el: HTMLDivElement | null) => {
    rowRefs.current[key] = el;
  };

  // Ordered list of question keys (drives progress + auto-advance)
  const questionKeys = useMemo(() => {
    const keys: string[] = [];
    for (const f of focuses) keys.push(`focus:${f}`);
    if (hasMeasurement && bodyPart) keys.push(`measurement:${bodyPart}`);
    keys.push("weight");
    keys.push("rating");
    if (askMeds) keys.push("meds");
    keys.push("notes");
    return keys;
  }, [focuses, hasMeasurement, bodyPart, askMeds]);

  // Which keys are "answered" (drives meridian fill + auto-scroll target)
  const answered = useMemo(() => {
    const set = new Set<string>();
    for (const f of focuses) if (focus[f]) set.add(`focus:${f}`);
    if (hasMeasurement && bodyPart) {
      const v = measurements[bodyPart];
      if (v && Number(v) > 0) set.add(`measurement:${bodyPart}`);
    }
    if (weight.trim() !== "") set.add("weight");
    if (ratingTouched) set.add("rating");
    if (askMeds && medUpdate) set.add("meds");
    if (notes.trim() !== "") set.add("notes");
    return set;
  }, [focus, focuses, measurements, hasMeasurement, bodyPart, weight, ratingTouched, askMeds, medUpdate, notes]);

  // Required to enable submit: every focus + rating. Everything else is optional.
  const minReady = focuses.every((f) => !!focus[f]) && ratingTouched;

  const answeredCount = answered.size;
  const total = questionKeys.length;

  // Auto-advance: when something gets answered, smooth-scroll to the next
  // unanswered question. We track the last "trigger" key to only scroll on
  // a fresh answer (not on every render).
  const lastAdvanceAt = useRef<number>(0);
  function advanceFrom(key: string) {
    const now = Date.now();
    if (now - lastAdvanceAt.current < 150) return; // debounce double-fires
    lastAdvanceAt.current = now;
    const idx = questionKeys.indexOf(key);
    if (idx < 0) return;
    // find next unanswered after this one
    for (let i = idx + 1; i < questionKeys.length; i++) {
      const k = questionKeys[i];
      if (!answered.has(k) && k !== key) {
        const el = rowRefs.current[k];
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            // focus any input inside
            const focusable = el.querySelector<HTMLElement>(
              "input, textarea, button:not([data-noautofocus])",
            );
            focusable?.focus({ preventScroll: true });
          }, 80);
        }
        return;
      }
    }
  }

  async function submit() {
    if (!minReady) return;
    setBusy(true);
    try {
      const parsedMeasurements: Record<string, number> = {};
      for (const [k, v] of Object.entries(measurements)) {
        const n = Number(v);
        if (!Number.isNaN(n) && n > 0) parsedMeasurements[k] = n;
      }
      const w = weight === "" ? null : Number(weight);
      await submitWeeklyCheckin({
        data: {
          focus_feedback: {
            ...focus,
            ...(askMeds && medUpdate
              ? { med_protocol_update: medUpdate === "no_changes" ? "same" : "bigger" }
              : {}),
          },
          measurements: parsedMeasurements,
          weight_kg: w !== null && !Number.isNaN(w) ? w : null,
          week_rating: rating,
          notes: notes.trim() || null,
        },
      });
      playChime("pr");
      celebrate("burst", { toast: "Week logged. P has a note for you." });
      setOpen(false);
      onSubmitted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ----- Collapsed launcher -----
  if (!open) {
    return (
      <section
        className="rb-hero-pulse relative overflow-hidden rounded-2xl p-5 animate-count-up"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--rebuilt-gold-solid)",
          boxShadow: "0 0 0 1px var(--rebuilt-gold-dim) inset",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, var(--rebuilt-gold-glow) 0%, transparent 60%)",
          }}
        />
        <div className="relative min-w-0">
          <p
            className="label-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--rebuilt-gold)" }}
          >
            <span className="relative inline-flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                style={{ background: "var(--rebuilt-gold)" }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "var(--rebuilt-gold)" }}
              />
            </span>
            Sunday · Week {status.currentWeek} check-in
          </p>
          <p
            className="mt-2 font-display text-xl leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            How's the work on{" "}
            <span style={{ color: "var(--rebuilt-gold)" }}>{headline}</span>?
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            ~60 seconds · one screen.
            {status.weeklyStreak > 0 && (
              <span
                className="ml-2 inline-flex items-center gap-1"
                style={{ color: "var(--rebuilt-gold)" }}
              >
                <Flame className="h-3 w-3" /> {status.weeklyStreak}-week streak
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="relative mt-4 h-12 w-full rounded-full text-sm font-medium transition-transform active:scale-[0.98]"
          style={{
            background: "var(--rebuilt-gold)",
            color: "#0a0a0a",
            boxShadow: "0 8px 32px -8px var(--rebuilt-gold-glow)",
          }}
        >
          Start weekly check-in
        </button>
      </section>
    );
  }

  // ----- Single-screen flow -----
  return (
    <section
      className="rounded-2xl p-5 animate-count-up"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border-strong)",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="label-mono text-[11px] tracking-[0.18em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          WEEK {status.currentWeek}
        </span>
        <span
          className="label-mono text-[11px] tracking-[0.18em]"
          style={{ color: "var(--rebuilt-gold)" }}
        >
          {answeredCount} / {total}
        </span>
      </div>

      {/* Meridian — the glowing dot is now the progress cursor */}
      <div className="mt-3">
        <GoldMeridian current={answeredCount} total={total} />
      </div>

      {/* Identity row */}
      <div className="mt-6 flex gap-3 items-start">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "var(--rebuilt-gold-dim)",
            border: "1px solid var(--rebuilt-gold-solid)",
          }}
        >
          <span className="label-mono text-[11px]" style={{ color: "var(--rebuilt-gold)" }}>
            P
          </span>
        </div>
        <p
          className="font-display text-xl sm:text-2xl leading-snug pt-0.5"
          style={{ color: "var(--text-primary)" }}
        >
          A short read on the week.
        </p>
      </div>

      <div className="mt-7 space-y-7">
        {/* Focus areas */}
        {focuses.length > 0 && (
          <Section label="How's each focus area feeling?">
            <div className="space-y-3">
              {focuses.map((f) => {
                const label = FOCUS_LABELS[f] ?? f.replace(/_/g, " ");
                const key = `focus:${f}`;
                return (
                  <div
                    key={f}
                    ref={setRowRef(key)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm capitalize">{label}</span>
                    <div className="flex gap-1.5">
                      {(["bigger", "same", "smaller"] as const).map((opt) => {
                        const on = focus[f] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => {
                              const wasUnanswered = !focus[f];
                              setFocus((s) => ({ ...s, [f]: opt }));
                              if (wasUnanswered) advanceFrom(key);
                            }}
                            className={`h-9 px-3 rounded-full text-xs border transition-colors ${
                              on
                                ? "border-gold bg-gold/10 text-gold"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Measurement */}
        {hasMeasurement && bodyPart && (
          <Section
            label={`${bodyPart} (${status.success_metric?.target_unit ?? "cm"})`}
            optional
          >
            <div ref={setRowRef(`measurement:${bodyPart}`)}>
              <input
                type="number"
                inputMode="decimal"
                value={measurements[bodyPart] ?? ""}
                onChange={(e) => setMeasurements((s) => ({ ...s, [bodyPart]: e.target.value }))}
                onBlur={() => {
                  const v = measurements[bodyPart];
                  if (v && Number(v) > 0) advanceFrom(`measurement:${bodyPart}`);
                }}
                className="h-12 w-full rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none"
                placeholder="e.g. 84"
              />
            </div>
          </Section>
        )}

        {/* Weight */}
        <Section label="Weight today" optional>
          <div ref={setRowRef("weight")}>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => {
                if (weight.trim() !== "") advanceFrom("weight");
              }}
              className="h-12 w-full rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none"
              placeholder="kg"
            />
          </div>
        </Section>

        {/* Rating */}
        <Section label="How was this week?">
          <div ref={setRowRef("rating")} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="label-mono text-[11px] text-muted-foreground">1 — 10</span>
              <span className="label-mono text-gold text-lg">{rating}/10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              onPointerUp={() => {
                const wasUnanswered = !ratingTouched;
                setRatingTouched(true);
                if (wasUnanswered) advanceFrom("rating");
              }}
              onKeyUp={() => {
                const wasUnanswered = !ratingTouched;
                setRatingTouched(true);
                if (wasUnanswered) advanceFrom("rating");
              }}
              className="w-full accent-[var(--gold)]"
            />
          </div>
        </Section>

        {/* Meds */}
        {askMeds && (
          <Section label="Any updates to your CandyRx or other meds?" icon={<Pill className="h-3.5 w-3.5" />}>
            <div ref={setRowRef("meds")} className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const was = !medUpdate;
                  setMedUpdate("no_changes");
                  if (was) advanceFrom("meds");
                }}
                className={`h-10 px-4 rounded-full text-sm border transition-colors ${
                  medUpdate === "no_changes"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                No changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setMedUpdate("update");
                  setMedSheetOpen(true);
                }}
                className={`h-10 px-4 inline-flex items-center rounded-full text-sm border transition-colors ${
                  medUpdate === "update"
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Yes — update now
              </button>
            </div>
          </Section>
        )}

        {/* Notes */}
        <Section label="Anything to tell your coach?" optional>
          <div ref={setRowRef("notes")}>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-input p-3 text-base focus:border-gold focus:outline-none"
              placeholder="What worked, what hurt, what came up…"
            />
          </div>
        </Section>
      </div>

      {/* Submit */}
      <div className="mt-8">
        <motion.button
          onClick={submit}
          disabled={busy || !minReady}
          whileTap={{ scale: 0.98 }}
          className="btn-gold h-12 w-full rounded-md text-base font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Saving…" : (<>Submit weekly check-in <Check className="h-4 w-4" /></>)}
        </motion.button>
        {!minReady && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Answer each focus area and rate the week to submit.
          </p>
        )}
      </div>
      <MedicationAddSheet open={medSheetOpen} onOpenChange={setMedSheetOpen} />
    </section>
  );
}

function Section({
  label,
  icon,
  optional,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="label-mono text-[11px] uppercase tracking-[0.16em] text-foreground/80 flex items-center gap-1.5">
        {icon && <span className="text-gold/80">{icon}</span>}
        {label}
        {optional && <span className="text-muted-foreground font-normal normal-case tracking-normal">· optional</span>}
      </p>
      {children}
    </div>
  );
}
