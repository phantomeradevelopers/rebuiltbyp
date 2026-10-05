import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";
import { logMeal } from "@/lib/nutrition.functions";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, ChefHat, ShoppingCart, UtensilsCrossed, Flame, Copy, Clock,
  RefreshCw, Utensils, Wand2, BookOpen, MessageCircle, Sparkles, Check, X, Store, Beef, Eye, EyeOff, Camera, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getToday } from "@/lib/dashboard.functions";
import type { MealDay, PlannedMeal, GroceryGroup, NutritionPlan } from "@/lib/dashboard.functions";
import { listSuggestions, curateNutrition, dismissSuggestion } from "@/lib/nutrition-curator.functions";
import { regenerateMeal, listMealOverrides, commitMealOverride } from "@/lib/meal-regenerate.functions";
import { swapMealForFastFood, type FastFoodMeal } from "@/lib/meal-fastfood.functions";
import { listMealCompletions, toggleMealCompletion } from "@/lib/meal-completions.functions";
import { getTodayNutrition } from "@/lib/nutrition.functions";
import { humanizeIngredient } from "@/lib/units";
import { getOrGenerateMealImage } from "@/lib/meal-images.functions";
import { estimateMeal, type MealEstimate } from "@/lib/meal-estimator.functions";
import { getDayTotals } from "@/lib/food-log.functions";
import { getProfile } from "@/lib/profile.functions";
import { BackToTodayPill } from "@/components/BackToTodayPill";
import { PageHeader } from "@/components/rebuilt/PageHeader";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { MealSwapSheet } from "@/components/nutrition/MealSwapSheet";
import { FastFoodSheet } from "@/components/nutrition/FastFoodSheet";
import { PhotoEstimateSheet } from "@/components/nutrition/PhotoEstimateSheet";
import { GatedCameraFab } from "@/components/nutrition/GatedCameraFab";
import { FuelFeelCard } from "@/components/nutrition/FuelFeelCard";

export const Route = createFileRoute("/app/nutrition")({
  head: () => ({ meta: [{ title: "Fuel — Rebuilt" }] }),
  component: NutritionPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-3 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Suggestion = {
  id: string;
  kind: string;
  category?: string | null;
  title: string;
  body: string;
  store_or_brand: string | null;
  rationale: string | null;
  saved: boolean;
  menu_item?: string | null;
  order_lines?: string[] | null;
  macros?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } | null;
  why?: string | null;
};

type Tab = "today" | "meals" | "grocery" | "eatout";

function NutritionPage() {
  const [tab, setTab] = useState<Tab>("today");

  const todayQuery = useQuery({ queryKey: ["nutrition-today"], queryFn: () => getToday(), staleTime: 60_000 });
  const profileQuery = useQuery({ queryKey: ["nutrition-profile"], queryFn: () => getProfile(), staleTime: 60_000 });
  const suggestionsQuery = useQuery({
    queryKey: ["nutrition-suggestions"],
    queryFn: () => listSuggestions(),
    staleTime: 60_000,
  });

  const suggestions = (suggestionsQuery.data?.suggestions ?? []) as Suggestion[];
  const grocerySuggestions = suggestions.filter((s) => (s.category ?? categoryFor(s.kind)) === "grocery");
  const restaurantSuggestions = suggestions.filter((s) => (s.category ?? categoryFor(s.kind)) === "restaurant");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (profileQuery.data as any)?.profile ?? null;
  const groceryStores: string[] = profile?.grocery_stores ?? [];
  const restaurants: string[] = profile?.restaurants ?? [];

  return (
    <div className="min-h-dvh bg-[color:var(--background)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-24">
        <PageHeader
          eyebrow="Fuel"
          title="Eat to win."
          subtitle="One target. One plan. One list."
          backTo="/app"
        />
        <div className="mt-6">
          <BackToTodayPill />
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[color:var(--bg-raised)] border border-[color:var(--border-default)]">
          <TabButton active={tab === "today"} onClick={() => setTab("today")}><Flame className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Today</span><span className="sm:hidden">Today</span></TabButton>
          <TabButton active={tab === "meals"} onClick={() => setTab("meals")}><ChefHat className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Meals</span><span className="sm:hidden">Meals</span></TabButton>
          <TabButton active={tab === "grocery"} onClick={() => setTab("grocery")}><ShoppingCart className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Grocery</span><span className="sm:hidden">List</span></TabButton>
          <TabButton active={tab === "eatout"} onClick={() => setTab("eatout")}><UtensilsCrossed className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Eat Out</span><span className="sm:hidden">Out</span></TabButton>
        </div>

        {tab === "today" && <DailyTotalsStrip />}

        {tab === "today" && (
          <TodayTab
            loading={todayQuery.isLoading}
            nutrition={todayQuery.data?.nutrition ?? null}
            mealPlan={todayQuery.data?.nutrition?.meal_plan ?? null}
            todayDow={todayQuery.data?.dayOfWeek ?? 1}
          />
        )}

        {tab === "meals" && (
          <MealsTab
            loading={todayQuery.isLoading}
            mealPlan={todayQuery.data?.nutrition?.meal_plan ?? null}
            todayDow={todayQuery.data?.dayOfWeek ?? 1}
          />
        )}

        {tab === "grocery" && (
          <GroceryTab
            loading={todayQuery.isLoading}
            groceryList={todayQuery.data?.nutrition?.grocery_list ?? null}
            mealPlan={todayQuery.data?.nutrition?.meal_plan ?? null}
            stores={groceryStores}
            suggestions={grocerySuggestions}
          />
        )}

        {tab === "eatout" && (
          <EatOutTab
            loading={suggestionsQuery.isLoading || profileQuery.isLoading}
            restaurants={restaurants}
            suggestions={restaurantSuggestions}
          />
        )}
        <AskCoachFooter prompt="Stuck on what to eat? Ask P." />
      </div>
      {tab === "today" && <GatedCameraFab />}
    </div>
  );
}

function DailyTotalsStrip() {
  const q = useQuery({
    queryKey: ["nutrition-today-totals"],
    queryFn: () => getDayTotals({ data: {} }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const t = q.data;
  return (
    <div className="mt-3 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-raised)] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--rebuilt-gold)] font-semibold">
          Today's intake
        </p>
        <p className="text-[10px] text-[color:var(--text-tertiary)] tabular-nums">
          {t ? `${t.entries} logged` : ""}
        </p>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        <TotalCell label="Kcal" value={t?.kcal ?? 0} loading={q.isLoading} />
        <TotalCell label="Protein" value={t?.protein_g ?? 0} suffix="g" loading={q.isLoading} />
        <TotalCell label="Carbs" value={t?.carbs_g ?? 0} suffix="g" loading={q.isLoading} />
        <TotalCell label="Fat" value={t?.fat_g ?? 0} suffix="g" loading={q.isLoading} />
      </div>
    </div>
  );
}

function TotalCell({ label, value, suffix, loading }: { label: string; value: number; suffix?: string; loading?: boolean }) {
  return (
    <div className="rounded-lg bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] px-2 py-1.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold text-[color:var(--text-primary)] tabular-nums">
        {loading ? "—" : `${Math.round(value)}${suffix ?? ""}`}
      </p>
    </div>
  );
}

function categoryFor(kind: string): string {
  if (kind === "restaurant_order") return "restaurant";
  if (kind === "swap" || kind === "shake" || kind === "sweet_sub") return "grocery";
  return "learn";
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`min-h-11 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${active ? "bg-[color:var(--bg-elevated)] text-[color:var(--rebuilt-gold)]" : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"}`}>
      {children}
    </button>
  );
}

/* ------------------------------- TODAY TAB ------------------------------- */

function TodayTab({
  loading, nutrition, mealPlan, todayDow,
}: {
  loading: boolean;
  nutrition: NutritionPlan | null;
  mealPlan: MealDay[] | null;
  todayDow: number;
}) {
  const totalsQuery = useQuery({
    queryKey: ["nutrition-today-totals"],
    queryFn: () => getTodayNutrition(),
    staleTime: 30_000,
  });
  const completionsQuery = useQuery({
    queryKey: ["meal-completions"],
    queryFn: () => listMealCompletions(),
    staleTime: 30_000,
  });

  if (loading) return <p className="mt-6 text-sm text-muted-foreground text-center">Loading…</p>;

  if (!nutrition) {
    return (
      <EmptyPlan />
    );
  }

  const today = mealPlan?.find((d) => d.day === todayDow) ?? mealPlan?.[0] ?? null;
  const target = today?.day_type === "rest" && nutrition.rest_day ? nutrition.rest_day : (nutrition.training_day ?? {
    calories: nutrition.calories,
    protein_g: nutrition.protein_g,
    carbs_g: nutrition.carbs_g,
    fat_g: nutrition.fat_g,
  });

  const totals = totalsQuery.data?.totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const completions = completionsQuery.data?.completions ?? [];
  const kcalPct = Math.min(100, Math.round((totals.calories / Math.max(1, target.calories)) * 100));
  const proteinPct = Math.min(100, Math.round((totals.protein_g / Math.max(1, target.protein_g)) * 100));

  return (
    <div className="mt-5 space-y-4">
      {/* Daily target dashboard */}
      <section className="card-elevated p-5">
        <div className="flex items-baseline justify-between">
          <p className="label-mono text-[10px] text-gold">{today?.day_type === "rest" ? "REST DAY" : "TRAINING DAY"} · TODAY</p>
          {nutrition.hydration_ml ? (
            <p className="label-mono text-[10px] text-muted-foreground">{Math.round(nutrition.hydration_ml / 1000 * 10) / 10}L water</p>
          ) : null}
        </div>
        <p className="mt-2 font-display text-4xl text-gold">{target.calories}</p>
        <p className="label-mono text-[10px] text-muted-foreground -mt-1">CALORIES TARGET</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MacroTile label="Protein" value={`${target.protein_g}g`} />
          <MacroTile label="Carbs" value={`${target.carbs_g}g`} />
          <MacroTile label="Fat" value={`${target.fat_g}g`} />
        </div>

        {/* Consumed so far */}
        <div className="mt-5 pt-4 border-t border-border space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="label-mono text-[10px] text-muted-foreground">TODAY SO FAR</p>
            <p className="label-mono text-[10px] text-muted-foreground">Marks "Done" auto-log</p>
          </div>
          <ProgressRow label="Calories" current={totals.calories} target={target.calories} unit="kcal" pct={kcalPct} />
          <ProgressRow label="Protein" current={totals.protein_g} target={target.protein_g} unit="g" pct={proteinPct} />
        </div>
      </section>

      {/* AI feel — how you're doing today */}
      <FuelFeelCard />

      {/* Logged meals (with photo thumbnails) */}
      <LoggedMealsFeed meals={totalsQuery.data?.meals ?? []} />

      {/* Today's meals */}
      {today && today.meals.length > 0 && (
        <MealList
          meals={today.meals}
          day={today.day}
          completions={completions}
          canComplete
        />
      )}

      {/* Lessons & library — real link to the Academy index */}
      <Link
        to={"/app/nutrition/academy" as never}
        className="card-elevated p-4 flex items-center gap-3 hover:border-gold/40 transition"
      >
        <BookOpen className="h-5 w-5 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base">Lessons & food library</p>
          <p className="text-[11px] text-muted-foreground">Short reads on protein, fiber, fats and more.</p>
        </div>
      </Link>

      {/* Ask P — kept as a single inline CTA, not a duplicate card */}
      <Link
        to="/app/coach"
        className="card-elevated p-4 flex items-center gap-3 hover:border-gold/40 transition"
      >
        <MessageCircle className="h-5 w-5 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base">Ask P about food</p>
          <p className="text-[11px] text-muted-foreground">Swaps, timing, alcohol, eating out — straight answers.</p>
        </div>
      </Link>
    </div>
  );
}

function ProgressRow({ label, current, target, unit, pct }: { label: string; current: number; target: number; unit: string; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[color:var(--text-primary)]">{label}</span>
        <span className="font-mono text-[color:var(--text-tertiary)]">
          <span className="text-[color:var(--text-primary)]">{Math.round(current)}</span> / {target}{unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[color:var(--bg-sunken)] overflow-hidden">
        <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MacroTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[color:var(--bg-sunken)] border border-[color:var(--border-default)] px-3 py-2.5">
      <p className="label-mono text-[10px] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 font-display text-lg text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}


function EmptyPlan() {
  return (
    <div className="mt-6 card-elevated p-6 text-center">
      <ChefHat className="h-6 w-6 text-gold mx-auto" />
      <p className="mt-3 font-display text-lg">No plan yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Generate your plan and your meals, grocery list and macros will fill in here.</p>
      <Link to="/app/plan" className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-md btn-gold text-sm font-medium">Go to Plan</Link>
    </div>
  );
}

/* ------------------------------- MEALS TAB ------------------------------- */

function MealsTab({
  loading, mealPlan, todayDow,
}: {
  loading: boolean;
  mealPlan: MealDay[] | null;
  todayDow: number;
}) {
  const initialDay = mealPlan?.find((d) => d.day === todayDow)?.day ?? mealPlan?.[0]?.day ?? 1;
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);

  const overridesQuery = useQuery({
    queryKey: ["meal-overrides"],
    queryFn: () => listMealOverrides(),
    staleTime: 30_000,
  });

  const completionsQuery = useQuery({
    queryKey: ["meal-completions"],
    queryFn: () => listMealCompletions(),
    staleTime: 30_000,
  });

  if (loading) return <p className="mt-6 text-sm text-muted-foreground text-center">Loading your meal plan…</p>;
  if (!mealPlan || mealPlan.length === 0) return <EmptyPlan />;

  const day = mealPlan.find((d) => d.day === selectedDay) ?? mealPlan[0];
  const overrides = overridesQuery.data?.overrides ?? [];
  const completions = completionsQuery.data?.completions ?? [];
  const effectiveMeals: PlannedMeal[] = day.meals.map((m) => {
    const ov = overrides.find((o) => o.day === day.day && o.slot === m.slot);
    return ov ? ({ ...m, ...(ov.meal as object) } as PlannedMeal) : m;
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {mealPlan.map((d) => (
          <button
            key={d.day}
            onClick={() => setSelectedDay(d.day)}
            className={`shrink-0 h-10 px-3.5 rounded-full text-xs font-medium transition-all active:scale-95 ${selectedDay === d.day ? "bg-gold text-gold-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
          >
            {d.day_label}{d.day === todayDow ? " · Today" : ""}
          </button>
        ))}
      </div>

      <div className="card-elevated p-4 flex items-baseline justify-between">
        <p className="label-mono text-[10px] text-gold capitalize">{day.day_type} day</p>
        <p className="label-mono text-[10px] text-muted-foreground">{day.total_calories} kcal · {day.total_protein_g}g P</p>
      </div>

      <MealList
        meals={effectiveMeals}
        day={day.day}
        completions={day.day === todayDow ? completions : []}
        canComplete={day.day === todayDow}
      />
    </div>
  );
}

/* ------------------------------ MEAL LIST ------------------------------ */

function MealList({
  meals, day, completions, canComplete,
}: {
  meals: PlannedMeal[];
  day: number;
  completions: { day: number; slot: string }[];
  canComplete: boolean;
}) {
  const [showCompleted, setShowCompleted] = useState(false);

  const isDone = (slot: string) => completions.some((c) => c.day === day && c.slot === slot);
  const doneCount = meals.filter((m) => isDone(m.slot)).length;
  const visible = canComplete && !showCompleted ? meals.filter((m) => !isDone(m.slot)) : meals;

  return (
    <section>
      <div className="flex items-center justify-between mb-2 min-h-6">
        <p className="label-mono text-[10px] text-muted-foreground">
          {canComplete ? "TODAY'S MEALS" : "MEALS"}
          {doneCount > 0 && (
            <span className="ml-2 text-gold">· {doneCount} done</span>
          )}
        </p>
        {canComplete && doneCount > 0 && (
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition active:scale-95"
          >
            {showCompleted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showCompleted ? "Hide completed" : `Show ${doneCount} completed`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card-elevated p-6 text-center">
          <Check className="h-6 w-6 text-gold mx-auto" />
          <p className="mt-2 font-display text-lg">All meals logged.</p>
          <p className="mt-1 text-xs text-muted-foreground">Nicely done. Tap "Show completed" to review.</p>
        </div>
      ) : (
        <motion.div layout className="grid gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((m) => (
              <motion.div
                key={`${day}-${m.slot}-${m.name}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <MealCard meal={m} day={day} completed={isDone(m.slot)} canComplete={canComplete} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

function MealCard({ meal, day, completed = false, canComplete = false }: { meal: PlannedMeal & { seasonings?: string[]; steps?: string[]; source?: string; chain?: string; menu_item?: string; order_lines?: string[] }; day: number; completed?: boolean; canComplete?: boolean }) {
  const qc = useQueryClient();

  // Staged fast-food override — visible on the card until user taps Done.
  const [stagedFf, setStagedFf] = useState<FastFoodMeal | null>(null);

  // Effective meal = staged fast-food preview if present, otherwise the planned meal.
  const view = stagedFf
    ? ({ ...stagedFf, source: "fast_food" as const })
    : meal;

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [regenBusy] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [ffOpen, setFfOpen] = useState(false);
  const [ffBusy, setFfBusy] = useState(false);
  const [doneBusy, setDoneBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateRetrying, setEstimateRetrying] = useState(false);
  // Hold the last attempt's payload so the sheet's "Try again" button can
  // re-call the vision model without forcing the user to re-take the photo.
  const lastPhotoAttemptRef = useRef<{ base64: string; mime: string; photo_path: string | null } | null>(null);
  const [pendingPhotoPath, setPendingPhotoPath] = useState<string | null>(null);
  const [estimateLogBusy, setEstimateLogBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const isFastFood = view.source === "fast_food";

  async function runEstimate(payload: { base64: string; mime: string; photo_path: string | null }, opts: { retry?: boolean } = {}) {
    if (opts.retry) setEstimateRetrying(true); else setPhotoBusy(true);
    setEstimateError(null);
    try {
      const est = await estimateMeal({
        data: { kind: "photo", image_base64: payload.base64, mime: payload.mime, meal_hint: meal.slot },
      });
      setPendingPhotoPath(payload.photo_path);
      setEstimate(est);
      setEstimateOpen(true);
    } catch (e) {
      console.error("photo estimate failed", e);
      const msg = (e as Error).message || "Couldn't read the photo.";
      setEstimate(null);
      setEstimateError(msg);
      setEstimateOpen(true);
    } finally {
      if (opts.retry) setEstimateRetrying(false); else setPhotoBusy(false);
    }
  }

  // Photo flow: upload → server-side AI vision estimate → confirm sheet → log.
  // The Lovable AI key lives in process.env on the server function; never client.
  async function onPhoto(file: File) {
    if (photoBusy) return;
    let payload: { base64: string; mime: string; photo_path: string | null };
    try {
      const c = await compressImage(file, { maxBytes: 900_000 });
      let photo_path: string | null = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ext = c.mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("meal-photos")
          .upload(path, c.blob, { contentType: c.mime, upsert: false });
        if (!upErr) photo_path = path;
      }
      payload = { base64: c.base64, mime: c.mime, photo_path };
      lastPhotoAttemptRef.current = payload;
    } catch (e) {
      console.error("photo prep failed", e);
      toast.error((e as Error).message || "Couldn't read that image.");
      return;
    }
    await runEstimate(payload);
  }

  function retryEstimate() {
    const last = lastPhotoAttemptRef.current;
    if (!last) return;
    void runEstimate(last, { retry: true });
  }

  async function logEstimate(final: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; note: string }) {
    setEstimateLogBusy(true);
    try {
      const slot = (["breakfast", "lunch", "dinner", "snack"].includes(meal.slot) ? meal.slot : "snack") as "breakfast" | "lunch" | "dinner" | "snack";
      const notes = final.note ? `ai_estimate: ${final.note}` : "ai_estimate";
      await logMeal({
        data: {
          meal: slot,
          name: final.name,
          calories: final.calories,
          protein_g: final.protein_g,
          carbs_g: final.carbs_g,
          fat_g: final.fat_g,
          photo_path: pendingPhotoPath,
          notes,
        },
      });
      qc.invalidateQueries({ queryKey: ["nutrition-today-totals"] });
      toast.success(`Logged · ${final.calories} kcal · ${final.protein_g}g P`);
      setEstimateOpen(false);
      setEstimate(null);
      setEstimateError(null);
      setPendingPhotoPath(null);
      lastPhotoAttemptRef.current = null;
    } catch (e) {
      console.error("logEstimate failed", e);
      toast.error((e as Error).message || "Couldn't log.");
    } finally {
      setEstimateLogBusy(false);
    }
  }

  // Image fetch — keyed by view.name so swap/stage triggers a fresh image.
  useEffect(() => {
    if (isFastFood) { setImgLoading(false); setImgUrl(null); setImgFailed(false); return; }
    let cancelled = false;
    setImgLoading(true);
    setImgFailed(false);
    setImgUrl(null);
    const ingredients = (view.ingredients ?? []).map((i) => i.item).filter(Boolean).slice(0, 6);
    getOrGenerateMealImage({ data: { name: view.name, ingredients, slot: view.slot } })
      .then((r) => { if (!cancelled) setImgUrl(r.url); })
      .catch(() => { if (!cancelled) setImgFailed(true); })
      .finally(() => { if (!cancelled) setImgLoading(false); });
    return () => { cancelled = true; };
  }, [view.name, view.slot, view.ingredients, isFastFood]);

  void regenerateMeal; // used by MealSwapSheet
  void swapMealForFastFood;

  async function toggleDone() {
    if (!canComplete || doneBusy) return;
    setDoneBusy(true);
    const next = !completed;
    try {
      // If a fast-food item is staged, commit the override first so it persists.
      if (stagedFf && next) {
        setFfBusy(true);
        try {
          await commitMealOverride({ data: { day, slot: meal.slot, meal: stagedFf } });
        } finally {
          setFfBusy(false);
        }
      }
      await toggleMealCompletion({
        data: {
          day,
          slot: meal.slot,
          completed: next,
          name: view.name,
          calories: Math.round(view.calories),
          protein_g: Math.round(view.protein_g),
          carbs_g: Math.round(view.carbs_g),
          fat_g: Math.round(view.fat_g),
        },
      });
      qc.invalidateQueries({ queryKey: ["meal-completions"] });
      qc.invalidateQueries({ queryKey: ["meal-overrides"] });
      qc.invalidateQueries({ queryKey: ["nutrition-today-totals"] });
      qc.invalidateQueries({ queryKey: ["nutrition-today"] });
      if (next) {
        if (stagedFf) setStagedFf(null);
        toast.success(`+${Math.round(view.calories)} kcal · +${Math.round(view.protein_g)}g P logged.`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await toggleMealCompletion({ data: { day, slot: meal.slot, completed: false } });
                qc.invalidateQueries({ queryKey: ["meal-completions"] });
                qc.invalidateQueries({ queryKey: ["nutrition-today-totals"] });
              } catch (err) {
                toast.error((err as Error).message || "Couldn't undo.");
              }
            },
          },
        });
      }
    } catch (e) {
      console.error("toggleMealCompletion failed", e);
      toast.error((e as Error).message || "Couldn't update.");
    } finally {
      setDoneBusy(false);
    }
  }

  return (
    <article className={`card-elevated overflow-hidden transition-all ${completed ? "opacity-70 border border-gold/40" : ""} ${stagedFf ? "border border-amber-400/40" : ""}`}>
      {completed && (
        <div className="bg-gold/10 border-b border-gold/30 px-4 py-1.5 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-gold" />
          <p className="label-mono text-[10px] text-gold">Done today</p>
        </div>
      )}
      {stagedFf && !completed && (
        <div className="bg-amber-400/10 border-b border-amber-400/40 px-4 py-1.5 flex items-center justify-between gap-2">
          <p className="label-mono text-[10px] text-amber-300 inline-flex items-center gap-1.5">
            <Beef className="h-3 w-3" /> Staged — tap Done to log this fast food order
          </p>
          <button
            onClick={() => setStagedFf(null)}
            className="text-amber-300/80 hover:text-amber-200 active:scale-95"
            aria-label="Discard staged"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {!isFastFood && (
        <div className="relative aspect-[16/10] bg-muted/40">
          {imgLoading && !imgUrl && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-6 w-6 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
            </div>
          )}
          {imgFailed && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Utensils className="h-8 w-8 opacity-40" />
            </div>
          )}
          {imgUrl && (
            <img key={view.name} src={imgUrl} alt={view.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
      )}

      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="label-mono text-primary capitalize">
            {isFastFood ? `FAST FOOD${view.chain ? ` · ${view.chain.toUpperCase()}` : ""}` : `${view.slot} · ${view.time_hint}`}
          </p>
          <p className="label-mono inline-flex items-center gap-1 text-foreground/70">
            <Clock className="h-3 w-3" /> {view.prep_minutes} min
          </p>
        </div>
        <h3 className="mt-1.5 font-display text-xl leading-snug text-[color:var(--text-primary)]">{view.name}</h3>
        {isFastFood && view.menu_item && (
          <p className="mt-1 text-sm text-foreground/80"><span className="text-muted-foreground">Menu item:</span> {view.menu_item}</p>
        )}

        {/* Macro tiles */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <MacroPill label="Kcal" value={`${view.calories}`} />
          <MacroPill label="Protein" value={`${view.protein_g}g`} />
          <MacroPill label="Carbs" value={`${view.carbs_g}g`} />
          <MacroPill label="Fat" value={`${view.fat_g}g`} />
        </div>

        {isFastFood && view.order_lines && view.order_lines.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="label-mono text-primary">What to say at the counter</p>
            <ol className="mt-2 space-y-1.5">
              {view.order_lines.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold inline-flex items-center justify-center">{i + 1}</span>
                  <span className="text-foreground">{line}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {view.seasonings && view.seasonings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="label-mono text-foreground/80">Seasonings</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {view.seasonings.map((s, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] capitalize border border-primary/20">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="label-mono text-foreground/80">Ingredients</p>
          <ul className="mt-2 space-y-1.5">
            {view.ingredients.map((ing, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize text-foreground">{ing.item}</span>
                <span className="font-mono text-[12px] text-primary font-semibold text-right">{humanizeIngredient(ing)}</span>
              </li>
            ))}
          </ul>
        </div>

        {view.steps && view.steps.length > 0 && (
          <details className="mt-3 pt-3 border-t border-border">
            <summary className="label-mono cursor-pointer text-foreground/80">{isFastFood ? "Pickup steps" : "How to make it"}</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside text-sm">
              {view.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </details>
        )}

        {view.swap_note && (
          <p className="mt-3 text-xs text-foreground/70 italic">Note: {view.swap_note}</p>
        )}

        {/* Action row: Done · Photo · Swap · Fast food */}
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2">
          <button
            onClick={toggleDone}
            disabled={!canComplete || doneBusy || regenBusy || ffBusy || photoBusy}
            title={canComplete ? "" : "Only today's meals can be marked done"}
            className={`min-h-11 px-2 inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium active:scale-95 disabled:opacity-50 ${completed ? "bg-gold text-gold-foreground border border-gold" : stagedFf ? "btn-ember" : "border border-border bg-card hover:border-gold/40"}`}
          >
            <Check className="h-3.5 w-3.5" />
            {completed ? "Done" : doneBusy ? "…" : stagedFf ? "Log fast food" : "Done"}
          </button>
          <button
            onClick={() => photoRef.current?.click()}
            disabled={!canComplete || regenBusy || ffBusy || doneBusy || photoBusy}
            title={canComplete ? "" : "Only today's meals support photo logging"}
            className="min-h-11 px-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium hover:border-gold/40 active:scale-95 disabled:opacity-60"
          >
            {photoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {photoBusy ? "Reading…" : "Photo"}
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhoto(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setSwapOpen(true)}
            disabled={!canComplete || regenBusy || ffBusy || doneBusy || photoBusy}
            title={canComplete ? "" : "Swap is for today's meals"}
            className="min-h-11 px-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium hover:border-primary/40 active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenBusy ? "animate-spin" : ""}`} />
            Swap
          </button>
          <button
            onClick={() => setFfOpen(true)}
            disabled={!canComplete || regenBusy || ffBusy || doneBusy || photoBusy}
            title={canComplete ? "" : "Fast food is for today's meals"}
            className="min-h-11 px-2 inline-flex items-center justify-center gap-1.5 rounded-md btn-ember text-sm disabled:opacity-60"
          >
            <Beef className="h-3.5 w-3.5" />
            Fast food
          </button>
        </div>
      </div>
      <MealSwapSheet
        open={swapOpen}
        onOpenChange={setSwapOpen}
        day={day}
        slot={meal.slot}
        targetCalories={meal.calories}
        targetProteinG={meal.protein_g}
        currentName={meal.name}
      />
      <FastFoodSheet
        open={ffOpen}
        onOpenChange={setFfOpen}
        day={day}
        slot={meal.slot}
        targetCalories={meal.calories}
        targetProteinG={meal.protein_g}
        currentName={meal.name}
        onStage={(m) => { setStagedFf(m); toast.success(`${m.chain} order staged. Tap Done to log it.`); }}
      />
      <PhotoEstimateSheet
        open={estimateOpen}
        onOpenChange={(o) => {
          setEstimateOpen(o);
          if (!o) {
            setEstimate(null);
            setEstimateError(null);
            setPendingPhotoPath(null);
            lastPhotoAttemptRef.current = null;
          }
        }}
        estimate={estimate}
        busy={estimateLogBusy}
        error={estimateError}
        retrying={estimateRetrying}
        onRetry={retryEstimate}
        onLog={logEstimate}
      />
    </article>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 border border-border/60 px-2.5 py-2 text-center">
      <p className="label-mono-sm text-foreground/70">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ------------------------------ GROCERY TAB ------------------------------ */

function GroceryTab({
  loading, groceryList, mealPlan, stores, suggestions,
}: {
  loading: boolean;
  groceryList: GroceryGroup[] | null;
  mealPlan: MealDay[] | null;
  stores: string[];
  suggestions: Suggestion[];
}) {
  const storeOptions = useMemo(() => ["All stores", ...stores], [stores]);
  const [store, setStore] = useState<string>("All stores");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hideChecked, setHideChecked] = useState(false);

  // Aggregate unique seasonings across the week's meals.
  const pantry = useMemo(() => {
    const set = new Set<string>();
    for (const day of mealPlan ?? []) {
      for (const m of day.meals) {
        // seasonings is optional on regenerated meals
        const s = (m as { seasonings?: string[] }).seasonings ?? [];
        for (const x of s) {
          const t = x.trim().toLowerCase();
          if (t) set.add(t);
        }
      }
    }
    return Array.from(set).sort();
  }, [mealPlan]);

  if (loading) return <p className="mt-6 text-sm text-muted-foreground text-center">Loading…</p>;

  if (!groceryList || groceryList.length === 0) {
    return (
      <div className="mt-6 card-elevated p-6 text-center">
        <ShoppingCart className="h-6 w-6 text-gold mx-auto" />
        <p className="mt-3 font-display text-lg">No grocery list yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Your weekly shopping list shows up here once your meal plan is built.</p>
        <Link to="/app/plan" className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-md btn-gold text-sm font-medium">Build my plan</Link>
      </div>
    );
  }

  const filteredSuggestions = store === "All stores"
    ? suggestions
    : suggestions.filter((s) => (s.store_or_brand ?? "").toLowerCase() === store.toLowerCase());

  function copyAll() {
    const txt = (groceryList ?? [])
      .map((g) => `${g.aisle}\n${g.items.map((it) => `  - ${it.item} (${it.qty} ${it.unit})`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard.writeText(txt).then(
      () => toast.success("Grocery list copied."),
      () => toast.error("Couldn't copy."),
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {stores.length > 0 && (
        <div>
          <p className="label-mono text-[10px] text-muted-foreground mb-1.5">Filter by where you shop</p>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {storeOptions.map((s) => (
              <button key={s} onClick={() => setStore(s)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-medium transition-all active:scale-95 ${store === s ? "bg-gold text-gold-foreground" : "bg-muted/60 text-muted-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="card-elevated p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="label-mono text-[10px] text-gold">SHOPPING LIST · 7 DAYS</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHideChecked((v) => !v)}
              className={`h-9 px-3 rounded-md border text-xs inline-flex items-center gap-1.5 active:scale-95 ${hideChecked ? "border-gold/60 text-gold" : "border-border text-muted-foreground"}`}
            >
              {hideChecked ? "Show all" : "Hide checked"}
            </button>
            <button onClick={copyAll} className="h-9 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:border-gold/40 active:scale-95">
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Tap to check off as you shop.</p>
        <div className="mt-3 space-y-3">
          {groceryList.map((g) => {
            const total = g.items.length;
            const doneCount = g.items.reduce((acc, it, i) => acc + (checked[`${g.aisle}-${i}-${it.item}`] ? 1 : 0), 0);
            const allDone = doneCount === total && total > 0;
            return (
              <div key={g.aisle}>
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm py-1 flex items-center justify-between gap-2">
                  <p className={`label-mono text-[10px] ${allDone ? "text-gold/60 line-through" : "text-muted-foreground"}`}>{g.aisle}</p>
                  <span className={`label-mono text-[10px] ${allDone ? "text-gold" : "text-muted-foreground"}`}>{doneCount} / {total}</span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((it, i) => {
                    const key = `${g.aisle}-${i}-${it.item}`;
                    const isChecked = !!checked[key];
                    if (hideChecked && isChecked) return null;
                    return (
                      <li key={key}>
                        <button
                          onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                          className="w-full flex items-center justify-between gap-2 text-sm py-1.5 active:opacity-70"
                        >
                          <span className={`flex items-center gap-2 capitalize text-left ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                            <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? "bg-gold border-gold" : "border-border"}`}>
                              {isChecked && <Check className="h-3 w-3 text-background" />}
                            </span>
                            {it.item}
                          </span>
                          <span className="label-mono text-[11px] text-muted-foreground">{it.qty} {it.unit}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {pantry.length > 0 && (
        <section className="card-elevated p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <p className="label-mono text-[10px] text-gold">PANTRY &amp; SEASONINGS</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Keep these on hand — they power this week's meals.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pantry.map((s) => (
              <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] capitalize border border-primary/20">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {filteredSuggestions.length > 0 && (
        <section>
          <p className="label-mono text-[10px] text-muted-foreground mb-2">
            P PICKS{store !== "All stores" ? ` @ ${store.toUpperCase()}` : ""}
          </p>
          <ul className="space-y-2">
            {filteredSuggestions.map((s) => <SuggestionCard key={s.id} s={s} />)}
          </ul>
        </section>
      )}

      <RecurateButton />
    </div>
  );
}

/* ------------------------------- EAT OUT TAB ----------------------------- */

function EatOutTab({
  loading, restaurants, suggestions,
}: {
  loading: boolean;
  restaurants: string[];
  suggestions: Suggestion[];
}) {
  const options = useMemo(() => ["All places", ...restaurants], [restaurants]);
  const [place, setPlace] = useState<string>("All places");

  if (loading) return <p className="mt-6 text-sm text-muted-foreground text-center">Loading…</p>;

  if (suggestions.length === 0 && restaurants.length === 0) {
    return (
      <div className="mt-6 card-elevated p-6 text-center">
        <UtensilsCrossed className="h-6 w-6 text-gold mx-auto" />
        <p className="mt-3 font-display text-lg">Add your spots</p>
        <p className="mt-1 text-xs text-muted-foreground">Tell us the restaurants you actually eat at and P will write specific orders that fit your plan.</p>
        <Link to="/app/account" className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-md btn-gold text-sm font-medium">Edit profile</Link>
      </div>
    );
  }

  const filtered = place === "All places"
    ? suggestions
    : suggestions.filter((s) => (s.store_or_brand ?? "").toLowerCase() === place.toLowerCase());

  return (
    <div className="mt-4 space-y-4">
      {restaurants.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {options.map((s) => (
            <button key={s} onClick={() => setPlace(s)}
              className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-medium transition-all active:scale-95 ${place === s ? "bg-gold text-gold-foreground" : "bg-muted/60 text-muted-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card-elevated p-6 text-center">
          <Sparkles className="h-6 w-6 text-gold mx-auto" />
          <p className="mt-3 font-display text-lg">No orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Hit "Refresh picks" below to generate orders for your spots.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((s) => <SuggestionCard key={s.id} s={s} />)}
        </ul>
      )}

      {/* Rule of thumb card */}
      <section className="card-elevated p-5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-gold" />
          <p className="label-mono text-[10px] text-gold">ORDER ANYWHERE</p>
        </div>
        <p className="mt-2 font-display text-base leading-snug">Protein first. Veg next. Smart carb last.</p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>· Double the protein, skip the bun or wrap.</li>
          <li>· Sauces on the side — vinaigrette &gt; creamy.</li>
          <li>· Pick rice, potato or beans over fries.</li>
          <li>· Water or unsweetened tea. Calories drink fast.</li>
        </ul>
      </section>

      <RecurateButton />
    </div>
  );
}

/* ------------------------------ SHARED PIECES ---------------------------- */

function SuggestionCard({ s }: { s: Suggestion }) {
  const qc = useQueryClient();
  async function dismiss() {
    await dismissSuggestion({ data: { id: s.id } });
    qc.invalidateQueries({ queryKey: ["nutrition-suggestions"] });
  }
  const menuItem = s.menu_item ?? s.title;
  const orderLines = s.order_lines ?? [];
  const macros = s.macros ?? null;
  const why = s.why ?? s.rationale ?? null;
  return (
    <li className="card-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {s.store_or_brand && (
            <p className="label-mono text-xs text-primary uppercase tracking-wide">{s.store_or_brand}</p>
          )}
          <p className="mt-1 font-display text-lg leading-snug font-semibold">{menuItem}</p>
        </div>
        <button onClick={dismiss} className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:scale-90 shrink-0" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>

      {orderLines.length > 0 && (
        <div className="mt-3 rounded-md bg-[color:var(--bg-sunken)] border border-border p-3">
          <p className="label-mono text-[11px] uppercase tracking-wide text-foreground/80 mb-2">What to say at the counter</p>
          <ul className="space-y-1.5">
            {orderLines.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug">
                <span className="text-primary font-semibold shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {macros && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {macros.calories != null && <MacroChip label="kcal" value={macros.calories} />}
          {macros.protein_g != null && <MacroChip label="protein" value={`${macros.protein_g}g`} />}
          {macros.carbs_g != null && <MacroChip label="carbs" value={`${macros.carbs_g}g`} />}
          {macros.fat_g != null && <MacroChip label="fat" value={`${macros.fat_g}g`} />}
        </div>
      )}

      {orderLines.length === 0 && s.body && <p className="mt-2 text-sm">{s.body}</p>}

      {why && (
        <p className="mt-3 text-xs text-foreground/70 leading-relaxed">
          <span className="label-mono uppercase text-foreground/80">Why · </span>{why}
        </p>
      )}
    </li>
  );
}

function MacroChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[color:var(--bg-sunken)] border border-border px-2 py-1.5 text-center">
      <div className="font-display text-sm font-semibold leading-tight">{value}</div>
      <div className="label-mono text-[10px] uppercase tracking-wide text-foreground/70 leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function RecurateButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await curateNutrition();
      toast.success(`Refreshed ${r.count} picks.`);
      qc.invalidateQueries({ queryKey: ["nutrition-suggestions"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <button onClick={go} disabled={busy}
      className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-md border border-border text-xs hover:border-gold/40 active:scale-95 disabled:opacity-60">
      <Wand2 className="h-3.5 w-3.5" /> {busy ? "Refreshing…" : "Refresh picks"}
    </button>
  );
}

function LoggedMealsFeed({ meals }: { meals: import("@/lib/nutrition.functions").Meal[] }) {
  if (!meals || meals.length === 0) return null;
  return (
    <section className="card-elevated p-5">
      <div className="flex items-baseline justify-between">
        <p className="label-mono text-[10px] text-gold">LOGGED TODAY · {meals.length}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {meals.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-2">
            {m.photo_url ? (
              <img
                src={m.photo_url}
                alt={m.name}
                loading="lazy"
                className="h-14 w-14 rounded-md object-cover border border-border shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-md bg-muted/50 border border-border shrink-0 grid place-items-center text-muted-foreground">
                <Utensils className="h-5 w-5 opacity-50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
              <p className="label-mono text-[10px] text-muted-foreground capitalize">
                {m.meal} · {new Date(m.logged_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm text-foreground">{m.calories}<span className="text-muted-foreground text-[10px]"> kcal</span></p>
              <p className="label-mono text-[10px] text-muted-foreground">P{m.protein_g} C{m.carbs_g} F{m.fat_g}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
