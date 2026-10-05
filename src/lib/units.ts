/**
 * humanizeIngredient
 * --------------------------------
 * AI meal generators love returning "1 serving" / "1 portion" / "1 unit".
 * That's useless at the counter. This helper rewrites those into real,
 * mouth-feel household measures and always shows imperial + metric when
 * the unit is a true weight or volume.
 *
 * Pure, no React imports — safe to use anywhere.
 */

type Ing = { item: string; qty: string | number; unit: string };

const VAGUE_UNITS = new Set([
  "serving", "servings", "portion", "portions",
  "unit", "units", "piece", "pieces", "pcs",
  "", "—", "-",
]);

// Foods we can map confidently. Keyword → preferred concrete measure for ~1 portion.
// Each fn receives the requested qty (the original "1" / "2" / etc.) and returns
// a final phrase like "2 eggs" or "6 oz (170 g)".
const FOOD_RULES: Array<{ match: RegExp; render: (qty: number) => string }> = [
  { match: /\begg(s)?\b/i,                render: (q) => `${pluralize(q, "egg")}` },
  { match: /\bavocado(s)?\b/i,            render: (q) => `${pluralize(q, "avocado")}` },
  { match: /\bbanana(s)?\b/i,             render: (q) => `${pluralize(q, "banana")}` },
  { match: /\bapple(s)?\b/i,              render: (q) => `${pluralize(q, "apple")}` },
  { match: /\borange(s)?\b/i,             render: (q) => `${pluralize(q, "orange")}` },
  { match: /\b(chicken|turkey).*(breast|thigh|fillet)\b/i,
                                          render: (q) => weightImperialMetric(q * 6, q * 170) },
  { match: /\bsalmon|tuna|cod|tilapia|white fish\b/i,
                                          render: (q) => weightImperialMetric(q * 5, q * 140) },
  { match: /\b(ground|lean) (beef|turkey|chicken|pork)\b/i,
                                          render: (q) => weightImperialMetric(q * 5, q * 140) },
  { match: /\bsteak|ribeye|sirloin|tenderloin\b/i,
                                          render: (q) => weightImperialMetric(q * 8, q * 225) },
  { match: /\b(white|brown|jasmine|basmati) rice\b/i,
                                          render: (q) => `${frac(q * 0.75)} cup cooked (${Math.round(q * 150)} g)` },
  { match: /\bquinoa|farro|couscous|barley\b/i,
                                          render: (q) => `${frac(q * 0.75)} cup cooked (${Math.round(q * 140)} g)` },
  { match: /\boat(meal|s)?\b/i,           render: (q) => `${frac(q * 0.5)} cup dry (${Math.round(q * 40)} g)` },
  { match: /\bsweet potato|potato(es)?\b/i,
                                          render: (q) => `1 medium (~${Math.round(q * 170)} g)` },
  { match: /\b(black|kidney|pinto|chick).*beans?\b|\bchickpeas?\b|\blentils?\b/i,
                                          render: (q) => `${frac(q * 0.5)} cup cooked (${Math.round(q * 90)} g)` },
  { match: /\bgreek yogurt|cottage cheese\b/i,
                                          render: (q) => `${frac(q * 1)} cup (${Math.round(q * 225)} g)` },
  { match: /\bmilk|almond milk|oat milk|soy milk\b/i,
                                          render: (q) => `${frac(q * 1)} cup (${Math.round(q * 240)} ml)` },
  { match: /\bberries|blueberries|raspberries|strawberries\b/i,
                                          render: (q) => `${frac(q * 1)} cup (${Math.round(q * 150)} g)` },
  { match: /\bspinach|kale|arugula|mixed greens|salad greens\b/i,
                                          render: (q) => `${pluralize(q * 2, "handful")} (${Math.round(q * 60)} g)` },
  { match: /\bbroccoli|cauliflower|brussel(s)? sprouts|green beans|asparagus\b/i,
                                          render: (q) => `${frac(q * 1)} cup (${Math.round(q * 90)} g)` },
  { match: /\bnuts?|almonds?|walnuts?|cashews?|pecans?\b/i,
                                          render: (q) => `1 small handful (~${Math.round(q * 28)} g / 1 oz)` },
  { match: /\bpeanut butter|almond butter|nut butter\b/i,
                                          render: (q) => `${q} tbsp (${Math.round(q * 16)} g)` },
  { match: /\bolive oil|avocado oil|cooking oil\b/i,
                                          render: (q) => `${q} tbsp (${Math.round(q * 14)} ml)` },
  { match: /\btortilla(s)?|wrap(s)?\b/i,  render: (q) => `${pluralize(q, "tortilla")}` },
  { match: /\b(whole grain|whole wheat|sourdough)?\s*bread|toast\b/i,
                                          render: (q) => `${pluralize(q, "slice")}` },
  { match: /\bcheese\b/i,                 render: (q) => weightImperialMetric(q * 1, q * 28) },
];

export function humanizeIngredient(ing: Ing): string {
  const qty = parseQty(ing.qty);
  const unit = (ing.unit ?? "").trim().toLowerCase();
  const item = (ing.item ?? "").trim();

  // 1) Vague unit → look up the food and synthesize a real measure.
  if (VAGUE_UNITS.has(unit)) {
    for (const rule of FOOD_RULES) {
      if (rule.match.test(item)) return rule.render(qty || 1);
    }
    // Fallback: don't say "1 serving". Say nothing for the unit; the item name carries weight.
    return qty && qty !== 1 ? `${frac(qty)}× ${item}` : item;
  }

  // 2) Real weight/volume → render both imperial and metric.
  const normalized = normalizeUnit(unit);
  if (normalized === "g") {
    const oz = qty / 28.35;
    if (qty >= 50) return `${formatNum(oz, 1)} oz (${Math.round(qty)} g)`;
    return `${Math.round(qty)} g`;
  }
  if (normalized === "kg") {
    return `${formatNum(qty * 2.2, 1)} lb (${formatNum(qty, 2)} kg)`;
  }
  if (normalized === "oz") {
    return `${formatNum(qty, 1)} oz (${Math.round(qty * 28.35)} g)`;
  }
  if (normalized === "lb") {
    return `${formatNum(qty, 1)} lb (${Math.round(qty * 454)} g)`;
  }
  if (normalized === "ml") {
    return qty >= 240 ? `${frac(qty / 240)} cup (${Math.round(qty)} ml)` : `${Math.round(qty)} ml`;
  }
  if (normalized === "l") {
    return `${formatNum(qty, 2)} L (${Math.round(qty * 33.8)} fl oz)`;
  }
  if (normalized === "cup" || normalized === "cups") {
    return `${frac(qty)} cup${qty > 1 ? "s" : ""} (${Math.round(qty * 240)} ml)`;
  }
  if (normalized === "tbsp") return `${formatNum(qty, 0)} tbsp`;
  if (normalized === "tsp")  return `${formatNum(qty, 0)} tsp`;

  // 3) Countable units (eggs, slices…) — pluralize naturally.
  if (normalized === "slice" || normalized === "slices") return pluralize(qty, "slice");
  if (normalized === "clove" || normalized === "cloves") return pluralize(qty, "clove");

  // Default passthrough — keep whatever the model said but cleaned up.
  return `${qty} ${unit}`.trim();
}

/* ───────────────────────── helpers ───────────────────────── */

function parseQty(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const s = String(raw).trim().toLowerCase();
  // Handle "1/2", "1 1/2", "½"
  const unicode: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75 };
  if (unicode[s]) return unicode[s];
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 1;
}

function normalizeUnit(u: string): string {
  const map: Record<string, string> = {
    g: "g", gram: "g", grams: "g",
    kg: "kg", kilogram: "kg", kilograms: "kg",
    oz: "oz", ounce: "oz", ounces: "oz",
    lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
    ml: "ml", milliliter: "ml", milliliters: "ml",
    l: "l", liter: "l", liters: "l",
    cup: "cup", cups: "cups",
    tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
    tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  };
  return map[u] ?? u;
}

function frac(n: number): string {
  if (n === 0) return "0";
  const whole = Math.floor(n);
  const rest = n - whole;
  const eighths = Math.round(rest * 8);
  const table: Record<number, string> = {
    0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞", 8: "",
  };
  const f = table[eighths];
  if (eighths === 8) return String(whole + 1);
  if (whole === 0 && f) return f;
  if (whole === 0) return formatNum(n, 2);
  return f ? `${whole} ${f}` : String(whole);
}

function pluralize(q: number, noun: string): string {
  const n = Math.max(1, Math.round(q));
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function weightImperialMetric(oz: number, g: number): string {
  return `${formatNum(oz, 1)} oz (${Math.round(g)} g)`;
}

function formatNum(n: number, decimals: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(decimals).replace(/\.0+$/, "");
}
