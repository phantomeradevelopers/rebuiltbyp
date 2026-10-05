export type EatingPattern = "strict" | "flexible" | "chaotic" | "unknown";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const SUBSTITUTIONS = [
  { name: "Whey shake + banana", kcal: 320, protein_g: 32, carbs_g: 38, fat_g: 4, why: "2 min, one shaker, hits protein." },
  { name: "Greek yogurt + berries + honey", kcal: 280, protein_g: 22, carbs_g: 34, fat_g: 4, why: "Cold, no prep, fast carbs." },
  { name: "Beef jerky + apple", kcal: 250, protein_g: 22, carbs_g: 28, fat_g: 6, why: "Pocketable, drives you anywhere." },
  { name: "3 hard-boiled eggs + toast", kcal: 340, protein_g: 24, carbs_g: 20, fat_g: 18, why: "Made in the morning, eat anywhere." },
  { name: "Turkey + cheese deli wrap", kcal: 380, protein_g: 30, carbs_g: 32, fat_g: 14, why: "Gas-station tier, still solid." },
  { name: "Protein bar + almonds", kcal: 300, protein_g: 22, carbs_g: 26, fat_g: 12, why: "Zero prep, zero excuse." },
  { name: "Tuna pouch + crackers", kcal: 290, protein_g: 28, carbs_g: 24, fat_g: 8, why: "Shelf-stable protein on the move." },
];

export function classifyPattern(stats: {
  totalDaysLogged: number;
  perSlot: Record<MealSlot, { days: number; stddevMin: number | null }>;
}): EatingPattern {
  if (stats.totalDaysLogged < 4) return "unknown";
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
  let strict = 0, ok = 0, chaos = 0;
  for (const s of slots) {
    const v = stats.perSlot[s];
    if (!v || v.stddevMin === null) { chaos += 1; continue; }
    if (v.days >= 10 && v.stddevMin < 45) strict += 1;
    else if (v.days >= 7 && v.stddevMin <= 120) ok += 1;
    else chaos += 1;
  }
  if (strict >= 2) return "strict";
  if (chaos >= 2) return "chaotic";
  return "flexible";
}

// timeStr "HH:MM"
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type FoodLogRow = { date: string; meal: MealSlot; logged_at: string };

export function analyzeMealHistory(rows: FoodLogRow[]) {
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
  const perSlot = {} as Record<MealSlot, { minutes: number[]; days: Set<string> }>;
  for (const s of slots) perSlot[s] = { minutes: [], days: new Set() };

  for (const r of rows) {
    const d = new Date(r.logged_at);
    if (Number.isNaN(d.getTime())) continue;
    const minOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
    perSlot[r.meal].minutes.push(minOfDay);
    perSlot[r.meal].days.add(r.date);
  }

  const allDays = new Set(rows.map((r) => r.date));

  const typical: Record<MealSlot, string | null> = { breakfast: null, lunch: null, dinner: null, snack: null };
  const stats = {} as Record<MealSlot, { days: number; stddevMin: number | null }>;

  for (const s of slots) {
    const mins = perSlot[s].minutes;
    if (mins.length >= 3) {
      typical[s] = minutesToHHMM(median(mins));
      stats[s] = { days: perSlot[s].days.size, stddevMin: Math.round(stddev(mins)) };
    } else {
      stats[s] = { days: perSlot[s].days.size, stddevMin: null };
    }
  }

  const pattern = classifyPattern({
    totalDaysLogged: allDays.size,
    perSlot: stats,
  });

  return { typical, stats, pattern, totalDaysLogged: allDays.size };
}

export function missedSlots7d(rows: FoodLogRow[]): Record<MealSlot, number> {
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
  const today = new Date();
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const haveByDate = new Map<string, Set<MealSlot>>();
  for (const r of rows) {
    if (!dates.includes(r.date)) continue;
    if (!haveByDate.has(r.date)) haveByDate.set(r.date, new Set());
    haveByDate.get(r.date)!.add(r.meal);
  }
  const out = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } as Record<MealSlot, number>;
  for (const d of dates) {
    const have = haveByDate.get(d) ?? new Set<MealSlot>();
    for (const s of slots) if (!have.has(s) && s !== "snack") out[s] += 1;
  }
  return out;
}

export async function generateReminderText(args: {
  firstName: string | null;
  pattern: EatingPattern;
  slot: MealSlot;
  plannedMealName: string | null;
  missedToday: MealSlot[];
  minutesLate: number;
  substitution: typeof SUBSTITUTIONS[number] | null;
}): Promise<{ title: string; body: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const name = args.firstName ?? "champ";
  const baseFallback = (() => {
    if (args.pattern === "chaotic" && args.substitution) {
      return {
        title: `${cap(args.slot)} swap, ${name}`,
        body: `Slammed today? ${args.substitution.name} — ${args.substitution.why}`,
      };
    }
    if (args.pattern === "strict") {
      return {
        title: `${cap(args.slot)} time`,
        body: args.plannedMealName ? `Hit it: ${args.plannedMealName}.` : `Time to eat. Stay on schedule.`,
      };
    }
    return {
      title: `${cap(args.slot)}, ${name}`,
      body: args.plannedMealName ? `When you get a window: ${args.plannedMealName}.` : `Grab a clean ${args.slot} when you can.`,
    };
  })();

  if (!apiKey) return baseFallback;

  const tone = args.pattern === "strict"
    ? "Sharp, short, military precision. They eat on schedule."
    : args.pattern === "chaotic"
      ? "Empathetic and practical. They're slammed. Lead with the substitution, no guilt."
      : "Warm and flexible. Give them a window, not a deadline.";

  const system = `You write 1 short push notification for a fitness client. Tone: ${tone}. Address them by first name when given. Max 22 words in body. Max 6 words in title. No emojis. No hashtags. No quotes. Return JSON: {"title": "...", "body": "..."}`;

  const userPayload = {
    name: args.firstName,
    pattern: args.pattern,
    slot: args.slot,
    planned_meal: args.plannedMealName,
    missed_today: args.missedToday,
    minutes_late: args.minutesLate,
    suggested_substitution: args.substitution,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 160,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return baseFallback;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = body.choices?.[0]?.message?.content?.trim();
    if (!txt) return baseFallback;
    const parsed = JSON.parse(txt) as { title?: string; body?: string };
    const title = (parsed.title ?? baseFallback.title).slice(0, 60);
    const bodyText = (parsed.body ?? baseFallback.body).slice(0, 200);
    return { title, body: bodyText };
  } catch {
    return baseFallback;
  } finally {
    clearTimeout(timer);
  }
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
