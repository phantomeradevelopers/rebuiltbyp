import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Check, ArrowRight, ChevronLeft, Dumbbell, Coffee } from "lucide-react";
import { getToday, submitCheckin } from "@/lib/dashboard.functions";
import { celebrate, streakMilestoneCrossed, programMilestone } from "@/lib/celebrate";
import { playChime } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { SectionProgress, type CheckinSection } from "@/components/rebuilt/SectionProgress";
import { ScaleChips } from "@/components/rebuilt/ScaleChips";
import { Stepper } from "@/components/rebuilt/Stepper";
import { pageEnter, springConfig } from "@/lib/motion-rebuilt";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type StepId = "mood" | "energy" | "stress" | "sleep" | "workout" | "notes";

type State = {
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep: number | null;
  workout: boolean | null;
  notes: string;
};

interface StepDef {
  id: StepId;
  section: CheckinSection;
  prompt: string;
  subhead?: string;
}

const STEPS: StepDef[] = [
  { id: "mood", section: "body", prompt: "How's the mood today?", subhead: "Gut read. 1 is rough, 10 is on fire." },
  { id: "energy", section: "body", prompt: "Energy?", subhead: "Body battery right now." },
  { id: "stress", section: "body", prompt: "Stress level?", subhead: "1 calm — 10 wired." },
  { id: "sleep", section: "body", prompt: "How many hours of sleep?", subhead: "Closest half hour is fine." },
  { id: "workout", section: "mind", prompt: "Did you train?", subhead: "Any honest movement counts." },
  { id: "notes", section: "faith", prompt: "Anything I should know?", subhead: "Optional — one line, one truth." },
];

export type CheckinFlowDone = {
  partial: boolean;
  prevStreak: number;
  nextStreak: number;
  streakDelta: number;
};

export function CheckinFlow({
  onDone,
  onClose,
}: {
  onDone: (info: CheckinFlowDone) => void;
  onClose?: () => void;
}) {
  const date = todayISO();
  const qc = useQueryClient();
  const todayQ = useQuery({
    queryKey: ["today", date],
    queryFn: () => getToday({ data: { date } }),
    staleTime: 30_000,
  });
  const checkinDone = !!todayQ.data?.checkinDoneToday;

  const [state, setState] = useState<State>({
    mood: null,
    energy: null,
    stress: null,
    sleep: null,
    workout: null,
    notes: "",
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  function setVal<K extends keyof State>(key: K, v: State[K]) {
    setState((s) => ({ ...s, [key]: v }));
  }

  function answer<K extends keyof State>(key: K, v: State[K]) {
    setVal(key, v);
    haptic("light");
    setTimeout(() => {
      setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
    }, 200);
  }

  async function save(opts?: { partial?: boolean }) {
    if (busy) return;
    setBusy(true);

    const prevStreak = todayQ.data?.streak ?? 0;
    const dayNumber = todayQ.data?.dayNumber ?? 1;
    const nextStreak = prevStreak + (checkinDone ? 0 : 1);
    const streakDelta = nextStreak - prevStreak;

    // ===== OPTIMISTIC: celebrate + advance UI BEFORE the server confirms =====
    const prevSnapshot = qc.getQueryData(["today", date]);
    if (todayQ.data) {
      qc.setQueryData(["today", date], {
        ...todayQ.data,
        checkinDoneToday: true,
        streak: nextStreak,
        lastCheckin: {
          date,
          mood: state.mood ?? 7,
          energy: state.energy ?? 7,
          stress: state.stress ?? 4,
          sleep_hours: state.sleep ?? 7,
          workout_completed: !!state.workout,
        },
      });
    }
    haptic("success");
    const programM = programMilestone(dayNumber);
    const streakM = streakMilestoneCrossed(prevStreak, nextStreak);
    if (programM) celebrate("fireworks", { milestone: programM });
    else if (streakM)
      celebrate("fireworks", { toast: `${streakM}-day streak. Locked in.` });
    else if (state.workout) (playChime("victory"), celebrate("burst"));
    else (playChime("ding"), celebrate("sparkle"));
    // Fire the victory screen immediately — write runs in background.
    onDone({ partial: !!opts?.partial, prevStreak, nextStreak, streakDelta });

    // ===== Background write with rollback =====
    const payload = {
      date,
      mood: state.mood ?? 7,
      energy: state.energy ?? 7,
      stress: state.stress ?? 4,
      sleep_hours: state.sleep ?? 7,
      workout_completed: !!state.workout,
      notes: state.notes.trim() || null,
    };
    void (async () => {
      try {
        await submitCheckin({ data: payload });
        qc.invalidateQueries({ queryKey: ["today", date] });
        qc.invalidateQueries({ queryKey: ["my-streaks"] });
        qc.invalidateQueries({ queryKey: ["achievements-summary"] });
      } catch (e) {
        // Roll back optimistic patch and offer quiet retry — never block the tap.
        if (prevSnapshot !== undefined) qc.setQueryData(["today", date], prevSnapshot);
        toast.error((e as Error).message || "Didn't save", {
          action: {
            label: "Retry",
            onClick: () => {
              void submitCheckin({ data: payload })
                .then(() => {
                  qc.invalidateQueries({ queryKey: ["today", date] });
                  qc.invalidateQueries({ queryKey: ["my-streaks"] });
                })
                .catch((err) => toast.error((err as Error).message));
            },
          },
        });
      } finally {
        setBusy(false);
      }
    })();
  }

  const step = STEPS[stepIdx];
  const canSkipSave = stepIdx >= 1 && stepIdx < STEPS.length - 1;

  // Compute progress within the current section.
  const inSection = STEPS.filter((s) => s.section === step.section);
  const positionInSection = inSection.findIndex((s) => s.id === step.id);
  const sectionProgress = (positionInSection + 1) / inSection.length;

  return (
    <div className="w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            haptic("selection");
            if (stepIdx === 0) onClose?.();
            else setStepIdx((i) => Math.max(0, i - 1));
          }}
          aria-label={stepIdx === 0 ? "Close" : "Previous step"}
          className="h-9 w-9 -ml-2 grid place-items-center rounded-full text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {canSkipSave ? (
          <button
            onClick={() => save({ partial: true })}
            disabled={busy}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)] hover:text-[color:var(--rebuilt-gold)] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Skip · save"}
          </button>
        ) : (
          <span className="w-12" aria-hidden />
        )}
      </div>

      {/* Section progress */}
      <div className="mt-4">
        <SectionProgress
          current={step.section}
          sectionProgress={sectionProgress}
          stepLabel={`${stepIdx + 1} / ${STEPS.length}`}
        />
      </div>

      {/* One step at a time */}
      <div className="mt-10 min-h-[320px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            {...pageEnter}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)]">
                {step.section}
              </p>
              <h2
                className="mt-3 font-display tracking-tight font-semibold text-[color:var(--text-primary)] leading-[1.05]"
                style={{ fontSize: 36 }}
              >
                {step.prompt}
              </h2>
              {step.subhead && (
                <p className="mt-2 text-sm text-[color:var(--text-secondary)] leading-snug">
                  {step.subhead}
                </p>
              )}
            </div>

            <StepInput
              step={step.id}
              state={state}
              onChange={(v) => setVal(step.id as keyof State, v as never)}
              onSubmit={(v) => {
                if (step.id === "notes") {
                  setVal("notes", (v as string) ?? state.notes);
                  void save();
                  return;
                }
                answer(step.id as keyof State, v as never);
              }}
              busy={busy}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepInput({
  step,
  state,
  onChange,
  onSubmit,
  busy,
}: {
  step: StepId;
  state: State;
  onChange: (v: unknown) => void;
  onSubmit: (v?: unknown) => void;
  busy: boolean;
}) {
  if (step === "notes") {
    return (
      <div className="space-y-4">
        <textarea
          value={state.notes}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="One line. What's on your mind?"
          className="w-full rounded-xl bg-[color:var(--bg-raised)] border border-[color:var(--rebuilt-gold)]/25 p-4 text-base text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--rebuilt-gold)] focus:outline-none transition-colors"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={springConfig}
          onClick={() => {
            haptic("medium");
            onSubmit(state.notes);
          }}
          disabled={busy}
          className="btn-gold h-14 w-full rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Lock it in"} <Check className="h-5 w-5" />
        </motion.button>
      </div>
    );
  }

  if (step === "workout") {
    const v = state.workout;
    const opts: { val: boolean; label: string; sub: string; icon: typeof Dumbbell }[] = [
      { val: true, label: "Yes", sub: "Got the work in.", icon: Dumbbell },
      { val: false, label: "No", sub: "Rest, recovery, or skipped.", icon: Coffee },
    ];
    return (
      <div className="grid grid-cols-2 gap-3">
        {opts.map((o) => {
          const active = v === o.val;
          const Icon = o.icon;
          return (
            <motion.button
              key={o.label}
              whileTap={{ scale: 0.96 }}
              transition={springConfig}
              onClick={() => {
                onChange(o.val);
                onSubmit(o.val);
              }}
              className={[
                "rounded-2xl p-5 text-left border min-h-[140px] flex flex-col justify-between transition-colors",
                active
                  ? "bg-[color:var(--rebuilt-gold-dim)] border-[color:var(--rebuilt-gold)] text-[color:var(--rebuilt-gold-bright)]"
                  : "bg-[color:var(--bg-raised)] border-[color:var(--border-strong,rgba(255,255,255,0.08))] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
              ].join(" ")}
              aria-pressed={active}
            >
              <Icon className="h-6 w-6" />
              <div>
                <p className="font-display text-2xl font-semibold leading-none">{o.label}</p>
                <p className="mt-1.5 text-[12px] text-[color:var(--text-secondary)]">{o.sub}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  }

  if (step === "sleep") {
    const v = state.sleep ?? 7;
    return (
      <div className="space-y-5">
        <Stepper value={v} onChange={(n) => onChange(n)} min={0} max={12} step={0.5} suffix="h" />
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={springConfig}
          onClick={() => onSubmit(v)}
          className="h-12 w-full rounded-xl border border-[color:var(--rebuilt-gold)]/60 text-[color:var(--rebuilt-gold)] font-mono text-xs uppercase tracking-[0.2em] inline-flex items-center justify-center gap-2 hover:bg-[color:var(--rebuilt-gold-dim)]"
        >
          Next <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    );
  }

  // mood / energy / stress
  const current =
    step === "mood" ? state.mood : step === "energy" ? state.energy : state.stress;
  const anchors: [string, string] =
    step === "stress" ? ["Calm", "Wired"] : step === "energy" ? ["Drained", "Charged"] : ["Rough", "On fire"];
  return (
    <ScaleChips
      value={current}
      onChange={(n) => {
        onChange(n);
        onSubmit(n);
      }}
      anchors={anchors}
    />
  );
}
