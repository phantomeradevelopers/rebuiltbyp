import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { getToday } from "@/lib/dashboard.functions";
import { getTodayNutrition } from "@/lib/nutrition.functions";
import { getTodayMindset } from "@/lib/mindset.functions";
import { getTodayAnchor } from "@/lib/spirit.functions";
import { getFaithSettings } from "@/lib/faith.functions";
import { celebrateTask } from "@/lib/celebrate";

function localTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyMissionList() {
  const navigate = useNavigate();
  const today = localTodayISO();

  const todayQ = useQuery({
    queryKey: ["today", today],
    queryFn: () => getToday({ data: { date: today } }),
    staleTime: 30_000,
  });
  const nutQ = useQuery({
    queryKey: ["today-nutrition", today],
    queryFn: () => getTodayNutrition({ data: { date: today } }),
    staleTime: 30_000,
  });
  const mindQ = useQuery({
    queryKey: ["mindset-today-todo", today],
    queryFn: () => getTodayMindset({ data: { date: today } }),
    staleTime: 30_000,
  });
  const anchorQ = useQuery({
    queryKey: ["spirit-today-todo", today],
    queryFn: () => getTodayAnchor({ data: { date: today } }),
    staleTime: 30_000,
  });
  const faithQ = useQuery({
    queryKey: ["faith-settings"],
    queryFn: () => getFaithSettings(),
    staleTime: 5 * 60_000,
  });
  const faithEnabled = faithQ.data?.faith_mode_enabled === true;

  const t = todayQ.data;
  const n = nutQ.data;

  const completionOrderRef = useRef<Map<string, number>>(new Map());
  const celebratedKeysRef = useRef<Set<string> | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const trainingDone =
    !!t &&
    ((t.lastCheckin?.date === today && t.lastCheckin.workout_completed) ||
      !t.todayWorkout ||
      (t.todayWorkout?.exercises?.length ?? 0) === 0);
  const calsHit = !!(n?.targets && n.totals.calories >= n.targets.calories);
  const protHit = !!(n?.targets && n.totals.protein_g >= n.targets.protein_g);
  const checkinDone = !!t?.checkinDoneToday;
  const mindsetDone = !!mindQ.data?.completedAt;
  const anchorDone = !!anchorQ.data?.reflection;

  const canonical = [
    {
      key: "training",
      done: trainingDone,
      label: t?.todayWorkout ? "Today's training" : "Active recovery",
      sub: t?.todayWorkout?.title ?? "Rest day",
      onClick: () => navigate({ to: "/app/plan", search: { from: "today" } }),
    },
    {
      key: "calories",
      done: calsHit,
      label: "Hit calorie target",
      sub: n?.targets
        ? `${n.totals.calories} / ${n.targets.calories} kcal`
        : "No target set",
      onClick: () => navigate({ to: "/app/nutrition", search: { from: "today" } }),
    },
    {
      key: "protein",
      done: protHit,
      label: "Hit protein target",
      sub: n?.targets
        ? `${n.totals.protein_g} / ${n.targets.protein_g}g`
        : "No target set",
      onClick: () => navigate({ to: "/app/nutrition", search: { from: "today" } }),
    },
    {
      key: "checkin",
      done: checkinDone,
      label: "Daily check-in",
      sub: checkinDone ? "Done" : "~90 sec with P",
      onClick: () => navigate({ to: "/app/checkin/today" }),
    },
    {
      key: "mindset",
      done: mindsetDone,
      label: "Mindset rep",
      sub: mindsetDone ? "Locked in." : (mindQ.data?.repTitle ?? "2 minutes"),
      onClick: () => navigate({ to: "/app" }),
    },
    ...(faithEnabled
      ? [{
          key: "anchor",
          done: anchorDone,
          label: "Today's anchor",
          sub: anchorDone ? "Reflected." : (anchorQ.data?.anchor?.theme ?? "2 minutes"),
          onClick: () =>
            navigate({ to: "/app/spirit", search: { from: "today", date: today } }),
        }]
      : []),
  ];

  const idx = new Map(canonical.map((it, i) => [it.key, i]));
  const order = completionOrderRef.current;
  const items = [...canonical].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0);
    return (idx.get(a.key) ?? 0) - (idx.get(b.key) ?? 0);
  });

  const total = canonical.length;
  const doneCount = canonical.filter((c) => c.done).length;
  const remaining = total - doneCount;

  // Stable signature of which task keys are currently done. Drives the
  // celebrate effect so it only re-runs when the SET of done tasks changes
  // (not on every render or unrelated total changes).
  const doneKeysSig = canonical
    .filter((c) => c.done)
    .map((c) => c.key)
    .sort()
    .join(",");

  useEffect(() => {
    const ord = completionOrderRef.current;
    const doneKeys = canonical.filter((c) => c.done).map((c) => c.key);
    const doneSet = new Set(doneKeys);

    // Maintain ordering map here (out of render) so StrictMode double-render
    // can't fire side effects twice.
    for (const k of doneKeys) if (!ord.has(k)) ord.set(k, Date.now());
    for (const k of [...ord.keys()]) if (!doneSet.has(k)) ord.delete(k);

    // First pass: seed with already-done tasks so we never confetti on load.
    if (celebratedKeysRef.current === null) {
      celebratedKeysRef.current = new Set(doneKeys);
      return;
    }

    const celebrated = celebratedKeysRef.current;
    // If a task was un-done, drop it from celebrated so re-completion re-fires.
    for (const k of [...celebrated]) if (!doneSet.has(k)) celebrated.delete(k);

    const newlyDone = doneKeys.filter((k) => !celebrated.has(k));
    if (newlyDone.length === 0) return;

    const totalNow = canonical.length;
    const doneNow = doneSet.size;
    newlyDone.forEach((key, i) => {
      celebrated.add(key);
      const item = canonical.find((c) => c.key === key);
      const remainingAfter = totalNow - doneNow + (newlyDone.length - 1 - i);
      celebrateTask(remainingAfter, totalNow, item?.label ?? "Task");
    });

    const lastKey = newlyDone[newlyDone.length - 1];
    setHighlightKey(lastKey);
    const timer = setTimeout(
      () => setHighlightKey((k) => (k === lastKey ? null : k)),
      900,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKeysSig]);

  const subtitle =
    doneCount === 0
      ? "Six reps. One better you. Let's go."
      : doneCount >= total
        ? "All six. That's someone who keeps their word."
        : `${remaining} more to go. Don't stop short.`;

  return (
    <section className="card-elevated p-5">
      <p className="label-mono text-gold flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3" /> Today's mission
      </p>
      <p className="mt-1 font-display text-xl leading-tight">{subtitle}</p>
      <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold/60 to-gold transition-all duration-500"
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>
      <ul className="mt-3 divide-y divide-border/60">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.key}
              layout
              transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
              className={
                highlightKey === it.key
                  ? "rounded-md ring-1 ring-gold/40 shadow-[0_0_24px_-8px_oklch(0.74_0.10_80/0.6)]"
                  : ""
              }
            >
              <button
                onClick={it.onClick}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                {it.done ? (
                  <CheckCircle2 className="h-5 w-5 text-gold shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      it.done
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {it.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{it.sub}</p>
                </div>
                {!it.done && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
