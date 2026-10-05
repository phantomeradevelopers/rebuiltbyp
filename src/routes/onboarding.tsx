import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Camera, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { submitOnboarding, SCREENER_FLAGS, PHYSIQUE_FOCUS_OPTIONS, type OnboardingPayload } from "@/lib/onboarding.functions";
import { setTrack as setTrackFn, type Track } from "@/lib/track.functions";
import { useTrack } from "@/lib/track";
import { ACTIVITY_OPTIONS, EXPERIENCE_OPTIONS, WORKOUT_STYLE_OPTIONS } from "@/lib/activities";
import { SliderRow } from "@/components/onboarding/SliderRow";
import { TasteCardPager, type TasteCardPagerHandle } from "@/components/onboarding/TasteCardPager";

import { SetAnchorLocation } from "@/components/outdoor/SetAnchorLocation";


import { useTimeFormat } from "@/lib/time-format";
import { TimeDial } from "@/components/TimeDial";

import { uploadBaselinePhoto } from "@/lib/progress-photo-upload";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "@/i18n";
import { AnimatePresence, motion } from "motion/react";
import { HeroGlyph, type GlyphName } from "@/components/brand/HeroGlyph";
import { StepBackdrop } from "@/components/brand/StepBackdrop";
import { GoldMeridian } from "@/components/brand/GoldMeridian";
import { DUR, REBUILT_EASE, DELAY } from "@/lib/motion";
import { haptic } from "@/lib/haptics";

const GROUP_GLYPHS: GlyphName[] = [
  "summit",      // 0 goals_general — motivating question FIRST
  "flag",        // 1 goals_specific
  "signature",   // 2 name
  "ring",        // 3 track (choose your path)
  "silhouette",  // 4 basics
  "sunrise",     // 5 wake_time
  "compass",     // 6 intro (location — moved later, geolocation auto-detected)
  "dial",        // 7 experience + training
  "barbell",     // 8 movement
  "bowl",        // 9 food (nutrition + taste)
  "moon",        // 10 lifestyle
  "shield",      // 11 health / screener
  "ring",        // 12 connected_apps
  "bell",        // 13 accountability / notifications
];

function scrollNextAnchor(from?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  const start = from ?? (document.activeElement as HTMLElement | null);
  requestAnimationFrame(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-anchor]"));
    const baseTop = start?.getBoundingClientRect().bottom ?? 0;
    const next = anchors.find((el) => el.getBoundingClientRect().top > baseTop + 4);
    next?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}


export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — REBUILT" },{ name: "description", content: "Set up your rebuild in a few quick steps." },{ property: "og:title", content: "Welcome — REBUILT" },{ property: "og:description", content: "Set up your rebuild in a few quick steps." },] }),
  component: Onboarding,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" as never });
    // Already onboarded (including demo accounts): go straight to Today.
    const { data: prof } = await supabase
      .from("user_profile")
      .select("onboarding_completed_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (prof?.onboarding_completed_at) throw redirect({ to: "/app" as never });
  },
});

type StepId =
  | "intro" | "name" | "track" | "basics" | "wake_time" | "baseline_photo"
  | "goals_general" | "goals_specific"
  | "experience" | "training" | "movement" | "nutrition" | "taste" | "location" | "lifestyle" | "health" | "screener" | "connected_apps" | "notifications";



// One thing per screen. Motivating question leads. Location moved later so
// most users never type an address — geolocation auto-detects on mount.
const STEP_GROUPS: StepId[][] = [
  ["goals_general"],               // 1. What are we rebuilding? (motivator)
  ["goals_specific"],              // 2. Success metric
  ["name"],                        // 3. Name + gender
  ["track"],                       // 4. Choose your path
  ["basics"],                      // 5. Body basics (units auto-detected)
  ["wake_time"],                   // 6. Wake time
  ["intro"],                       // 7. Where you operate (auto-detected)
  ["experience", "training"],      // 8. Experience + training (merged)
  ["movement"],                    // 9. Movement
  ["nutrition", "taste"],          // 10. Food (substeps inside)
  ["lifestyle"],                   // 11. Recovery + mood
  ["screener", "health"],          // 12. Health flags + injuries + peptide status
  ["connected_apps"],              // 13. Connected apps (intent)
  ["notifications"],               // 14. Accountability + coach voice + consent
];

const TOTAL_GROUPS = STEP_GROUPS.length;

const STEP_LABEL: Partial<Record<StepId, string>> = {
  goals_general: "your goals", goals_specific: "how you measure success", name: "your name",
  track: "your path", basics: "your age, height and weight", wake_time: "your wake time",
  intro: "your country", experience: "your training experience", training: "training days per week",
  movement: "where and how you like to move", nutrition: "how you eat", lifestyle: "sleep and stress",
  notifications: "the terms agreement",
};
const FIELD_TO_STEP: Record<string, StepId> = {
  first_name: "name", gender: "name", age: "basics", height_cm: "basics", weight_kg: "basics",
  goal_weight_kg: "basics", training_days_per_week: "training", session_minutes: "training",
  dietary_pattern: "nutrition", sleep_hours: "lifestyle", stress_level: "lifestyle",
  country_code: "intro", goals: "goals_general", legal_consent_accepted: "notifications",
};


// Countries that use imperial for body weight/height in everyday speech.
const IMPERIAL_COUNTRIES = new Set(["US", "GB", "LR", "MM"]);

const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IS", name: "Iceland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "GR", name: "Greece" },
  { code: "TR", name: "Türkiye" },
  { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "TW", name: "Taiwan" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "MA", name: "Morocco" },
  { code: "LR", name: "Liberia" },
  { code: "MM", name: "Myanmar" },
];

const DIAL_CODES: Record<string, string> = {
  US: "1", CA: "1", GB: "44", AU: "61", NZ: "64", IE: "353", DE: "49", FR: "33",
  ES: "34", IT: "39", PT: "351", NL: "31", BE: "32", CH: "41", AT: "43", SE: "46",
  NO: "47", DK: "45", FI: "358", IS: "354", PL: "48", CZ: "420", GR: "30", TR: "90",
  RO: "40", HU: "36", RU: "7", UA: "380", MX: "52", BR: "55", AR: "54", CL: "56",
  CO: "57", PE: "51", JP: "81", KR: "82", CN: "86", HK: "852", TW: "886", SG: "65",
  MY: "60", ID: "62", PH: "63", TH: "66", VN: "84", IN: "91", PK: "92", BD: "880",
  AE: "971", SA: "966", IL: "972", EG: "20", ZA: "27", NG: "234", KE: "254", MA: "212",
  LR: "231", MM: "95",
};

function flagFromCountry(code: string): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + (code.charCodeAt(0) - a), A + (code.charCodeAt(1) - a));
}

function detectCountry(): string {
  if (typeof navigator === "undefined") return "US";
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const l of langs) {
    const m = /-([A-Z]{2})/.exec(l ?? "");
    if (m && COUNTRIES.some((c) => c.code === m[1])) return m[1];
  }
  return "US";
}

function unitsForCountry(code: string | undefined | null): "metric" | "imperial" {
  return code && IMPERIAL_COUNTRIES.has(code) ? "imperial" : "metric";
}

// Country → suggested language codes, ordered by official prevalence.
// Only codes the app actually translates are surfaced (see SUPPORTED_LANGUAGES).
const COUNTRY_LANGUAGES: Record<string, string[]> = {
  US: ["en", "es"], CA: ["en", "fr"], GB: ["en"], IE: ["en"], AU: ["en"], NZ: ["en"],
  ZA: ["en"], NG: ["en"], KE: ["en"], IN: ["en"], PK: ["en"], BD: ["en"],
  PH: ["en"], SG: ["en"], MY: ["en"], HK: ["en"], IL: ["en"], AE: ["en", "fr"],
  ES: ["es", "en"], MX: ["es", "en"], AR: ["es"], CL: ["es"], CO: ["es"], PE: ["es"],
  FR: ["fr", "en"], BE: ["fr", "de", "en"], CH: ["de", "fr", "en"], LU: ["fr", "de", "en"],
  MA: ["fr", "en"], EG: ["en"],
  DE: ["de", "en"], AT: ["de", "en"],
  PT: ["pt", "en"], BR: ["pt", "en"],
  IT: ["en"], NL: ["en"], SE: ["en"], NO: ["en"], DK: ["en"], FI: ["en"], IS: ["en"],
  PL: ["en"], CZ: ["en"], GR: ["en"], TR: ["en"], RO: ["en"], HU: ["en"],
  RU: ["en"], UA: ["en"], JP: ["en"], KR: ["en"], CN: ["en"], TW: ["en"],
  ID: ["en"], TH: ["en"], VN: ["en"], SA: ["en"], LR: ["en"], MM: ["en"],
};
function languagesForCountry(code?: string | null): string[] {
  const supported = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
  const mapped = (code && COUNTRY_LANGUAGES[code]) || ["en"];
  const filtered = mapped.filter((c) => supported.has(c));
  return filtered.length ? filtered : ["en"];
}



type Draft = Partial<OnboardingPayload> & {
  goals: string[];
  physique_focus: string[];
  success_metric: NonNullable<OnboardingPayload["success_metric"]> | null;
  allergies: string[];
  preferred_training_days: string[];
  screener_conditions: string[];
  taste_profile: NonNullable<OnboardingPayload["taste_profile"]>;
  restaurants: string[];
  grocery_stores: string[];
  location: NonNullable<OnboardingPayload["location"]>;
};

const GOAL_OPTIONS = ["Lose fat", "Build muscle", "Get stronger", "More energy", "Sleep better", "Mental clarity"];

const PHYSIQUE_LABELS: Record<(typeof PHYSIQUE_FOCUS_OPTIONS)[number], string> = {
  six_pack: "Six-pack / visible abs",
  bigger_arms: "Bigger arms",
  bigger_glutes: "Bigger / rounder glutes",
  bigger_chest: "Bigger chest",
  wider_shoulders: "Wider shoulders",
  stronger_back: "Stronger back",
  bigger_legs: "Bigger legs / quads",
  slimmer_waist: "Slimmer waist",
  lose_belly_fat: "Lose belly fat",
  tone_all_over: "Tone all over",
};

const METRIC_OPTIONS: { value: NonNullable<OnboardingPayload["success_metric"]>["type"]; label: string; sub: string; recommended?: boolean }[] = [
  { value: "photo", label: "Progress photos", sub: "Side-by-side proof against your Day 1 photo. The metric that doesn't lie.", recommended: true },
  { value: "target_weight", label: "Scale weight", sub: "Track the number on the scale each week." },
  { value: "measurement", label: "Body measurement", sub: "Track inches/cm on a specific body part (waist, arms, hips…)." },
  { value: "lift_pr", label: "Strength PR", sub: "Track how much you can lift on a key exercise." },
  { value: "coach_decide", label: "Let Coach P decide", sub: "P picks the right metric based on your goals." },
];
const DIET_OPTIONS: { value: OnboardingPayload["dietary_pattern"]; label: string; icon: string; sub: string }[] = [
  { value: "omnivore", label: "Omnivore", icon: "🍗", sub: "Eats everything" },
  { value: "vegetarian", label: "Vegetarian", icon: "🥗", sub: "No meat" },
  { value: "vegan", label: "Vegan", icon: "🌱", sub: "No animal products" },
  { value: "pescatarian", label: "Pescatarian", icon: "🐟", sub: "Fish, no meat" },
  { value: "keto", label: "Keto / low-carb", icon: "🥑", sub: "Low-carb, high-fat" },
  
];
const COMMON_ALLERGIES = ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Gluten", "Shellfish", "Soy", "Sesame"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUGGESTED_SPLIT: Record<number, string[]> = {
  1: ["Sat"],
  2: ["Tue", "Sat"],
  3: ["Mon", "Wed", "Fri"],
  4: ["Mon", "Tue", "Thu", "Fri"],
  5: ["Mon", "Tue", "Wed", "Fri", "Sat"],
  6: ["Mon", "Tue", "Wed", "Fri", "Sat", "Sun"],
  7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
const SCREENER_LABELS: Record<(typeof SCREENER_FLAGS)[number], string> = {
  chest_pain: "Chest pain during exercise",
  heart_condition: "A diagnosed heart condition",
  fainting: "Fainting or dizziness with exertion",
  pregnancy_complication: "A pregnancy with complications",
  uncontrolled_bp: "Uncontrolled high blood pressure",
  recent_surgery: "Surgery within the last 3 months",
  doctor_restricted_exercise: "A doctor told you not to exercise",
  eating_disorder_active: "An active eating disorder",
};

const DEFAULT_DRAFT: Draft = {
  goals: [],
  physique_focus: [],
  success_metric: null,
  allergies: [],
  preferred_training_days: [],
  screener_conditions: [],
  notification_email: true,
  notification_push: true,
  notification_sms: false,
  legal_consent_accepted: false as unknown as true,
  taste_profile: {
    cuisines: [], proteins: [], carbs: [], veggies: [], fats: [],
    sweet_subs: [], flavors: [], hard_nos: [],
    shake_pref: null, notes: null,
  },
  restaurants: [],
  grocery_stores: [],
  location: {},
  preferred_activities: [],
  activity_notes: null,
  connected_apps_interest: [],
  faith_mode_enabled: false,
  mood_today: null,
  top_drain: null,
  peptide_status: null,
  

};

const TASTE_OPTIONS = {
  cuisines: ["Mexican", "Italian", "Mediterranean", "Japanese", "Chinese", "Thai", "Indian", "Greek", "Middle Eastern", "BBQ / American"],
  proteins: ["Chicken", "Beef", "Ground turkey", "Salmon", "Tuna", "Eggs", "Greek yogurt", "Cottage cheese", "Tofu", "Tempeh", "Beans / lentils", "Shrimp", "Pork", "Deli meats", "Whey shake", "Plant shake"],
  carbs: ["White rice", "Brown rice", "Quinoa", "Oats", "Sweet potato", "White potato", "Pasta", "Sourdough", "Tortillas", "Fruit", "Beans", "Low/no carb"],
  veggies: ["Spinach", "Kale", "Broccoli", "Peppers", "Zucchini", "Salad mix", "Carrots", "Cauliflower", "Asparagus", "Onions", "Green beans", "Brussels sprouts", "Tomatoes", "Cucumber", "Mushrooms", "Skip the greens"],
  fats: ["Avocado", "Olive oil", "Nuts", "Nut butter", "Cheese", "Butter", "Seeds", "Coconut"],
  sweet_subs: ["Dark chocolate", "Greek yogurt bowls", "Protein bars", "Fruit + nut butter", "Sugar-free options", "Natural only (dates, honey, maple)"],
  flavors: ["Spicy", "Garlicky", "Smoky", "Sweet-savory", "Herby", "Lemony", "Umami", "Mild"],
} as const;
const RESTAURANT_OPTIONS = ["Chipotle", "Cava", "Sweetgreen", "Panera", "Chick-fil-A", "In-N-Out", "Five Guys", "Subway", "Wendy's", "McDonald's", "Olive Garden", "Local sushi", "Local diner", "Local Mexican", "Local Italian"];
const GROCERY_OPTIONS = ["Trader Joe's", "Whole Foods", "Costco", "Walmart", "Kroger", "Aldi", "Target", "Sprouts", "Local market"];
const SHAKE_OPTIONS = ["Whey", "Whey isolate", "Plant-based", "Collagen", "None"];
const ORGANIC_OPTIONS: { value: "always" | "when_affordable" | "no"; label: string; sub: string }[] = [
  { value: "always", label: "Always prefer organic / natural", sub: "Default. We'll recommend organic + minimally processed first." },
  { value: "when_affordable", label: "When it fits the budget", sub: "Mix of organic and conventional based on price." },
  { value: "no", label: "Not important to me", sub: "Convenience and price first." },
];

// ----- Diet / allergy aware filtering for page 5 -----
const DIET_HIDDEN: Record<string, { proteins?: string[]; carbs?: string[]; fats?: string[]; sweet_subs?: string[]; restaurants?: string[]; shakes?: string[] }> = {
  vegan: {
    proteins: ["Chicken", "Beef", "Ground turkey", "Salmon", "Tuna", "Eggs", "Greek yogurt", "Cottage cheese", "Shrimp", "Pork", "Deli meats", "Whey shake"],
    fats: ["Cheese", "Butter"],
    sweet_subs: ["Greek yogurt bowls"],
    restaurants: ["Chick-fil-A", "In-N-Out", "Five Guys", "Wendy's", "McDonald's"],
    shakes: ["Whey", "Whey isolate"],
  },
  vegetarian: {
    proteins: ["Chicken", "Beef", "Ground turkey", "Salmon", "Tuna", "Shrimp", "Pork", "Deli meats"],
  },
  pescatarian: {
    proteins: ["Chicken", "Beef", "Ground turkey", "Pork", "Deli meats"],
  },
  keto: {
    carbs: ["White rice", "Brown rice", "Quinoa", "Oats", "Sweet potato", "White potato", "Pasta", "Sourdough", "Tortillas", "Fruit", "Beans"],
    sweet_subs: ["Fruit + nut butter"],
  },
};
const ALLERGY_HIDES: Record<string, { proteins?: string[]; carbs?: string[]; fats?: string[]; sweet_subs?: string[]; shakes?: string[] }> = {
  Dairy: { proteins: ["Greek yogurt", "Cottage cheese"], fats: ["Cheese", "Butter"], sweet_subs: ["Greek yogurt bowls"], shakes: ["Whey", "Whey isolate"] },
  Gluten: { carbs: ["Pasta", "Sourdough", "Tortillas"] },
  Shellfish: { proteins: ["Shrimp"] },
  Eggs: { proteins: ["Eggs"] },
  "Tree nuts": { fats: ["Nuts", "Nut butter"], sweet_subs: ["Fruit + nut butter"] },
  Peanuts: { fats: ["Nuts", "Nut butter"], sweet_subs: ["Fruit + nut butter"] },
  Soy: { proteins: ["Tofu", "Tempeh", "Plant shake"] },
};
type HiddenSets = { proteins: Set<string>; carbs: Set<string>; fats: Set<string>; sweet_subs: Set<string>; restaurants: Set<string>; shakes: Set<string> };
function computeHidden(diet: string | null | undefined, allergies: string[]): HiddenSets {
  const out: HiddenSets = { proteins: new Set(), carbs: new Set(), fats: new Set(), sweet_subs: new Set(), restaurants: new Set(), shakes: new Set() };
  const apply = (src?: { proteins?: string[]; carbs?: string[]; fats?: string[]; sweet_subs?: string[]; restaurants?: string[]; shakes?: string[] }) => {
    if (!src) return;
    src.proteins?.forEach((x) => out.proteins.add(x));
    src.carbs?.forEach((x) => out.carbs.add(x));
    src.fats?.forEach((x) => out.fats.add(x));
    src.sweet_subs?.forEach((x) => out.sweet_subs.add(x));
    src.restaurants?.forEach((x) => out.restaurants.add(x));
    src.shakes?.forEach((x) => out.shakes.add(x));
  };
  if (diet) apply(DIET_HIDDEN[diet]);
  for (const a of allergies) apply(ALLERGY_HIDES[a]);
  return out;
}

const ONB_STATE_KEY = "onb_state_v2";

function loadOnbState(): { idx: number; d: Draft } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONB_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.idx !== "number" || !parsed?.d) return null;
    return { idx: parsed.idx, d: { ...DEFAULT_DRAFT, ...parsed.d } };
  } catch { return null; }
}

function Onboarding() {
  const navigate = useNavigate();
  // Initialize from defaults to avoid SSR/CSR hydration mismatch; sync from sessionStorage in effect.

  const [idx, setIdx] = useState(0);
  const [d, setD] = useState<Draft>(DEFAULT_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const currentGroup = STEP_GROUPS[idx] ?? STEP_GROUPS[0];
  // Smart skips inside a group
  const shouldSkip = (s: StepId): boolean => {
    if (s === "goals_specific") return d.goals.length <= 1; // only ask if multi-goal
    return false;
  };
  const inGroup = (s: StepId): boolean => currentGroup.includes(s) && !shouldSkip(s);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [busy, setBusy] = useState(false);
  // Track (men / angels) — kept as local state, persisted via setTrackFn on choose.
  const { track: ctxTrack, setTrack: setCtxTrack } = useTrack();
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [trackSaving, setTrackSaving] = useState(false);
  // Pre-seed selectedTrack from gender when arriving at the track step.
  // If no gender yet, leave null so user must explicitly choose.
  useEffect(() => {
    if (!currentGroup.includes("track")) return;
    if (selectedTrack !== null) return;
    const g = (d as { gender?: string }).gender;
    if (g === "female") setSelectedTrack("angels");
    else if (g === "male") setSelectedTrack("men");
    else if (ctxTrack === "angels") setSelectedTrack("angels");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  const [daysManuallyEdited, setDaysManuallyEdited] = useState(false);
  const [otherDiet, setOtherDiet] = useState("");
  const [skipChoice, setSkipChoice] = useState<"none" | "some" | null>(null);
  
  const [foodSubstep, setFoodSubstep] = useState<"pattern" | "allergies" | "taste">("pattern");
  const [lifestyleSubstep, setLifestyleSubstep] = useState<"rest" | "mind">("rest");
  const tasteRef = useRef<TasteCardPagerHandle | null>(null);
  const [tasteIndex, setTasteIndex] = useState(0);
  const [tasteIsLast, setTasteIsLast] = useState(false);
  // Always land on the constraints card with no pill pre-selected.
  useEffect(() => {
    if (tasteIndex === 2) setSkipChoice(null);
  }, [tasteIndex]);
  const sectionRef = useRef<HTMLElement | null>(null);
  // Reset only the food-substep UI marker on idx change. Keep any answers the
  // user already chose — wiping them every entry caused selections to disappear
  // when navigating back into the food step.
  useEffect(() => {
    setFoodSubstep("pattern");
    setLifestyleSubstep("rest");
    setTasteIndex(0);
    setTasteIsLast(false);
  }, [idx]);
  // Reset scroll position to top whenever the visible step changes so the
  // new step is never partially scrolled from the previous step's position.
  useEffect(() => {
    sectionRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [idx, foodSubstep, lifestyleSubstep]);


  const [screenerOpen, setScreenerOpen] = useState(false);
  

  const [, setHomeSavedAt] = useState(0);


  // Auto-fill an ideal weekly split when days/week changes (unless user has manually picked).
  useEffect(() => {
    const n = d.training_days_per_week;
    if (!n) return;
    if (daysManuallyEdited) return;
    const ideal = SUGGESTED_SPLIT[n];
    if (!ideal) return;
    const current = d.preferred_training_days;
    const same = current.length === ideal.length && ideal.every((x) => current.includes(x));
    if (!same) setD((s) => ({ ...s, preferred_training_days: ideal }));
  }, [d.training_days_per_week, daysManuallyEdited]);

  // Hydrate from sessionStorage on mount. Preserve the user's progress and idx
  // — wiping fields and resetting to 0 was the main "form keeps resetting" bug.
  useEffect(() => {
    const saved = loadOnbState();
    let next: Draft = DEFAULT_DRAFT;
    if (saved) {
      // Always require fresh consent on remount; everything else stays.
      const restored: Draft = { ...saved.d, legal_consent_accepted: false as unknown as true } as Draft;
      setIdx(saved.idx);
      next = restored;
      setD(restored);
    }
    // Auto-detect country if not set; derive units from country.
    const existing = (next as { country_code?: string }).country_code;
    if (!existing && typeof navigator !== "undefined") {
      const detected = detectCountry();
      setD((s) => ({ ...s, country_code: detected } as Draft));
      setUnits(unitsForCountry(detected));
    } else {
      setUnits(unitsForCountry(existing));
    }
    setHydrated(true);
  }, []);



  // Persist progress so an unexpected remount (HMR, focus refetch, etc.) can't reset the user.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try { sessionStorage.setItem(ONB_STATE_KEY, JSON.stringify({ idx, d })); } catch { /* quota */ }
  }, [idx, d, hydrated]);

  // If profile already completed, bounce into /app — but only once per mount.
  const [bounceChecked, setBounceChecked] = useState(false);
  useEffect(() => {
    if (bounceChecked) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login" as never, search: { redirect: "/onboarding" } as never });
        return;
      }
      const { data: p } = await supabase
        .from("user_profile")
        .select("onboarding_completed_at, email")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (p?.onboarding_completed_at) {
        try { sessionStorage.removeItem(ONB_STATE_KEY); } catch { /* noop */ }
        navigate({ to: "/app" as never });
      }
      setBounceChecked(true);
    })();
  }, [bounceChecked, navigate]);


  // Track when the user actually interacts with a control on the current step.
  // Auto-advance only fires for the current idx if interaction happened here.
  const interactedAtIdxRef = useRef<number>(-1);
  // Direction of navigation, used when auto-skipping empty groups.
  const navDirRef = useRef<1 | -1>(1);
  const markInteraction = () => { interactedAtIdxRef.current = idx; };
  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    markInteraction();
    setD((s) => ({ ...s, [k]: v }));
  };

  // When diet or allergies change, strip any taste/restaurant/shake selections that no longer fit.
  const reconcileFood = (next: Draft): Draft => {
    const hidden = computeHidden(next.dietary_pattern as string | undefined, next.allergies);
    const tp = { ...(next.taste_profile ?? {}) } as NonNullable<Draft["taste_profile"]>;
    const filterArr = (arr: string[] | undefined, set: Set<string>) => (arr ?? []).filter((x) => !set.has(x));
    tp.proteins = filterArr(tp.proteins as string[] | undefined, hidden.proteins);
    tp.carbs = filterArr(tp.carbs as string[] | undefined, hidden.carbs);
    tp.fats = filterArr(tp.fats as string[] | undefined, hidden.fats);
    tp.sweet_subs = filterArr(tp.sweet_subs as string[] | undefined, hidden.sweet_subs);
    if (tp.shake_pref && hidden.shakes.has(tp.shake_pref as string)) tp.shake_pref = null;
    const restaurants = filterArr(next.restaurants, hidden.restaurants);
    return { ...next, taste_profile: tp, restaurants };
  };
  const setDiet = (v: OnboardingPayload["dietary_pattern"]) =>
    setD((s) => reconcileFood({ ...s, dietary_pattern: v }));
  const setAllergies = (v: string[]) =>
    setD((s) => reconcileFood({ ...s, allergies: v }));

  const toggleIn = (k: "goals" | "preferred_training_days" | "screener_conditions", v: string) =>
    setD((s) => {
      const has = s[k].includes(v);
      if (!has && k === "goals" && s.goals.length + s.physique_focus.length >= 5) return s;
      return { ...s, [k]: has ? s[k].filter((x) => x !== v) : [...s[k], v] };
    });
  const togglePhysique = (v: string) =>
    setD((s) => {
      const has = s.physique_focus.includes(v);
      if (!has && s.goals.length + s.physique_focus.length >= 5) return s;
      return {
        ...s,
        physique_focus: has
          ? s.physique_focus.filter((x) => x !== v)
          : [...s.physique_focus, v],
      };
    });


  const checkStep = (s: StepId): boolean => {
    if (shouldSkip(s)) return true;
    switch (s) {
      case "intro": return !!(d as { country_code?: string }).country_code;
      case "name": return !!d.first_name && d.first_name.length > 0 && ((d as never as { gender?: string }).gender === "male" || (d as never as { gender?: string }).gender === "female");
      case "track": return selectedTrack !== null;

      case "basics": return !!d.age && d.age >= 18 && !!d.height_cm && d.height_cm >= 100 && d.height_cm <= 250 && !!d.weight_kg;
      case "wake_time": return !!d.reminder_time_local && /^\d{1,2}:\d{2}$/.test(d.reminder_time_local);
      case "baseline_photo": return true;
      case "goals_general": return d.goals.length + d.physique_focus.length >= 2;
      case "goals_specific": return true;
      case "experience": return !!(d as { training_experience?: string }).training_experience;
      case "training": return !!d.training_days_per_week && !!d.session_minutes;
      case "movement": {
        const env = (d as { training_environment?: string }).training_environment;
        if (!env) return false;
        const cardio = (d as { cardio_preference?: string }).cardio_preference;
        if (cardio === "none") return true; // lifting only overrides anchor requirement
        const acts = ((d as { preferred_activities?: string[] }).preferred_activities) ?? [];
        return acts.length >= 1;
      }
      case "nutrition": return !!d.dietary_pattern;
      case "taste": return true;
      case "location": return true;
      case "lifestyle": return d.sleep_hours !== undefined && d.stress_level !== undefined;

      case "health": return true;
      case "screener": return true;
      case "connected_apps": return true;
      case "notifications": return (!d.notification_sms || (!!d.phone_e164 && /^\+\d{8,15}$/.test(d.phone_e164))) && d.legal_consent_accepted === true;
      default: return false;
    }
  };
  const firstMissing = useMemo<StepId | null>(() => {
    for (const s of currentGroup) if (!checkStep(s)) return s;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, d, selectedTrack]);
  const canAdvance = firstMissing === null;
  const [missingHighlight, setMissingHighlight] = useState<StepId | null>(null);
  useEffect(() => { setMissingHighlight(null); }, [d, idx]);
  // Sub-field missing key for the current step (e.g. "environment", "anchors", "cardio").
  const [missingField, setMissingField] = useState<string | null>(null);
  useEffect(() => { setMissingField(null); }, [d, idx]);
  useEffect(() => {
    if (!missingField) return;
    const t = window.setTimeout(() => setMissingField(null), 2500);
    return () => window.clearTimeout(t);
  }, [missingField]);


  async function finish() {
    // Final safety net: every required answer must be present before we submit.
    for (let gi = 0; gi < STEP_GROUPS.length; gi++) {
      const bad = STEP_GROUPS[gi].find((st) => !checkStep(st));
      if (bad) {
        navDirRef.current = -1;
        setIdx(gi);
        setMissingHighlight(bad);
        toast.error(`One answer is missing: ${STEP_LABEL[bad] ?? "a required question"}. We took you back to it.`);
        return;
      }
    }
    setBusy(true);
    try {
      // Derive shake_pref from proteins selection (Whey shake / Plant shake chips replace the dedicated shake step).
      const proteins = (d.taste_profile?.proteins ?? []) as string[];
      const derivedShake = proteins.includes("Whey shake") ? "whey" : proteins.includes("Plant shake") ? "plant" : null;
      const payload = { ...d, taste_profile: { ...d.taste_profile, shake_pref: derivedShake } } as unknown as OnboardingPayload;
      const result = await submitOnboarding({ data: payload });
      try { sessionStorage.removeItem(ONB_STATE_KEY); } catch { /* noop */ }
      // Redeem referral code captured at first-touch.
      try {
        const code = typeof window !== "undefined" ? window.localStorage.getItem("rebuilt:ref_code") : null;
        if (code) {
          const { redeemReferralCode } = await import("@/lib/referrals.functions");
          await redeemReferralCode({ data: { code } });
          window.localStorage.removeItem("rebuilt:ref_code");
        }
      } catch (e) { console.warn("referral redeem failed", e); }
      if (!result.screenerPassed) {
        navigate({ to: "/screener-fail" as never });
      } else {
        navigate({ to: "/app" as never });
      }
    } catch (e) {
      const raw = (e as Error).message || "";
      const field = Object.keys(FIELD_TO_STEP).find((k) => raw.includes(k));
      if (field) {
        const step = FIELD_TO_STEP[field];
        const gi = STEP_GROUPS.findIndex((g) => g.includes(step));
        toast.error(`Please check your answer for ${STEP_LABEL[step]}.`, {
          action: gi >= 0 ? { label: "Fix it", onClick: () => setIdx(gi) } : undefined,
        });
      } else {
        toast.error("We couldn't save your answers. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  // Auto-advance: schedule goNext after a short pause; cancel on back/unmount.
  const autoAdvanceTimer = useRef<number | null>(null);
  const idxRef = useRef(idx);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  const clearAutoAdvance = () => {
    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  };

  function goBack() {
    clearAutoAdvance();
    navDirRef.current = -1;
    interactedAtIdxRef.current = -1;
    if (idx === 0) {
      navigate({ to: "/login" as never });
    } else {
      setIdx((i) => Math.max(0, i - 1));
    }
  }

  function goNext() {
    if (!canAdvance) {
      if (firstMissing) {
        setMissingHighlight(firstMissing);
        // Movement step: pick a specific sub-field key for the inline gold hint.
        if (firstMissing === "movement") {
          const env = (d as { training_environment?: string }).training_environment;
          const acts = ((d as { preferred_activities?: string[] }).preferred_activities) ?? [];
          if (!env) setMissingField("environment");
          else if (acts.length < 1) setMissingField("anchors");

        }
        const el = document.getElementById(`step-${firstMissing}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    navDirRef.current = 1;
    clearAutoAdvance();
    if (idx === TOTAL_GROUPS - 1) {
      void finish();
    } else {
      // Guard: a tap and an auto-advance landing together must move one screen, not two.
      const from = idx;
      setIdx((i) => (i === from ? Math.min(TOTAL_GROUPS - 1, i + 1) : i));
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ }
    }
  }

  const scheduleAdvance = (ms = 360) => {
    clearAutoAdvance();
    const scheduledForIdx = idx;
    autoAdvanceTimer.current = window.setTimeout(() => {
      autoAdvanceTimer.current = null;
      // Stale-timer guard: bail if the user navigated away from the step that
      // scheduled this advance, or hasn't actively interacted on the current
      // step. Prevents unwanted auto-advances after back/edit.
      if (scheduledForIdx !== idxRef.current) return;
      if (interactedAtIdxRef.current !== idxRef.current) return;
      goNext();
    }, ms);
  };
  useEffect(() => clearAutoAdvance, []);
  useEffect(() => { clearAutoAdvance(); }, [idx]);

  // Movement step: clear any persisted cardio defaults when the user arrives
  // without an environment picked yet, so neither cardio card looks pre-selected.
  useEffect(() => {
    if (!inGroup("movement")) return;
    const env = (d as { training_environment?: string }).training_environment;
    if (env) return;
    const cardio = (d as { cardio_preference?: string }).cardio_preference;
    const treadmill = (d as { treadmill_access?: string }).treadmill_access;
    if (cardio !== undefined) update("cardio_preference" as never, undefined as never);
    if (treadmill !== undefined) update("treadmill_access" as never, undefined as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Generic auto-advance: when a single-step group is fully valid and the user
  // has clearly interacted, advance after a short pause. Multi-step groups
  // (e.g. food) manage their own flow.
  const autoAdvanceReady = (step: StepId): number | null => {
    switch (step) {
      // Location: never auto-advance — the sticky Continue button drives it so
      // people can still add the optional address details.
      case "intro": return null;
      case "name": return (d.first_name?.trim() && (d as { gender?: string }).gender) ? 450 : null;
      case "track": return selectedTrack !== null && !trackSaving ? 350 : null;
      case "basics": return (d.age && d.height_cm && d.weight_kg) ? 900 : null;
      case "wake_time": return checkStep("wake_time") ? 600 : null;
      case "goals_specific": return d.success_metric?.type ? 400 : null;
      case "experience": return (d as { training_experience?: string }).training_experience ? 250 : null;
      case "movement": {
        const cardio = (d as { cardio_preference?: string }).cardio_preference;
        if (cardio === "none" && checkStep("movement")) return 600;
        const acts = ((d as { preferred_activities?: string[] }).preferred_activities) ?? [];
        return checkStep("movement") && acts.length >= 2 ? 600 : null;
      }
      case "lifestyle":
        // Only auto-advance OUT of the lifestyle group from the "mind" substep.
        // From "rest", a separate effect advances rest→mind once sleep+stress are set.
        if (lifestyleSubstep !== "mind") return null;
        return (d.sleep_hours !== undefined && d.stress_level !== undefined) ? 700 : null;

      default: return null;
    }
  };
  useEffect(() => {
    if (currentGroup.length !== 1) return;
    if (navDirRef.current === -1) return;
    const delay = autoAdvanceReady(currentGroup[0]);
    if (delay === null) return;
    if (!canAdvance) return;
    // Only auto-advance once the user has interacted on THIS step. Prevents
    // pre-filled drafts from instantly skipping past the screen on entry.
    if (interactedAtIdxRef.current !== idx) return;
    scheduleAdvance(delay);
    return clearAutoAdvance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, d, canAdvance, lifestyleSubstep, selectedTrack, trackSaving]);


  // Auto-skip any group whose every step is hidden by shouldSkip — avoids
  // landing on a blank screen with the wrong step counter (e.g. goals_specific
  // when the user picked only one goal).
  const groupHasVisible = (groupIdx: number): boolean => {
    const g = STEP_GROUPS[groupIdx];
    if (!g) return true;
    return g.some((s) => !shouldSkip(s));
  };
  useEffect(() => {
    if (groupHasVisible(idx)) return;
    const dir = navDirRef.current;
    if (dir === -1 && idx > 0) {
      interactedAtIdxRef.current = -1;
      setIdx((i) => Math.max(0, i - 1));
    } else if (idx < TOTAL_GROUPS - 1) {
      setIdx((i) => Math.min(TOTAL_GROUPS - 1, i + 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, d.goals.length]);

  // Honest counter: the total is the fixed number of screens in the flow and
  // the position is the true index of the screen on display. Neither ever
  // changes because of a selection.
  const visibleGroups = STEP_GROUPS.map((_, gi) => gi).filter((gi) => groupHasVisible(gi));
  const visibleTotal = visibleGroups.length;
  const visiblePosition = Math.min(visibleTotal, Math.max(1, visibleGroups.filter((gi) => gi <= idx).length));

  // iOS fix: when a text input has focus, the first tap on any other control
  // is consumed by the OS to dismiss the on-screen keyboard, so the button
  // only gets a click on the second tap (which also breaks auto-advance).
  // On touchstart we remember the would-be tap target; on touchend we blur
  // the input and synthesize a click on that target so the first tap counts.
  useEffect(() => {
    let pendingTarget: HTMLElement | null = null;
    let pendingActive: HTMLElement | null = null;

    const isTextField = (el: Element | null): el is HTMLElement => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const t = (el as HTMLInputElement).type;
        return t !== "checkbox" && t !== "radio" && t !== "range" && t !== "file" && t !== "submit" && t !== "button";
      }
      return (el as HTMLElement).isContentEditable === true;
    };

    const onTouchStart = (e: TouchEvent) => {
      pendingTarget = null;
      pendingActive = null;
      const active = document.activeElement as HTMLElement | null;
      if (!isTextField(active)) return;
      const target = e.target as HTMLElement | null;
      if (!target || target === active || active!.contains(target)) return;
      const tappable = target.closest<HTMLElement>(
        'button, [role="button"], a, label, [data-tap-blur]'
      );
      if (!tappable) return;
      pendingTarget = tappable;
      pendingActive = active;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = pendingTarget;
      const active = pendingActive;
      pendingTarget = null;
      pendingActive = null;
      if (!target || !active) return;
      const end = e.changedTouches[0];
      if (!end) return;
      const endEl = document.elementFromPoint(end.clientX, end.clientY) as HTMLElement | null;
      if (!endEl || (endEl !== target && !target.contains(endEl) && !endEl.contains(target))) return;
      e.preventDefault();
      active.blur();
      window.setTimeout(() => {
        try { target.click(); } catch { /* noop */ }
      }, 0);
    };

    document.addEventListener("touchstart", onTouchStart, true);
    document.addEventListener("touchend", onTouchEnd, true);
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchend", onTouchEnd, true);
    };
  }, []);

  const glyphName = GROUP_GLYPHS[idx] ?? "compass";

  return (
    <main className="relative h-[100svh] bg-background px-6 flex flex-col overflow-hidden">
      <StepBackdrop stepKey={idx} />
      {/* Subtle gold halo behind the wordmark for v2 consistency */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 z-[1]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, var(--rebuilt-gold-glow) 0%, transparent 70%)",
          opacity: 0.45,
        }}
      />
      <header className="relative pt-safe pt-6 grid grid-cols-3 items-center gap-3 z-10">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => {
              if (inGroup("nutrition") || inGroup("taste")) {
                if (foodSubstep === "taste") {
                  if (tasteIndex > 0) { tasteRef.current?.back(); return; }
                  setFoodSubstep("allergies"); return;
                }
                if (foodSubstep === "allergies") { setFoodSubstep("pattern"); return; }
              }
              if (inGroup("lifestyle") && lifestyleSubstep === "mind") {
                setLifestyleSubstep("rest"); return;
              }
              goBack();

            }}
            aria-label="Back"
            disabled={busy}
            className="h-11 w-11 -ml-2 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-card touch-manipulation select-none disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-center items-center gap-2">
          {!inGroup("baseline_photo") && <HeroGlyph name={glyphName} size={20} />}
          <Logo />
        </div>
        <p
          className="label-mono text-xs text-right tracking-[0.18em]"
          style={{ color: "var(--rebuilt-gold)" }}
        >
          Step {visiblePosition} of {visibleTotal}
        </p>
      </header>
      <div className="relative z-10 mt-4">
        <GoldMeridian current={visiblePosition} total={visibleTotal} />
      </div>



      {/* Fail-safe entrance: the step is at full opacity by default and the CSS
          animation only fades it in. If the animation never runs (reduced
          motion, stylesheet issue), the content is still fully visible. */}
      <section
        key={idx}
        ref={sectionRef}
        className="step-enter relative z-10 flex-1 overflow-y-auto flex flex-col justify-center max-w-md mx-auto w-full pt-2 sm:pt-4 pb-32 space-y-4"
      >

        {inGroup("intro") && (() => {
          const country = (d as { country_code?: string }).country_code ?? "";
          const currentLang = (i18n.resolvedLanguage ?? "en");
          const applyCountry = (code: string) => {
            if (!code) return;
            update("country_code" as never, code as never);
            setUnits(unitsForCountry(code));
            const top = languagesForCountry(code)[0];
            if (top && currentLang === "en" && top !== "en") i18n.changeLanguage(top);
          };
          return (
            <Step id="step-intro" highlight={missingHighlight === "intro"} title="Where do you operate?" sub="Just your country — that's all we need. You can add an address later.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl leading-none" aria-hidden>
                  {country ? flagFromCountry(country) : "🌐"}
                </span>
                <select
                  value={country}
                  onChange={(e) => applyCountry(e.target.value)}
                  className={`h-12 w-full appearance-none rounded-md border bg-input pl-11 pr-10 text-foreground focus:border-gold focus:outline-none ${country ? "border-gold/40" : "border-border"}`}
                  aria-label="Country"
                >
                  <option value="" disabled>Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>▾</span>
              </div>

              {country && (
                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  <span aria-hidden className="mr-1">{flagFromCountry(country)}</span>
                  {COUNTRIES.find((c) => c.code === country)?.name ?? country}
                  {" · "}
                  {unitsForCountry(country) === "metric" ? "kg · cm" : "lb · ft / in"}
                </p>
              )}

              <details id="intro-address-optional" className="mt-4 group">
                <summary className="label-mono text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none text-center">
                  Add your address (optional)
                </summary>
                <div className="mt-3">
                  <SetAnchorLocation
                    kind="home"
                    compact
                    onSaved={({ countryCode }) => {
                      if (countryCode) applyCountry(countryCode);
                      setHomeSavedAt(Date.now());
                    }}
                  />
                </div>
              </details>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    applyCountry(country || "US");
                    navDirRef.current = 1;
                    setIdx((i) => Math.min(TOTAL_GROUPS - 1, i + 1));
                    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ }
                  }}
                  className="label-mono text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground touch-manipulation"
                >
                  Skip for now
                </button>
              </div>
            </Step>
          );
        })()}



        {inGroup("name") && (
          <Step id="step-name" highlight={missingHighlight === "name"} title="What's your name?">
            <Input value={d.first_name ?? ""} onChange={(v) => update("first_name", v)} placeholder="First name" autoFocus autoComplete="given-name" />
            <p className="label-mono mt-6 mb-2 text-xs">So we address you right</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["male", "Man"],
                ["female", "Woman"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    update("gender" as never, val as never);
                    if (!d.first_name?.trim()) {
                      setMissingHighlight("name");
                      const el = document.querySelector<HTMLInputElement>('#step-name input[autocomplete="given-name"]');
                      el?.focus();
                    }
                    // Auto-advance is handled by the generic effect once both
                    // first_name and gender are set, regardless of tap order.
                  }}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    (d as never as { gender?: string }).gender === val ? "border-gold bg-card text-gold" : "border-border hover:bg-card"
                  }`}
                >{label}</button>
              ))}
            </div>
          </Step>
        )}



        {inGroup("track") && (
          <Step
            id="step-track"
            highlight={missingHighlight === "track"}
            title="Choose your path."
            sub="Same engine. Same standards. The voice and look adapt to you."
          >
            <div className="grid grid-cols-1 gap-3">
              {([
                {
                  v: "men" as Track,
                  title: "REBUILT",
                  tag: "Men's track",
                  desc: "Dark, direct, brotherly. Built to come back from the wreck.",
                },
                {
                  v: "angels" as Track,
                  title: "REBUILT Angels",
                  tag: "Women's track",
                  desc: "Same fire, softer edges. Sister-to-sister, never soft on the truth.",
                },
              ]).map((o) => {
                const active = selectedTrack === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={trackSaving}
                    onClick={async () => {
                      if (trackSaving) return;
                      setSelectedTrack(o.v);
                      setTrackSaving(true);
                      try {
                        await setCtxTrack(o.v);
                      } catch (e) {
                        // Non-fatal — keep local selection so they can continue;
                        // setting will be retried via Settings later.
                        console.warn("setTrack failed", e);
                        try {
                          await setTrackFn({ data: { track: o.v } });
                        } catch { /* noop */ }
                      } finally {
                        setTrackSaving(false);
                      }
                    }}
                    className={`text-left rounded-xl border p-5 transition-colors ${
                      active
                        ? "border-gold bg-card shadow-[0_0_0_1px_var(--rebuilt-gold)]/20"
                        : "border-border hover:border-gold/50 hover:bg-card"
                    }`}
                  >
                    <p className={`label-mono text-[10px] uppercase tracking-[0.18em] ${active ? "text-gold" : "text-muted-foreground"}`}>
                      {o.tag}
                    </p>
                    <p className={`font-display text-2xl mt-1 ${active ? "text-gold" : ""}`}>{o.title}</p>
                    <p className="text-sm text-muted-foreground mt-2">{o.desc}</p>
                  </button>
                );
              })}
            </div>
            <p className="label-mono text-[10px] text-muted-foreground mt-4">
              You can switch anytime in Settings.
            </p>
          </Step>
        )}







        {inGroup("basics") && d.age !== undefined && d.age < 18 && (
          <Step id="step-basics-underage" title="You need to be 18 to use REBUILT.">
            <p className="text-sm text-muted-foreground text-center">
              Thanks for your interest — our terms require members to be 18 or older.
              Come back and pick this up on your 18th birthday.
            </p>
            <button
              type="button"
              onClick={() => update("age", undefined)}
              className="mt-6 w-full h-12 rounded-2xl border border-border text-foreground touch-manipulation"
            >
              I entered the wrong age
            </button>
          </Step>
        )}

        {inGroup("basics") && !(d.age !== undefined && d.age < 18) && (
          <Step id="step-basics" highlight={missingHighlight === "basics"} title="Where your body is today.">
            <NumberRow label="Age" value={d.age} onChange={(v) => update("age", v)} suffix="years" min={18} max={100} />
            {units === "metric" ? (
              <>
                <NumberRow label="Height" value={d.height_cm} onChange={(v) => update("height_cm", v)} suffix="cm" min={100} max={250} />
                <NumberRow label="Weight" value={d.weight_kg} onChange={(v) => update("weight_kg", v)} suffix="kg" min={40} max={200} />
                <NumberRow label="Goal weight" value={d.goal_weight_kg ?? undefined} onChange={(v) => update("goal_weight_kg", v)} suffix="kg" min={40} max={200} placeholderHint="Leave blank if unsure" />
              </>
            ) : (
              <>
                <HeightFtIn cm={d.height_cm} onChange={(cm) => update("height_cm", cm)} />
                <NumberRow
                  label="Weight"
                  value={d.weight_kg ? Math.round(d.weight_kg * 2.20462) : undefined}
                  onChange={(v) => update("weight_kg", v === undefined ? undefined : +(v / 2.20462).toFixed(1))}
                  suffix="lb" min={88} max={440}
                />
                <NumberRow
                  label="Goal weight"
                  value={d.goal_weight_kg ? Math.round(d.goal_weight_kg * 2.20462) : undefined}
                  onChange={(v) => update("goal_weight_kg", v === undefined ? undefined : +(v / 2.20462).toFixed(1))}
                  suffix="lb" min={88} max={440} placeholderHint="Leave blank if unsure"
                />
              </>
            )}
          </Step>
        )}

        {inGroup("wake_time") && (
          <Step id="step-wake_time" highlight={missingHighlight === "wake_time"} title="When do you start the day?" sub="We'll meet you there. Every morning.">
            <TimeDial value={d.reminder_time_local} onChange={(v) => update("reminder_time_local", v)} />
            <p className="mt-4 text-xs text-muted-foreground text-center">P uses this to time your daily check-in and reminders.</p>
          </Step>
        )}

        {inGroup("baseline_photo") && (
          <Step id="step-baseline_photo" centered highlight={missingHighlight === "baseline_photo"} title="Day one." sub="One honest photo. Future you will thank present you.">
            <BaselinePhotoStep reminderTime={d.reminder_time_local ?? "06:00"} />
          </Step>
        )}


        {inGroup("goals_general") && (
          <Step id="step-goals_general" top highlight={missingHighlight === "goals_general"} title="What are you building?">
            <p className={`text-xs text-center mb-3 ${d.goals.length + d.physique_focus.length >= 2 ? "text-gold" : "text-muted-foreground"}`}>
              Pick 2–5 ({d.goals.length + d.physique_focus.length}/5)
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">

              {GOAL_OPTIONS.map((opt) => {
                const on = d.goals.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleIn("goals", opt)}
                    className={`h-10 px-4 rounded-full border text-sm transition-colors ${
                      on ? "border-gold bg-card text-gold"
                         : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{opt}</button>
                );
              })}
              {PHYSIQUE_FOCUS_OPTIONS.map((opt) => {
                const on = d.physique_focus.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => togglePhysique(opt)}
                    className={`h-10 px-4 rounded-full border text-sm transition-colors ${
                      on ? "border-gold bg-card text-gold"
                         : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{PHYSIQUE_LABELS[opt]}</button>
                );
              })}
            </div>
          </Step>
        )}

        {inGroup("goals_specific") && (
          <Step id="step-goals_specific" highlight={missingHighlight === "goals_specific"} title="How will you know it's working?">

            <div className="space-y-2.5">
              {METRIC_OPTIONS.map((opt) => {
                const on = d.success_metric?.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (on) { update("success_metric", null); return; }
                      update("success_metric", { type: opt.value, target_value: null, target_unit: null, body_part: null, lift_name: null, note: null });
                      // Auto-advance handled by generic effect once metric is set.
                    }}
                    className={`relative w-full text-left rounded-lg border-l-4 border border-l-transparent p-4 min-h-16 transition-colors ${on ? "border-gold border-l-gold bg-gold/10" : "border-border hover:bg-card"}`}
                  >
                    {opt.recommended && (
                      <span className="absolute top-2 right-2 label-mono text-[10px] text-gold border border-gold/40 bg-gold/10 px-2 py-0.5 rounded-full tracking-wider">
                        MOST RECOMMENDED
                      </span>
                    )}
                    <p className={`text-sm font-medium ${opt.recommended ? "pr-32" : ""}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{opt.sub}</p>
                  </button>
                );
              })}
            </div>

            {d.success_metric?.type === "target_weight" && (
              <div className="mt-4 space-y-2">
                <p className="label-mono text-sm">Target weight</p>
                <div className="relative">
                  <Input
                    value={d.success_metric.target_value?.toString() ?? ""}
                    onChange={(v) => update("success_metric", { ...d.success_metric!, target_value: v === "" ? null : Number(v), target_unit: units === "metric" ? "kg" : "lb" })}
                    placeholder={units === "metric" ? "e.g. 82" : "e.g. 180"}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 label-mono text-muted-foreground text-xs">{units === "metric" ? "KG" : "LB"}</span>
                </div>
              </div>
            )}
            {d.success_metric?.type === "measurement" && (
              <div className="mt-4 space-y-2">
                <p className="label-mono text-sm">What and where</p>
                <Input
                  value={d.success_metric.body_part ?? ""}
                  onChange={(v) => update("success_metric", { ...d.success_metric!, body_part: v })}
                  placeholder="Waist, arm, hips…"
                />
                <div className="relative">
                  <Input
                    value={d.success_metric.target_value?.toString() ?? ""}
                    onChange={(v) => update("success_metric", { ...d.success_metric!, target_value: v === "" ? null : Number(v), target_unit: units === "metric" ? "cm" : "in" })}
                    placeholder={units === "metric" ? "Target cm" : "Target in"}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 label-mono text-muted-foreground text-xs">{units === "metric" ? "CM" : "IN"}</span>
                </div>
              </div>
            )}
            {d.success_metric?.type === "lift_pr" && (
              <div className="mt-4 space-y-2">
                <p className="label-mono text-sm">Which lift, what target</p>
                <Input
                  value={d.success_metric.lift_name ?? ""}
                  onChange={(v) => update("success_metric", { ...d.success_metric!, lift_name: v })}
                  placeholder="Bench, squat, deadlift…"
                />
                <div className="relative">
                  <Input
                    value={d.success_metric.target_value?.toString() ?? ""}
                    onChange={(v) => update("success_metric", { ...d.success_metric!, target_value: v === "" ? null : Number(v), target_unit: units === "metric" ? "kg" : "lb" })}
                    placeholder={units === "metric" ? "Target kg" : "Target lb"}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 label-mono text-muted-foreground text-xs">{units === "metric" ? "KG" : "LB"}</span>
                </div>
              </div>
            )}
          </Step>
        )}

        {(inGroup("experience") || inGroup("training")) && (
          <div className="flex flex-col gap-10 w-full max-w-md mx-auto pt-2 pb-8">
            {/* Experience section */}
            <section
              id="step-experience"
              className={`scroll-mt-24 rounded-lg ${missingHighlight === "experience" ? "ring-2 ring-gold/40" : ""}`}
            >
              <div className="text-center">
                <h1 className="font-display text-[1.75rem] sm:text-3xl leading-tight max-w-sm mx-auto">
                  Be honest.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Where are you with lifting right now?
                </p>
              </div>
              {(() => {
                const current = (d as { training_experience?: string }).training_experience;
                const activeIdx = Math.max(0, EXPERIENCE_OPTIONS.findIndex((o) => o.value === current));
                const hasPick = !!current;
                const pct = EXPERIENCE_OPTIONS.length > 1
                  ? (activeIdx / (EXPERIENCE_OPTIONS.length - 1)) * 100
                  : 0;
                return (
                  <div className="pt-6 pb-2">
                    <div className="relative h-12">
                      {/* track */}
                      <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-border" />
                      {/* dot */}
                      {hasPick && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-gold shadow-[0_0_16px_3px_color-mix(in_oklab,var(--gold)_55%,transparent)] transition-[left] duration-500 ease-out pointer-events-none"
                          style={{ left: `calc(8px + (100% - 16px) * ${pct / 100})` }}
                        />
                      )}
                      {/* ticks */}
                      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between">
                        {EXPERIENCE_OPTIONS.map((opt, i) => {
                          const on = i === activeIdx && hasPick;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              aria-label={opt.label}
                              onClick={() => { update("training_experience" as never, opt.value as never); scheduleAdvance(250); }}
                              className="relative h-10 w-10 -mx-5 flex items-center justify-center touch-manipulation"
                            >
                              <span className={`block h-2 w-2 rounded-full transition-colors ${on ? "bg-gold" : "bg-muted-foreground/40"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between text-[11px]">
                      {EXPERIENCE_OPTIONS.map((opt, i) => {
                        const on = i === activeIdx && hasPick;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { update("training_experience" as never, opt.value as never); scheduleAdvance(250); }}
                            className={`flex-1 text-center px-1 transition-colors ${on ? "text-gold font-medium" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Training section */}
            <section
              id="step-training"
              className={`scroll-mt-24 rounded-lg ${missingHighlight === "training" ? "ring-2 ring-gold/40" : ""}`}
            >
              <div className="text-center">
                <h2 className="font-display text-[1.75rem] sm:text-3xl leading-tight max-w-sm mx-auto">
                  Your training week.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  The rhythm we'll hold you to.
                </p>
              </div>
              <div className="mt-6 space-y-3 w-full text-left">
                {/* Schedule: Days per week + training week grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <SliderRow label="Days per week" value={d.training_days_per_week} onChange={(v) => update("training_days_per_week", v)} suffix="DAYS" min={1} max={7} minLabel="1" maxLabel="7" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="label-mono">Your training week</p>
                      {daysManuallyEdited && d.training_days_per_week && SUGGESTED_SPLIT[d.training_days_per_week] && (
                        <button
                          type="button"
                          onClick={() => {
                            setDaysManuallyEdited(false);
                            update("preferred_training_days", SUGGESTED_SPLIT[d.training_days_per_week!]);
                          }}
                          className="label-mono text-[10px] text-gold underline-offset-2 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((day) => {
                        const selected = d.preferred_training_days.includes(day);
                        const suggested = d.training_days_per_week
                          ? (SUGGESTED_SPLIT[d.training_days_per_week] ?? []).includes(day)
                          : false;
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-label={day}
                            onClick={() => {
                              setDaysManuallyEdited(true);
                              toggleIn("preferred_training_days", day);
                            }}
                            className={`relative aspect-square min-w-0 rounded-md border flex items-center justify-center font-mono text-sm tracking-wider transition-colors ${
                              selected
                                ? "border-gold bg-card text-gold"
                                : "border-border text-muted-foreground hover:bg-card"
                            }`}
                          >
                            {day.charAt(0)}
                            {!selected && suggested && (
                              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-gold/70" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {daysManuallyEdited
                        ? "Your pick. Gold dots show the spacing we'd recommend."
                        : "We've spaced your sessions for recovery. Tap any day to adjust."}
                    </p>
                    {d.training_days_per_week && d.preferred_training_days.length !== d.training_days_per_week && (
                      <p className="text-[11px] text-gold/80 mt-1">
                        You picked {d.training_days_per_week} days but selected {d.preferred_training_days.length}.
                      </p>
                    )}
                  </div>
                </div>

                {/* Session: one slider for length + style */}
                {(() => {
                  const STOPS = [
                    { v: 20, label: "20 MIN", sub: "Quick hit", style: "short_intense" },
                    { v: 30, label: "30 MIN", sub: "Short & sharp", style: "short_intense" },
                    { v: 45, label: "45 MIN", sub: "Standard", style: "short_intense" },
                    { v: 60, label: "1 HR", sub: "Full session", style: "long_steady" },
                    { v: 75, label: "1 HR 15", sub: "Extended", style: "long_steady" },
                    { v: 90, label: "1 HR 30", sub: "Long & steady", style: "long_steady" },
                  ] as const;
                  const current = d.session_minutes ?? 45;
                  const activeIdx = Math.max(0, STOPS.findIndex((s) => s.v === current));
                  const stop = STOPS[activeIdx === -1 ? 2 : activeIdx];
                  return (
                    <div className="mt-8">
                      <div className="flex items-baseline justify-between">
                        <p className="label-mono">Session</p>
                        <p className="label-mono text-gold">{stop.label} · {stop.sub.toUpperCase()}</p>
                      </div>
                      <div className="mt-4">
                        <input
                          type="range"
                          min={0}
                          max={STOPS.length - 1}
                          step={1}
                          value={activeIdx}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            const s = STOPS[idx];
                            update("session_minutes", s.v);
                            update("workout_style_preference" as never, s.style as never);
                          }}
                          className="w-full accent-gold"
                          aria-label="Session length and intensity"
                        />
                        <div className="mt-2 flex justify-between px-[2px]">
                          {STOPS.map((s, i) => (
                            <span
                              key={s.v}
                              className={`h-1.5 w-1.5 rounded-full ${i === activeIdx ? "bg-gold" : "bg-border"}`}
                              aria-hidden
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="label-mono text-[10px] text-muted-foreground">SHORT &amp; INTENSE</span>
                          <span className="label-mono text-[10px] text-muted-foreground">LONG &amp; STEADY</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          </div>
        )}




        <>
        {(inGroup("nutrition") || inGroup("taste")) && foodSubstep === "pattern" && (
          <motion.div
            key="food-pattern"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
          <Step id="step-nutrition" highlight={missingHighlight === "nutrition"} title="What's your diet?" sub="One tap. We'll handle the rest.">
            <p data-scroll-anchor className="label-mono mb-2">Eating pattern</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIET_OPTIONS.map((opt) => {
                const selected = d.dietary_pattern === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (d.dietary_pattern !== opt.value) setDiet(opt.value);
                      const reduce = typeof window !== "undefined"
                        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                      window.setTimeout(() => setFoodSubstep("allergies"), reduce ? 0 : 220);
                    }}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors min-h-16 ${
                      selected ? "border-gold bg-gold/10" : "border-border hover:bg-card"
                    }`}
                  >
                    <span className="text-2xl leading-none">{opt.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="block text-xs opacity-60">{opt.sub}</span>
                    </span>
                    {selected && <Check className="w-4 h-4 text-gold shrink-0" />}
                  </button>
                );
              })}
            </div>
          </Step>
          </motion.div>
        )}

        {(inGroup("nutrition") || inGroup("taste")) && foodSubstep === "allergies" && (() => {
          const POP_A = ["Peanuts", "Tree nuts", "Dairy", "Gluten", "Shellfish"];
          const rest = COMMON_ALLERGIES.filter((a) => !POP_A.includes(a));
          const noneOn = d.allergies.includes("None");
          const selected = d.allergies.filter((a) => a !== "None");
          const custom = selected.filter((a) => !COMMON_ALLERGIES.includes(a));
          return (
            <motion.div
              key="food-allergies"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
            <Step id="step-allergies" title="Any food allergies?" sub="We'll keep these out of every meal.">
              <div data-scroll-anchor className={noneOn ? "opacity-40 pointer-events-none" : ""}>
                <PopularChipPicker
                  popular={POP_A}
                  rest={rest}
                  selected={selected}
                  onToggle={(v) => {
                    const on2 = selected.includes(v);
                    const next = on2 ? selected.filter((x) => x !== v) : [...selected, v];
                    setAllergies(next);
                  }}
                  customValues={custom}
                  onCustomChange={(v) => {
                    const presets = selected.filter((a) => COMMON_ALLERGIES.includes(a));
                    setAllergies([...presets, ...v]);
                  }}
                  customPlaceholder="lactose, MSG, nightshades…"
                />
              </div>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAllergies(noneOn ? [] : ["None"]);
                    if (!noneOn) {
                      const reduce = typeof window !== "undefined"
                        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                      window.setTimeout(() => setFoodSubstep("taste"), reduce ? 0 : 220);
                    }
                  }}
                  className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                    noneOn ? "border-gold bg-gold/10 text-gold" : "border-border/70 text-muted-foreground/70 hover:border-border hover:text-muted-foreground"
                  }`}
                >None of these</button>
              </div>

            </Step>
            </motion.div>
          );
        })()}



        {(inGroup("nutrition") || inGroup("taste")) && foodSubstep === "taste" && (() => {
          const hiddenSets = computeHidden(d.dietary_pattern as string | undefined, d.allergies);
          const hiddenFor: Record<string, Set<string>> = {
            proteins: hiddenSets.proteins, carbs: hiddenSets.carbs, fats: hiddenSets.fats, sweet_subs: hiddenSets.sweet_subs,
          };
          const visibleRestaurants = (RESTAURANT_OPTIONS as unknown as string[]).filter((r) => !hiddenSets.restaurants.has(r));
          
          return (
          <motion.div
            key="food-taste"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
          <Step id="step-taste" highlight={missingHighlight === "taste"}>
            <TasteCardPager
              ref={tasteRef}
              onIndexChange={(i, isLast) => { setTasteIndex(i); setTasteIsLast(isLast); }}
              onDone={() => { goNext(); }}
              cards={(() => {
                const POPULAR_BY_CAT: Record<string, string[]> = {
                  cuisines: ["Mexican", "Italian", "Mediterranean", "Japanese", "Chinese"],
                  proteins: ["Chicken", "Eggs", "Greek yogurt", "Salmon", "Beef", "Tofu", "Whey shake", "Plant shake"],
                  carbs: ["White rice", "Oats", "Sweet potato", "Pasta", "Fruit", "Sourdough"],
                  veggies: ["Spinach", "Broccoli", "Peppers", "Carrots", "Salad mix", "Onions"],
                  fats: ["Avocado", "Olive oil", "Nuts", "Nut butter", "Cheese"],
                  sweet_subs: ["Dark chocolate", "Greek yogurt bowls", "Fruit + nut butter"],
                  flavors: ["Spicy", "Garlicky", "Herby", "Lemony", "Mild"],
                };
                // Cuisine-driven bias: picked cuisines surface their staple proteins/carbs/flavors first.
                const CUISINE_BIAS: Record<string, Partial<Record<"proteins"|"carbs"|"flavors", string[]>>> = {
                  Mexican:       { proteins: ["Chicken", "Beef"],   carbs: ["White rice", "Tortillas"], flavors: ["Spicy", "Garlicky"] },
                  Italian:       { proteins: ["Chicken", "Beef"],   carbs: ["Pasta", "Sourdough"],      flavors: ["Garlicky", "Herby"] },
                  Mediterranean: { proteins: ["Chicken", "Salmon"], carbs: ["Sourdough", "Oats"],       flavors: ["Lemony", "Herby"] },
                  Japanese:      { proteins: ["Salmon", "Tofu"],    carbs: ["White rice"],              flavors: ["Umami", "Mild"] },
                  Chinese:       { proteins: ["Chicken", "Tofu"],   carbs: ["White rice"],              flavors: ["Garlicky", "Spicy"] },
                  Indian:        { proteins: ["Chicken", "Tofu"],   carbs: ["White rice"],              flavors: ["Spicy", "Garlicky"] },
                  Thai:          { proteins: ["Chicken", "Tofu"],   carbs: ["White rice"],              flavors: ["Spicy", "Lemony"] },
                  Greek:         { proteins: ["Chicken", "Greek yogurt"], carbs: ["Sourdough"],         flavors: ["Lemony", "Herby"] },
                  "Middle Eastern": { proteins: ["Chicken", "Beans / lentils"], carbs: ["Sourdough"],   flavors: ["Garlicky", "Herby"] },
                  "BBQ / American": { proteins: ["Chicken", "Beef"], carbs: ["Sweet potato", "Sourdough"], flavors: ["Smoky", "Sweet-savory"] },
                };
                const popularFor = (cat: "cuisines"|"proteins"|"carbs"|"veggies"|"fats"|"sweet_subs"|"flavors") => {
                  const base = POPULAR_BY_CAT[cat] ?? [];
                  if (cat === "cuisines") return base;
                  const picked = (d.taste_profile?.cuisines as string[] | undefined) ?? [];
                  if (!picked.length) return base;
                  const biased: string[] = [];
                  for (const c of picked) {
                    const bias = CUISINE_BIAS[c]?.[cat as "proteins"|"carbs"|"flavors"];
                    if (bias) for (const x of bias) if (!biased.includes(x)) biased.push(x);
                  }
                  const merged = [...biased];
                  for (const x of base) if (!merged.includes(x)) merged.push(x);
                  return merged.slice(0, Math.max(base.length, 6));
                };
                const chipCat = (cat: "cuisines"|"proteins"|"carbs"|"veggies"|"fats"|"sweet_subs"|"flavors") => {
                  const selected = (d.taste_profile?.[cat] as string[]) ?? [];
                  const allPresets = TASTE_OPTIONS[cat] as unknown as string[];
                  const hide = hiddenFor[cat];
                  const presets = hide ? allPresets.filter((x) => !hide.has(x)) : allPresets;
                  const popPool = popularFor(cat);
                  const popular = popPool.filter((x) => presets.includes(x));
                  const rest = presets.filter((x) => !popular.includes(x));
                  const custom = selected.filter((x) => !allPresets.includes(x));

                  const placeholders: Record<string, string> = {
                    cuisines: "Persian, Cuban, Lebanese…",
                    proteins: "bison, venison, sardines…",
                    carbs: "farro, plantains, jasmine rice…",
                    veggies: "okra, bok choy, artichoke…",
                    fats: "tahini, ghee, macadamia…",
                    sweet_subs: "halva, dates, frozen grapes…",
                    flavors: "umami, tangy, curry…",
                  };
                  return (
                    <PopularChipPicker
                      popular={popular}
                      rest={rest}
                      selected={selected}
                      onToggle={(v) => update("taste_profile", {
                        ...d.taste_profile,
                        [cat]: selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
                      })}
                      customValues={custom}
                      onCustomChange={(v) => update("taste_profile", {
                        ...d.taste_profile,
                        [cat]: [...selected.filter((x) => presets.includes(x)), ...v],
                      })}
                      customPlaceholder={placeholders[cat]}
                    />
                  );
                };

                const setCat = (cat: "cuisines"|"proteins"|"carbs"|"veggies"|"fats"|"sweet_subs"|"flavors", values: string[]) =>
                  update("taste_profile", { ...d.taste_profile, [cat]: values });
                const countCat = (cat: "cuisines"|"proteins"|"carbs"|"veggies"|"fats"|"sweet_subs"|"flavors") =>
                  ((d.taste_profile?.[cat] as string[] | undefined)?.length ?? 0);
                const popularOf = (cat: keyof typeof POPULAR_BY_CAT) => {
                  const all = TASTE_OPTIONS[cat as "cuisines"] as unknown as string[];
                  const hide = hiddenFor[cat as "cuisines"];
                  const presets = hide ? all.filter((x) => !hide.has(x)) : all;
                  return (POPULAR_BY_CAT[cat] ?? []).filter((x) => presets.includes(x));
                };

                return [
                  {
                    id: "cuisines",
                    title: "What you actually eat",
                    content: chipCat("cuisines"),
                    selectedCount: countCat("cuisines"),
                    autoAdvanceAt: 3,
                  },
                  {
                    id: "proteins-carbs",
                    title: "Proteins & carbs",
                    content: (
                      <div className="space-y-5">
                        <div>
                          <p className="label-mono mb-2 text-center">Proteins</p>
                          {chipCat("proteins")}
                        </div>
                        <div>
                          <p className="label-mono mb-2 text-center">Carbs</p>
                          {chipCat("carbs")}
                        </div>
                      </div>
                    ),
                    selectedCount: countCat("proteins") + countCat("carbs"),
                  },

                  {
                    id: "constraints",
                    title: "Any foods you can't stand?",
                    content: (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              update("taste_profile", { ...d.taste_profile, hard_nos: [] });
                              setSkipChoice("none");
                            }}
                            className={`rounded-full px-4 py-3 text-sm border transition-colors ${
                              skipChoice === "none"
                                ? "bg-gold text-gold-foreground border-gold"
                                : "border-border text-foreground hover:border-gold/60"
                            }`}
                          >
                            No, I'm good
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkipChoice("some")}
                            className={`rounded-full px-4 py-3 text-sm border transition-colors ${
                              skipChoice === "some"
                                ? "bg-gold text-gold-foreground border-gold"
                                : "border-border text-foreground hover:border-gold/60"
                            }`}
                          >
                            Yes, a few
                          </button>
                        </div>
                        {skipChoice === "some" && (
                          <ChipInput
                            values={d.taste_profile?.hard_nos ?? []}
                            onChange={(v) => update("taste_profile", { ...d.taste_profile, hard_nos: v })}
                            placeholder="cilantro, mushrooms, seed oils…"
                          />
                        )}
                      </div>
                    ),
                    selectedCount:
                      skipChoice === "none"
                        ? 1
                        : skipChoice === "some"
                          ? (d.taste_profile?.hard_nos?.length ?? 0)
                          : 0,
                    autoAdvanceAt: 1,
                  },




                  {
                    id: "where",
                    title: "Your go-to spots",
                    sub: "We'll build your meals around the restaurants and stores you actually use.",

                    content: (
                      <div className="space-y-5">
                        <div>
                          <p className="label-mono mb-2 text-center">Restaurants</p>
                          {(() => {
                            const POP_R = ["Chipotle", "Cava", "Sweetgreen", "Chick-fil-A", "Subway"];
                            const popular = POP_R.filter((r) => visibleRestaurants.includes(r));
                            const rest = visibleRestaurants.filter((r) => !popular.includes(r));
                            const custom = d.restaurants.filter((r) => !RESTAURANT_OPTIONS.includes(r as never));
                            return (
                              <PopularChipPicker
                                popular={popular}
                                rest={rest}
                                selected={d.restaurants}
                                onToggle={(v) => update("restaurants", d.restaurants.includes(v) ? d.restaurants.filter((x) => x !== v) : [...d.restaurants, v])}
                                customValues={custom}
                                onCustomChange={(c) => update("restaurants", [...RESTAURANT_OPTIONS.filter((r) => d.restaurants.includes(r)), ...c])}
                                customPlaceholder="Add your local spot…"
                              />
                            );
                          })()}
                        </div>

                        <div>
                          <p className="label-mono mb-2 text-center">Groceries</p>
                          {(() => {
                            const all = GROCERY_OPTIONS as unknown as string[];
                            const POP_G = ["Trader Joe's", "Whole Foods", "Costco", "Walmart", "Kroger"];
                            const popular = POP_G.filter((g) => all.includes(g));
                            const rest = all.filter((g) => !popular.includes(g));
                            return (
                              <PopularChipPicker
                                popular={popular}
                                rest={rest}
                                selected={d.grocery_stores}
                                onToggle={(v) => update("grocery_stores", d.grocery_stores.includes(v) ? d.grocery_stores.filter((x) => x !== v) : [...d.grocery_stores, v])}
                              />
                            );
                          })()}
                        </div>
                      </div>

                    ),
                  },

                ];
              })()}
            />
          </Step>
          </motion.div>
          );
        })()}
        </>


        {inGroup("movement") && (
          <Step id="step-movement" highlight={missingHighlight === "movement"} title="How you move." sub="Where you train, what you actually do.">
            {(() => {
              const env = (d as { training_environment?: "outdoor" | "indoor" | "both" }).training_environment;
              const POP_OUTDOOR = ["Walking", "Hike", "Run", "Cycle"];
              const POP_INDOOR = ["Yoga", "Pilates", "Treadmill", "Rowing"];
              const POP_BOTH = ["Walking", "Hike", "Yoga", "Run", "Cycle", "Treadmill"];
              const POP = env === "outdoor" ? POP_OUTDOOR : env === "indoor" ? POP_INDOOR : POP_BOTH;
              const allPresets = ACTIVITY_OPTIONS as unknown as string[];
              const OUTDOOR_SET = new Set(["Surf","Hike","Run","Cycle","Swim","Climb","Basketball","Soccer","Tennis","Pickleball","Skate","Ski / Snowboard","Walking","Dog walking","Golf","Volleyball"]);
              const INDOOR_SET = new Set(["Yoga","Pilates","Boxing","Martial arts","Dance","Treadmill","Stationary bike","Rowing"]);
              const allowedFor = (e: "outdoor" | "indoor" | "both") =>
                e === "outdoor" ? OUTDOOR_SET : e === "indoor" ? INDOOR_SET : new Set([...OUTDOOR_SET, ...INDOOR_SET]);
              const list = ((d as { preferred_activities?: string[] }).preferred_activities) ?? [];
              const liftingOnly = (d as { cardio_preference?: string }).cardio_preference === "none";
              const custom = list.filter((x) => !allPresets.includes(x));
              const MAX_ANCHORS = 3;
              const applyList = (next: string[]) => {
                if (next.length > MAX_ANCHORS) return;
                update("preferred_activities" as never, next as never);
                const dogOn = next.includes("Dog walking");
                update("has_dog" as never, dogOn as never);
                if (dogOn && !(d as { dog_count?: number }).dog_count) {
                  update("dog_count" as never, 1 as never);
                }
                if (!dogOn) update("dog_count" as never, 0 as never);
              };
              const setEnv = (v: "outdoor" | "indoor" | "both") => {
                update("training_environment" as never, v as never);
                const allowed = allowedFor(v);
                const pruned = list.filter((x) => !allPresets.includes(x) || allowed.has(x));
                if (pruned.length !== list.length) applyList(pruned);
              };

              return (
                <>
                  <div data-scroll-anchor className="relative">
                    {missingField === "environment" && (
                      <span className="absolute right-0 -top-1 text-[10px] text-gold/80 animate-pulse">Pick one to continue</span>
                    )}
                    <LineSelect
                      label="Where will it actually happen?"
                      value={env}
                      onChange={(v) => { setEnv(v); requestAnimationFrame(() => scrollNextAnchor()); }}
                      options={[
                        { v: "outdoor", label: "Outdoor", sub: "Trails, park" },
                        { v: "indoor", label: "Indoor", sub: "Gym, home" },
                        { v: "both", label: "Both", sub: "Mix of both" },
                      ]}
                    />
                  </div>

                  {env && (
                    <div className={liftingOnly ? "opacity-40 pointer-events-none" : ""}>
                      <div data-scroll-anchor className="mt-6 mb-2 flex items-baseline justify-between gap-2">
                        <p className="label-mono">What you'll actually do</p>
                        <div className="flex items-baseline gap-2">
                          {missingField === "anchors" && !liftingOnly && (
                            <span className="text-[10px] text-gold/80 animate-pulse">Pick at least one</span>
                          )}
                          <p className={`label-mono text-[10px] ${list.length > 0 ? "text-gold" : "text-muted-foreground"}`}>
                            {list.length}/{MAX_ANCHORS}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Pick 1–3. Things you'll actually repeat.</p>
                      <PopularChipPicker
                        popular={POP}
                        rest={[]}
                        selected={list}
                        onToggle={(v) => {
                          const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
                          if (next.length > MAX_ANCHORS) return;
                          applyList(next);
                          scrollNextAnchor();
                        }}
                        customValues={custom}
                        onCustomChange={(v) => {
                          const next = [...list.filter((x) => allPresets.includes(x)), ...v];
                          applyList(next);
                        }}
                        customPlaceholder="jiu jitsu, paddleboard…"
                      />
                      {list.length === 1 && (
                        <p className="mt-3 text-xs text-gold/80 italic">
                          That's the anchor. Two more if you want, or roll with this one.
                        </p>
                      )}
                    </div>
                  )}


                  {(env === "indoor" || env === "both") && (
                    <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">Lifting only</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Skip cardio — strength sessions only</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={liftingOnly}
                        onClick={(e) => {
                          update("cardio_preference" as never, (liftingOnly ? "mix" : "none") as never);
                          if (liftingOnly) scrollNextAnchor(e.currentTarget);
                        }}
                        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                          liftingOnly ? "bg-gold border-gold" : "bg-card border-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                            liftingOnly ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                </>
              );
            })()}
          </Step>
        )}

        {inGroup("lifestyle") && lifestyleSubstep === "rest" && (
          <motion.div
            key="lifestyle-rest"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
          <Step id="step-lifestyle" highlight={missingHighlight === "lifestyle"} title="How you actually rest." sub="Sleep, stress, the rest. No judgment." top>
            <div className="mt-2 space-y-0">
              <SliderRow label="Sleep" value={d.sleep_hours} onChange={(v) => update("sleep_hours", v)} suffix="HRS / NIGHT" min={4} max={10} step={0.5} minLabel="4" maxLabel="10+" />
              <SliderRow label="Stress" value={d.stress_level} onChange={(v) => update("stress_level", v)} suffix="/ 10" min={1} max={10} minLabel="Calm" maxLabel="High" />
            </div>
            <div className="mt-3 space-y-2">
              <BucketRow label="Caffeine" value={d.caffeine_per_day ?? 0} onChange={(v) => update("caffeine_per_day", v)} buckets={[
                { label: "None", sub: "0 cups", value: 0, match: (v) => v === 0 },
                { label: "Light", sub: "~1 cup", value: 1, match: (v) => v >= 1 && v <= 1 },
                { label: "Moderate", sub: "2–3 cups", value: 3, match: (v) => v >= 2 && v <= 3 },
                { label: "Heavy", sub: "4+ cups", value: 5, match: (v) => v >= 4 },
              ]} />
              <BucketRow label="Alcohol" value={d.alcohol_per_week ?? 0} onChange={(v) => update("alcohol_per_week", v)} buckets={[
                { label: "None", sub: "0 drinks/wk", value: 0, match: (v) => v === 0 },
                { label: "Light", sub: "1–3 / wk", value: 2, match: (v) => v >= 1 && v <= 3 },
                { label: "Moderate", sub: "4–7 / wk", value: 5, match: (v) => v >= 4 && v <= 7 },
                { label: "Heavy", sub: "8+ / wk", value: 10, match: (v) => v >= 8 },
              ]} />
            </div>
          </Step>
          </motion.div>
        )}

        {inGroup("lifestyle") && lifestyleSubstep === "mind" && (
          <motion.div
            key="lifestyle-mind"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
          <Step id="step-lifestyle-mind" highlight={missingHighlight === "lifestyle"} title="Where's your head at." sub="Mood and what's pulling on you." top>
            <div className="mt-2 space-y-0">
              <SliderRow label="Mood today" value={d.mood_today ?? 5} onChange={(v) => update("mood_today" as never, v as never)} suffix="/ 10" min={1} max={10} minLabel="Low" maxLabel="Locked in" />
            </div>
            <div className="mt-5">
              <p className="label-mono mb-2 text-sm">What's draining you most right now? <span className="text-muted-foreground font-normal normal-case">— pick one</span></p>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "work", label: "Work" },
                  { v: "relationships", label: "Relationships" },
                  { v: "money", label: "Money" },
                  { v: "health", label: "Health" },
                ].map((o) => {
                  const on = (d as { top_drain?: string }).top_drain === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => update("top_drain" as never, (on ? null : o.v) as never)}
                      className={`h-11 px-4 rounded-full border text-sm transition-all active:scale-95 ${
                        on ? "border-gold bg-gold text-gold-foreground font-medium" : "border-border/70 bg-transparent text-foreground/70 hover:text-foreground hover:border-border"
                      }`}
                    >{o.label}</button>
                  );
                })}
              </div>
            </div>
          </Step>
          </motion.div>
        )}



        {inGroup("screener") && (
          <Step id="step-screener" highlight={missingHighlight === "screener" || missingHighlight === "health"} title="Anything we should know?" sub="Flag it now. Saves you later.">
            <p className="label-mono mb-2 text-sm">Safety flags <span className="text-muted-foreground font-normal normal-case">— tap any that apply</span></p>
            <button
              type="button"
              onClick={() => setScreenerOpen((v) => !v)}
              className={`w-full text-left rounded-lg border p-3 flex items-center justify-between gap-3 ${
                d.screener_conditions.length > 0 ? "border-oxblood bg-card" : "border-border"
              }`}
            >
              <span className="text-sm">
                {d.screener_conditions.length === 0
                  ? "No flags selected"
                  : `${d.screener_conditions.length} flag${d.screener_conditions.length === 1 ? "" : "s"} selected · tap to edit`}
              </span>
              <span className={`text-xs transition-transform ${screenerOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {d.screener_conditions.length > 0 && !screenerOpen && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.screener_conditions.map((flag) => (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleIn("screener_conditions", flag)}
                    className="inline-flex items-center gap-1 rounded-full border border-oxblood bg-oxblood/10 px-2.5 py-1 text-[11px] text-foreground"
                  >
                    {SCREENER_LABELS[flag]}
                    <span className="opacity-70">×</span>
                  </button>
                ))}
              </div>
            )}

            {screenerOpen && (
              <div className="mt-2 rounded-lg border border-border bg-card p-2 space-y-1.5">
                {SCREENER_FLAGS.map((flag) => {
                  const checked = d.screener_conditions.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleIn("screener_conditions", flag)}
                      className={`w-full text-left rounded-md border px-3 py-2 flex items-start gap-2.5 ${
                        checked ? "border-oxblood bg-oxblood/5" : "border-border"
                      }`}
                    >
                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                        checked ? "bg-oxblood border-oxblood" : "border-muted-foreground"
                      }`}>
                        {checked && <span className="text-white text-[10px]">✓</span>}
                      </span>
                      <span className="text-xs leading-snug">{SCREENER_LABELS[flag]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="label-mono mt-5 mb-2 text-sm">Injuries, pain, or medications <span className="text-muted-foreground font-normal normal-case">— skip if none</span></p>
            <TextArea
              value={d.injuries ?? ""}
              onChange={(v) => { update("injuries", v); if (d.medications) update("medications", ""); }}
              placeholder="e.g. left knee tendinitis, lower back stiffness, currently on metformin"
            />

            <p className="label-mono mt-5 mb-2 text-sm">Peptides & performance Rx <span className="text-muted-foreground font-normal normal-case">— optional</span></p>
            <div className="flex flex-wrap gap-2">
              {[
                { v: "on", label: "On peptides" },
                { v: "considering", label: "Considering" },
                { v: "no", label: "Not for me" },
              ].map((o) => {
                const on = (d as { peptide_status?: string }).peptide_status === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => update("peptide_status" as never, (on ? null : o.v) as never)}
                    className={`h-11 px-4 rounded-full border text-sm transition-all active:scale-95 ${
                      on ? "border-gold bg-gold text-gold-foreground font-medium" : "border-border/70 bg-transparent text-foreground/70 hover:text-foreground hover:border-border"
                    }`}
                  >{o.label}</button>
                );
              })}
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground">REBUILT is wellness coaching, not medical care. Flagged conditions route you to our clinician partner.</p>
          </Step>
        )}




        {inGroup("connected_apps") && (() => {
          const POP_APPS = ["Apple Watch", "Apple Health", "Oura", "Whoop", "Garmin", "Google Health"];
          const REST_APPS = ["MyFitnessPal", "Withings", "Strava", "Hevy", "Eight Sleep", "Levels", "Lingo"];
          const selected = (d as { connected_apps_interest?: string[] }).connected_apps_interest ?? [];
          const noneOn = selected.length === 0;
          return (
            <Step id="step-connected_apps" highlight={missingHighlight === "connected_apps"} title="What's already on your wrist?" sub="We'll pull it in when sync is live. Skip if none.">
              <PopularChipPicker
                popular={POP_APPS}
                rest={REST_APPS}
                selected={selected}
                onToggle={(v) => {
                  const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
                  update("connected_apps_interest" as never, next as never);
                }}
              />
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => update("connected_apps_interest" as never, [] as never)}
                  className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                    noneOn ? "border-gold bg-gold/10 text-gold" : "border-border/70 text-muted-foreground/70 hover:border-border hover:text-muted-foreground"
                  }`}
                >None of these yet</button>
              </div>
            </Step>
          );
        })()}


        {inGroup("notifications") && (
          <Step id="step-notifications" highlight={missingHighlight === "notifications"} title="How we hold the line." sub="Pick how loud, and when." top>
            <div className="mt-4 space-y-2">
              <ToggleRow label="Push" sub="Lands on your home screen. Recommended." value={!!d.notification_push} onChange={(v) => update("notification_push", v)} />
              <ToggleRow label="Email" sub="Daily motivation + weekly check-in." value={!!d.notification_email} onChange={(v) => update("notification_email", v)} />
              <ToggleRow label="SMS" sub="Text reminders. Reply STOP any time." value={!!d.notification_sms} onChange={(v) => update("notification_sms", v)} />
            </div>





            {d.notification_sms && (() => {
              const phone = d.phone_e164 ?? "";
              const matchedDial = (() => {
                if (!phone.startsWith("+")) return "";
                const digits = phone.slice(1);
                const sorted = Object.values(DIAL_CODES).sort((a, b) => b.length - a.length);
                return sorted.find((dc) => digits.startsWith(dc)) ?? "";
              })();
              const fallbackDial = DIAL_CODES[(d as { country_code?: string }).country_code ?? "US"] ?? "1";
              const selectedDial = matchedDial || fallbackDial;
              const nationalNumber = matchedDial ? phone.slice(1 + matchedDial.length) : phone.replace(/^\+/, "");
              const setPhone = (dial: string, national: string) => {
                const cleanNational = national.replace(/[^\d]/g, "");
                update("phone_e164", cleanNational ? `+${dial}${cleanNational}` : "");
              };
              return (
                <div className="mt-3">
                  <p className="label-mono mb-2">Phone</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedDial}
                      onChange={(e) => setPhone(e.target.value, nationalNumber)}
                      className="h-12 rounded-lg bg-card border border-border/60 px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 max-w-[8rem]"
                      aria-label="Country code"
                    >
                      {COUNTRIES.filter((c) => DIAL_CODES[c.code]).map((c) => (
                        <option key={c.code} value={DIAL_CODES[c.code]}>
                          {flagFromCountry(c.code)} +{DIAL_CODES[c.code]} {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={nationalNumber}
                      onChange={(e) => setPhone(selectedDial, e.target.value)}
                      placeholder="5551234567"
                      autoComplete="tel-national"
                      inputMode="tel"
                      className="flex-1 h-12 rounded-lg bg-card border border-border/60 px-3 text-foreground text-base focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    By turning on SMS you consent to receive recurring messages. Reply STOP to opt out, HELP for help.
                  </p>
                </div>
              );
            })()}

            <label className={`mt-4 flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
              d.legal_consent_accepted === true ? "border-gold bg-card" : "border-oxblood/60 bg-oxblood/5"
            }`}>
              <input
                type="checkbox"
                checked={d.legal_consent_accepted === true}
                onChange={(e) => update("legal_consent_accepted", e.target.checked as unknown as true)}
                className="mt-0.5 h-4 w-4 accent-gold"
              />
              <span className="text-xs text-foreground/90 leading-relaxed">
                {d.legal_consent_accepted !== true && <span className="block label-mono text-[10px] text-oxblood mb-1">Required to continue</span>}
                I'm 18 or older. I understand REBUILT is wellness coaching, not medical care, and I've read the{" "}
                <a href="/legal" target="_blank" rel="noreferrer" className="text-gold underline">Medical Disclaimer & Terms</a>. I will talk to a licensed clinician before starting any medication, peptide, hormone, or new supplement.
              </span>
            </label>
          </Step>
        )}

      </section>


      {(() => {
        // Hide the floating Next pill on auto-advance screens.
        const autoAdvanceStep = inGroup("experience") || inGroup("name");
        // On the food group, the pill walks through substeps before advancing.
        const inFood = inGroup("nutrition") || inGroup("taste");
        const allergyPicks = d.allergies.filter((a) => a !== "None");
        const onAllergies = inFood && foodSubstep === "allergies" && allergyPicks.length > 0;
        const cuisineCount = (d.taste_profile?.cuisines as string[] | undefined)?.length ?? 0;
        const onTaste =
          inFood &&
          foodSubstep === "taste" &&
          (tasteIndex !== 0 || cuisineCount >= 3) &&
          !(tasteIndex === 2 && !(skipChoice === "some" && (d.taste_profile?.hard_nos?.length ?? 0) > 0));
        // On goals_specific, hide pill when nothing picked or when pick auto-advances.
        const metricType = d.success_metric?.type;
        const hideOnGoalsSpecific = inGroup("goals_specific") && (!metricType || metricType === "photo" || metricType === "coach_decide");
        // Always show on the final notifications step so users can submit (disabled if invalid).
        const onNotifications = inGroup("notifications");
        const shouldShow = onNotifications
          ? true
          : (!autoAdvanceStep && !hideOnGoalsSpecific && canAdvance && !inFood)
            ? true
            : (onAllergies || onTaste);
        const smsNeedsPhone = onNotifications && !!d.notification_sms && !(d.phone_e164 && /^\+\d{8,15}$/.test(d.phone_e164));
        const needsConsent = onNotifications && d.legal_consent_accepted !== true;
        const onLifestyleRest = inGroup("lifestyle") && lifestyleSubstep === "rest" && d.sleep_hours !== undefined && d.stress_level !== undefined;
        const disabled = busy || (onNotifications && (smsNeedsPhone || needsConsent)) ||
          (!onAllergies && !onTaste && !onLifestyleRest && !canAdvance);
        const label = busy
          ? "Saving…"
          : onNotifications
            ? (needsConsent ? "Accept terms to finish" : smsNeedsPhone ? "Enter phone number" : "Let the coach design")
            : onAllergies
              ? "Continue"
              : onTaste
                ? (tasteIsLast ? (idx === TOTAL_GROUPS - 1 ? "Let the coach design" : "Continue") : "Continue")
                : onLifestyleRest
                  ? "Continue"
                  : idx === TOTAL_GROUPS - 1
                    ? "Let the coach design"
                    : "Continue";
        return (
          <AnimatePresence>
            {shouldShow && (
              <motion.div
                key="next-bar"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: REBUILT_EASE }}
                className="fixed inset-x-0 bottom-0 z-30 pb-safe bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-t border-border/40"
              >
                <div className="max-w-md mx-auto px-6 pt-3 pb-5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onAllergies) { setFoodSubstep("taste"); return; }
                      if (onTaste) {
                        if (tasteIsLast) { goNext(); } else { tasteRef.current?.next(); }
                        return;
                      }
                      if (onLifestyleRest) { setLifestyleSubstep("mind"); return; }
                      goNext();
                    }}

                    disabled={disabled}
                    className="w-full h-14 rounded-2xl bg-gold text-gold-foreground text-base font-semibold shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--gold)_60%,transparent)] hover:opacity-90 disabled:opacity-50 touch-manipulation select-none transition-opacity"
                  >
                    {label}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );
      })()}

    </main>
  );
}

// TimeDial moved to src/components/TimeDial.tsx



function Step({ id, title, sub, children, top }: { id?: string; title?: string; sub?: string; highlight?: boolean; centered?: boolean; top?: boolean; children: React.ReactNode }) {
  return (
    <div id={id} className={`relative flex-1 min-h-0 flex flex-col items-center text-center scroll-mt-24 rounded-lg ${top ? "justify-start pt-8 sm:pt-12" : "justify-center"}`}>
      {title && <h1 className="font-display text-[1.75rem] sm:text-3xl leading-tight max-w-sm">{title}</h1>}
      {sub && <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">{sub}</p>}
      <div className={`${title || sub ? "mt-6" : ""} space-y-3 w-full max-w-sm text-left`}>{children}</div>
    </div>
  );
}


function ThreadNode({
  numeral,
  label,
  sublabel,
  active,
  children,
}: {
  numeral: string;
  label: string;
  sublabel?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative pl-9 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={`absolute left-0 top-4 first:top-0 grid h-[22px] w-[22px] place-items-center rounded-full border bg-background text-[9px] label-mono transition-colors ${
          active ? "border-gold text-gold shadow-[0_0_10px_color-mix(in_oklab,var(--gold)_45%,transparent)]" : "border-border text-muted-foreground"
        }`}
      >
        {numeral}
      </span>
      <p className="label-mono mb-3 flex items-baseline gap-2">
        <span className={active ? "text-gold" : "text-foreground"}>{label}</span>
        {sublabel && <span className="text-muted-foreground text-[10px]">— {sublabel}</span>}
      </p>
      {children}
    </section>
  );
}

type Bucket = { label: string; sub: string; value: number; match: (v: number) => boolean };
function BucketRow({ label, value, onChange, buckets }: { label: string; value: number; onChange: (v: number) => void; buckets: Bucket[] }) {
  const activeIdx = Math.max(0, buckets.findIndex((b) => b.match(value)));
  const layoutId = `bucket-cursor-${label}`;
  const progressPct = buckets.length > 1 ? (activeIdx / (buckets.length - 1)) * 100 : 0;
  return (
    <div className="py-2.5 sm:py-3">
      <p className="label-mono mb-4 text-foreground">{label}</p>
      <div role="radiogroup" aria-label={label} className="relative px-0 sm:px-2">
        {/* Track */}
        <div className="relative h-3">
          {/* Base line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gold/25" />
          {/* Filled segment */}
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-gold"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: REBUILT_EASE }}
          />
          {/* Ticks */}
          <div className="absolute inset-0 flex items-center justify-between">
            {buckets.map((b, i) => {
              const on = i === activeIdx;
              return (
                <button
                  key={b.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${b.label} — ${b.sub}`}
                  onClick={() => onChange(b.value)}
                  className="relative h-5 w-5 grid place-items-center"
                >
                  <span
                    className={`block rounded-full transition-colors ${
                      on
                        ? "h-2.5 w-2.5 bg-gold"
                        : i < activeIdx
                          ? "h-1.5 w-1.5 bg-gold/70"
                          : "h-1.5 w-1.5 border border-gold/40 bg-background"
                    }`}
                  />
                  {on && (
                    <motion.span
                      layoutId={layoutId}
                      transition={{ duration: 0.28, ease: REBUILT_EASE }}
                      className="absolute h-3.5 w-3.5 rounded-full bg-gold shadow-[0_0_12px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {/* Labels */}
        <div className="mt-2.5 sm:mt-3 flex items-start justify-between">
          {buckets.map((b, i) => {
            const on = i === activeIdx;
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => onChange(b.value)}
                className={`flex-1 min-w-0 px-1 text-center leading-tight transition-colors ${on ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span className="block text-[11px] sm:text-xs font-medium">{b.label}</span>
                <span className="block text-[9px] sm:text-[10px] opacity-70 mt-0.5 truncate">{b.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LineSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | undefined;
  onChange: (v: T) => void;
  options: { v: T; label: string; sub: string }[];
}) {
  const activeIdx = value ? options.findIndex((o) => o.v === value) : -1;
  const layoutId = `lineselect-cursor-${label}`;
  const progressPct = activeIdx >= 0 && options.length > 1 ? (activeIdx / (options.length - 1)) * 100 : 0;
  return (
    <div className="py-2.5 sm:py-3">
      <p className="label-mono mb-4">{label}</p>
      <div role="radiogroup" aria-label={label} className="relative px-0 sm:px-2">
        <div className="relative h-3">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gold/25" />
          {activeIdx >= 0 && (
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-gold"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3, ease: REBUILT_EASE }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-between">
            {options.map((o, i) => {
              const on = i === activeIdx;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${o.label} — ${o.sub}`}
                  onClick={() => onChange(o.v)}
                  className="relative h-5 w-5 grid place-items-center"
                >
                  <span
                    className={`block rounded-full transition-colors ${
                      on
                        ? "h-2.5 w-2.5 bg-gold"
                        : activeIdx >= 0 && i < activeIdx
                          ? "h-1.5 w-1.5 bg-gold/70"
                          : "h-1.5 w-1.5 border border-gold/40 bg-background"
                    }`}
                  />
                  {on && (
                    <motion.span
                      layoutId={layoutId}
                      transition={{ duration: 0.28, ease: REBUILT_EASE }}
                      className="absolute h-3.5 w-3.5 rounded-full bg-gold shadow-[0_0_12px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 sm:mt-3 flex items-start justify-between">
          {options.map((o, i) => {
            const on = i === activeIdx;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange(o.v)}
                className={`flex-1 min-w-0 px-1 text-center leading-tight transition-colors ${on ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span className="block text-[11px] sm:text-xs font-medium">{o.label}</span>
                <span className="block text-[9px] sm:text-[10px] opacity-70 mt-0.5 truncate">{o.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}






function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; autoComplete?: string; inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" }) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete}
      inputMode={props.inputMode}
      enterKeyHint="next"
      className="h-12 w-full rounded-md border border-border bg-input px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none touch-manipulation"
    />
  );
}

function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={3}
      className="w-full rounded-md border border-border bg-input p-3 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
    />
  );
}

function HeightFtIn({ cm, onChange }: { cm: number | undefined; onChange: (cm: number | undefined) => void }) {
  // Keep feet/inches locally so picking inches first never saves a tiny height.
  const init = (() => {
    if (!cm || cm < 100) return { f: undefined as number | undefined, i: undefined as number | undefined };
    let f = Math.floor(cm / 2.54 / 12);
    let i = Math.round(cm / 2.54 - f * 12);
    if (i === 12) { f += 1; i = 0; }
    return { f, i };
  })();
  const [feet, setFeet] = useState<number | undefined>(init.f);
  const [inches, setInches] = useState<number | undefined>(init.i);
  const set = (f: number | undefined, i: number | undefined) => {
    setFeet(f);
    setInches(i);
    if (f === undefined) return onChange(undefined);
    onChange(+((f * 12 + (i ?? 0)) * 2.54).toFixed(1));
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-4">
      <label className="text-sm">Height</label>
      <div className="flex items-center gap-2">
        <Stepper value={feet} onChange={(v) => set(v, inches)} min={3} max={8} suffix="ft" />
        <Stepper value={inches} onChange={(v) => set(feet, v)} min={0} max={11} suffix="in" />
      </div>
    </div>
  );
}

function buildRange(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const decimals = (step.toString().split(".")[1] || "").length;
  for (let v = min; v <= max + 1e-9; v += step) {
    out.push(decimals ? +v.toFixed(decimals) : v);
  }
  return out;
}

function NumberSelect({ value, onChange, min, max, step = 1, ariaLabel, className, placeholder = "—" }: {
  value: number | undefined; onChange: (v: number | undefined) => void;
  min: number; max: number; step?: number; ariaLabel?: string; className?: string; placeholder?: string;
}) {
  const options = buildRange(min, max, step);
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        haptic("selection");
        onChange(v === "" ? undefined : Number(v));
        const row = (e.currentTarget as HTMLSelectElement).closest('[data-numberrow]');
        row?.scrollIntoView({ block: "center", behavior: "smooth" });
      }}
      className={`h-12 w-[120px] rounded-md border border-border bg-input px-3 pr-8 text-foreground text-base text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring touch-manipulation ${className ?? ""}`}
    >
      <option value="">{placeholder}</option>
      {options.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>

  );
}

function Stepper({ value, onChange, min, max, suffix }: { value: number | undefined; onChange: (v: number | undefined) => void; min: number; max: number; suffix: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <NumberSelect value={value} onChange={onChange} min={min} max={max} ariaLabel={suffix} />
      <span className="label-mono text-xs">{suffix}</span>
    </div>
  );
}

function NumberRow(props: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
  suffix?: string; min?: number; max?: number; step?: number; placeholderHint?: string;
}) {
  const step = props.step ?? 1;
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  return (
    <div data-numberrow className="flex items-start justify-between gap-3 border-b border-border py-4">
      <div className="flex-1 min-w-0">
        <label className="text-sm">{props.label}</label>
        {props.placeholderHint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{props.placeholderHint}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <NumberSelect
          value={props.value}
          onChange={props.onChange}
          min={min}
          max={max}
          step={step}
          ariaLabel={props.label}
          placeholder="—"
        />
        {props.suffix && <span className="label-mono w-10">{props.suffix}</span>}
      </div>
    </div>
  );
}


function PopularChipPicker({
  popular,
  rest,
  selected,
  onToggle,
  customValues,
  onCustomChange,
  customPlaceholder,
}: {
  popular: string[];
  rest: string[];
  selected: string[];
  onToggle: (v: string) => void;
  customValues?: string[];
  onCustomChange?: (v: string[]) => void;
  customPlaceholder?: string;
}) {
  const hasHidden = rest.some((r) => selected.includes(r)) || ((customValues?.length ?? 0) > 0);
  const [open, setOpen] = useState<boolean>(hasHidden);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {popular.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`h-11 px-4 rounded-full border text-sm transition-all active:scale-95 ${
                on
                  ? "border-gold bg-gold text-gold-foreground font-medium"
                  : "border-border/70 bg-transparent text-foreground/70 hover:text-foreground hover:border-border"
              }`}
            >{opt}</button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`h-11 px-4 rounded-full border border-dashed text-sm transition-colors active:scale-95 ${
            open ? "border-gold/60 text-gold" : "border-border/70 text-muted-foreground hover:text-foreground"
          }`}
          aria-expanded={open}
        >{open ? "Other −" : "Other +"}</button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: REBUILT_EASE }}
            className="overflow-hidden"
          >
            <div className="pt-3 flex flex-wrap gap-2">
              {rest.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onToggle(opt)}
                    className={`h-11 px-4 rounded-full border text-sm transition-all active:scale-95 ${
                      on
                        ? "border-gold bg-gold text-gold-foreground font-medium"
                        : "border-border/70 bg-transparent text-foreground/70 hover:text-foreground hover:border-border"
                    }`}
                  >{opt}</button>
                );
              })}
            </div>
            {onCustomChange && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Add your own</p>
                <ChipInput
                  values={customValues ?? []}
                  onChange={onCustomChange}
                  placeholder={customPlaceholder}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipGrid({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`h-11 px-4 rounded-full border text-sm transition-all active:scale-95 ${
              on
                ? "border-gold bg-gold text-gold-foreground font-medium"
                : "border-border/40 bg-transparent text-foreground/70 hover:text-foreground hover:border-border"
            }`}
          >{opt}</button>
        );
      })}
    </div>
  );
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span key={v} className="h-10 pl-3 pr-1 rounded-full border border-border text-sm flex items-center gap-1">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90" aria-label={`Remove ${v}`}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-border bg-input px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 border border-border rounded-lg p-4 text-left hover:bg-card"
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <span className={`h-6 w-11 rounded-full relative transition-colors ${value ? "bg-gold" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function BaselinePhotoStep({ reminderTime }: { reminderTime: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [reminded, setReminded] = useState(false);

  const { scheduledAt, timeLabel, whenLabel } = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})/.exec(reminderTime || "06:00");
    const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 6;
    const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    const isTomorrow = d.getTime() <= Date.now();
    if (isTomorrow) d.setDate(d.getDate() + 1);
    const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const whenLabel = isTomorrow ? "tomorrow morning" : "this morning";
    return { scheduledAt: d, timeLabel, whenLabel };
  }, [reminderTime]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await uploadBaselinePhoto(file);
      setPreview(URL.createObjectURL(file));
      try { window.localStorage.removeItem("rebuilt:baseline_snooze_until"); } catch { /* noop */ }
      toast.success("Locked in. Day one is on the board.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remindAtNextMorning() {
    try {
      window.localStorage.setItem("rebuilt:baseline_remind_at", scheduledAt.toISOString());
      window.localStorage.removeItem("rebuilt:baseline_snooze_until");
    } catch { /* noop */ }
    setReminded(true);
    haptic("light");
    toast.success(`We'll nudge you ${whenLabel} at ${timeLabel}.`);
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="aspect-[3/4] w-full max-w-sm mx-auto rounded-xl overflow-hidden border-2 border-gold/60 shadow-[0_0_30px_-10px_oklch(0.74_0.10_80/0.5)]">
          <img src={preview} alt="baseline" className="w-full h-full object-cover" />
        </div>
        <p className="text-center font-display text-xl text-gold inline-flex items-center justify-center gap-2 w-full">
          <Check className="h-5 w-5" /> Locked in.
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 disabled:opacity-50"
        >Retake</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Big tappable silhouette tile — full-width, opens native camera */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="relative w-full aspect-[4/5] max-w-[200px] sm:max-w-[240px] mx-auto block rounded-xl border-2 border-dashed border-gold/50 bg-card/40 hover:border-gold transition-colors disabled:opacity-50 overflow-hidden group"
        aria-label="Capture day one photo"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center group-active:scale-95 transition-transform">
            <Camera className="h-5 w-5 text-gold" />
          </div>
          <p className="font-display text-lg text-foreground leading-tight">{busy ? "Saving…" : "Tap to capture day one"}</p>
          <p className="text-[11px] text-muted-foreground max-w-[18ch]">Mirror selfie is fine. Good light. No filter.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={remindAtNextMorning}
        disabled={busy}
        className="w-full h-12 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-gold/60 transition-colors disabled:opacity-50 touch-manipulation"
      >
        {reminded ? `Reminder set for ${timeLabel}` : `I'm in public — remind me ${whenLabel} at ${timeLabel}`}
      </button>


      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
