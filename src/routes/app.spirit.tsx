import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BackToTodayPill, cameFromToday } from "@/components/BackToTodayPill";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Save, Frown, Meh, Smile, Laugh, CloudRain } from "lucide-react";
import { getTodayAnchor, saveReflection, setTradition, TRADITIONS as SHARED_TRADITIONS, type DailyAnchor, type AnchorReflection } from "@/lib/spirit.functions";
import { getFaithSettings, setTribeLabel } from "@/lib/faith.functions";
import { tickStreak } from "@/lib/streaks.functions";
import { detectCrisis } from "@/lib/safety";
import { logSafetyEvent } from "@/lib/safety.functions";
import { CrisisCard } from "@/components/CrisisCard";
import { BreathExercise } from "@/components/BreathExercise";
import { CardSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { RouteError } from "@/components/RouteError";
import { ImmersiveHeader } from "@/components/ImmersiveHeader";
import { celebrate } from "@/lib/celebrate";
import { AskCoachFooter } from "@/components/AskCoachFooter";

type SpiritSearch = { from?: string; date?: string };

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/app/spirit")({
  head: () => ({ meta: [{ title: "Spirit — REBUILT" },{ name: "description", content: "Faith, prayer, and daily readings for the rebuild." },{ property: "og:title", content: "Spirit — REBUILT" },{ property: "og:description", content: "Faith, prayer, and daily readings for the rebuild." },] }),
  validateSearch: (search: Record<string, unknown>): SpiritSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: SpiritPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

const TRADITIONS = SHARED_TRADITIONS.map((t) => ({ v: t.value, label: t.label }));

function SpiritPage() {
  const { date: dateParam } = Route.useSearch();
  const date = dateParam ?? utcToday();
  const fetchAnchor = useServerFn(getTodayAnchor);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["spirit-today-todo", date],
    queryFn: () => fetchAnchor({ data: { date } }),
  });
  const [breathDone, setBreathDone] = useState(false);
  const navigate = useNavigate();
  const reflectionSavedRef = useRef(false);

  // If reflection was already saved earlier and breath finishes after, head home.
  useEffect(() => {
    if (breathDone && reflectionSavedRef.current && cameFromToday()) {
      const t = setTimeout(() => navigate({ to: "/app" }), 1400);
      return () => clearTimeout(t);
    }
  }, [breathDone, navigate]);

  return (
    <div>
      <ImmersiveHeader
        eyebrow="Today's anchor"
        title="One verse. One breath. One step."
        subtitle="Steady the mind before you move the body."
        variant="dawn"
      />
      <div className="px-4 sm:px-6 max-w-md mx-auto space-y-6 pb-8 -mt-4 relative">
        <BackToTodayPill />
        <Link to="/app" className="inline-flex items-center gap-2 text-xs label-mono text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

      {isLoading && (
        <>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
        </>
      )}

      {!isLoading && !data?.anchor && (
        <EmptyState
          title="No anchor for today yet"
          description="New daily anchors arrive every morning. Check back soon, or pick a tradition below."
        />
      )}

      {data?.anchor && (
        <>
          <AnchorCard anchor={data.anchor} />
          <BreathExercise
            protocol={data.anchor.breath_protocol === "box" ? "box" : "4-7-8"}
            cycles={4}
            onComplete={() => setBreathDone(true)}
          />
          <ReflectionEditor
            date={date}
            anchor={data.anchor}
            existing={data.reflection ?? null}
            breathDone={breathDone}
            onSaved={() => { reflectionSavedRef.current = true; refetch(); }}
          />
          <TraditionPicker current={data.tradition} onChange={() => refetch()} />
        </>
      )}
      <AskCoachFooter prompt="Heavy on your heart? Tell P." />
      </div>
    </div>
  );
}

function AnchorCard({ anchor }: { anchor: DailyAnchor }) {
  return (
    <section className="card-elevated p-6">
      <p className="label-mono text-gold">{anchor.theme}</p>
      <blockquote className="mt-4 font-display text-2xl leading-snug text-foreground">
        "{anchor.verse_text}"
      </blockquote>
      {anchor.verse_ref && (
        <p className="mt-3 label-mono text-xs text-muted-foreground">— {anchor.verse_ref}</p>
      )}
      <div className="mt-5 pt-5 border-t border-border">
        <p className="label-mono text-xs text-muted-foreground">Sit with this</p>
        <p className="mt-2 text-sm text-foreground/90">{anchor.reflection_prompt}</p>
      </div>
    </section>
  );
}

function ReflectionEditor({ date, anchor, existing, breathDone, onSaved }: { date: string; anchor: DailyAnchor; existing: AnchorReflection | null; breathDone: boolean; onSaved: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(saveReflection);
  const tick = useServerFn(tickStreak);
  const logSafety = useServerFn(logSafetyEvent);
  const [response, setResponse] = useState(existing?.response ?? "");
  const [moodBefore, setMoodBefore] = useState<number | null>(existing?.mood_before ?? null);
  const [moodAfter, setMoodAfter] = useState<number | null>(existing?.mood_after ?? null);
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<{ severity: "low" | "medium" | "high" } | null>(null);

  useEffect(() => {
    setResponse(existing?.response ?? "");
    setMoodBefore(existing?.mood_before ?? null);
    setMoodAfter(existing?.mood_after ?? null);
  }, [existing]);

  async function onSave() {
    setBusy(true);
    try {
      // Crisis detection before persisting
      const signal = detectCrisis(response);
      if (signal) {
        setCrisis({ severity: signal.severity });
        try {
          await logSafety({ data: { source: "journal", matched: signal.matched, severity: signal.severity, excerpt: signal.excerpt } });
        } catch { /* non-fatal */ }
      } else {
        setCrisis(null);
      }

      // Save against the dashboard's "today" so the mission tick lines up,
      // not against the (possibly older) anchor row's anchor_date.
      await save({ data: {
        anchor_date: date,
        response: response.trim() || undefined,
        mood_before: moodBefore ?? undefined,
        mood_after: moodAfter ?? undefined,
      }});
      const result = await tick({ data: { kind: "anchor" } });
      const milestoneText = result.milestone ? `${result.milestone}-day anchor streak. You're building.` : "Anchor set.";
      celebrate("cannons", {
        toast: milestoneText,
        milestone: {
          title: "Anchor set.",
          subtitle: "One verse. One breath. One step.",
          bigNumber: result.milestone ?? undefined,
        },
      });
      // Evaluate trophies (first anchor, 7-day streak, 30 total)
      import("@/lib/achievements.functions").then(({ evaluateAchievements }) =>
        evaluateAchievements().then((r) =>
          import("@/components/AchievementUnlockOverlay").then(({ pushUnlocks }) => pushUnlocks(r.unlocked))
        ).catch(() => {})
      );
      onSaved();
      // Refresh dashboard's anchor check-off so it reflects immediately on return.
      queryClient.invalidateQueries({ queryKey: ["spirit-today-todo"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (cameFromToday()) {
        if (breathDone) {
          setTimeout(() => navigate({ to: "/app" }), 1400);
        } else {
          toast("One more thing — finish the breath.", { description: "We'll send you home after." });
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {crisis && <CrisisCard severity={crisis.severity} onDismiss={() => setCrisis(null)} />}
      <section className="card-elevated p-5 space-y-4">
        <p className="label-mono text-gold">Your reflection</p>

        <MoodPicker
          label="How are you feeling right now?"
          value={existing?.mood_before != null ? moodAfter : moodBefore}
          onChange={(v) => {
            // First save of the day → mood_before. Subsequent edits → mood_after.
            if (existing?.mood_before != null) setMoodAfter(v);
            else setMoodBefore(v);
          }}
        />
        <p className="text-[11px] text-muted-foreground -mt-2">
          Your mood is shared with Coach. Your words stay private.
        </p>

        <textarea
          rows={5}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Write what came up. Only you and Coach P see this."
          className="w-full rounded-md border border-border bg-input p-3 text-sm focus:border-gold focus:outline-none"
        />

        <button onClick={onSave} disabled={busy} className="btn-gold h-12 w-full rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
          <Save className="h-4 w-4" />
          {busy ? "Saving…" : "Save reflection"}
        </button>
      </section>
    </>
  );
}

function MoodPicker({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  const OPTIONS = [
    { v: 2, Icon: CloudRain, word: "Rough" },
    { v: 4, Icon: Frown, word: "Off" },
    { v: 6, Icon: Meh, word: "Steady" },
    { v: 8, Icon: Smile, word: "Good" },
    { v: 10, Icon: Laugh, word: "Strong" },
  ];
  return (
    <div>
      <p className="label-mono text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`h-16 min-w-0 px-1 rounded-md border flex flex-col items-center justify-center gap-1 transition ${value === o.v ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            <o.Icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="label-mono text-[10px] leading-tight w-full text-center truncate">{o.word}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TraditionPicker({ current, onChange }: { current: string; onChange: () => void }) {
  const setT = useServerFn(setTradition);
  const [busy, setBusy] = useState(false);
  async function pick(v: typeof TRADITIONS[number]["v"]) {
    setBusy(true);
    try {
      await setT({ data: { tradition: v } });
      toast.success("Tradition updated.");
      onChange();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <p className="font-display text-lg text-foreground">
        Every faith has a word for this.
      </p>
      <p className="text-sm text-muted-foreground">This is yours.</p>
      <p className="mt-4 label-mono text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-gold" /> Source tradition
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {TRADITIONS.map((t) => (
          <button
            key={t.v}
            disabled={busy}
            onClick={() => pick(t.v)}
            className={`h-9 rounded-md border text-xs font-medium transition ${current === t.v ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >{t.label}</button>
        ))}
      </div>
      {current === "native_indigenous" && <TribeInput />}
    </section>
  );
}

function TribeInput() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getFaithSettings);
  const saveTribe = useServerFn(setTribeLabel);
  const { data, refetch } = useQuery({
    queryKey: ["faith-settings"],
    queryFn: () => fetchSettings(),
  });
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (data && !initialized.current) {
      setValue(data.tribe_label ?? "");
      initialized.current = true;
    }
  }, [data]);

  async function onSave() {
    setBusy(true);
    try {
      const trimmed = value.trim().slice(0, 80);
      await saveTribe({ data: { tribe_label: trimmed || null } });
      toast.success(trimmed ? `Praying as ${trimmed}.` : "Tribe cleared.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["faith-settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-2">
      <label className="label-mono text-xs text-muted-foreground block">
        Your nation / tribe (optional)
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={80}
          placeholder="e.g. Kumeyaay, Lakota, Diné, Māori…"
          className="flex-1 h-10 rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
        />
        <button
          onClick={onSave}
          disabled={busy}
          className="btn-gold h-10 px-4 rounded-md text-xs font-medium disabled:opacity-60"
        >
          {busy ? "…" : "Save"}
        </button>
      </div>
      {data?.tribe_label && (
        <p className="text-[11px] text-muted-foreground">
          Praying as <span className="text-gold">{data.tribe_label}</span>. Coach P will honor this in replies.
        </p>
      )}
      {!data?.tribe_label && (
        <p className="text-[11px] text-muted-foreground">
          We'll keep your nation in mind in Coach P's daily &amp; weekly nudges.
        </p>
      )}
    </div>
  );
}
