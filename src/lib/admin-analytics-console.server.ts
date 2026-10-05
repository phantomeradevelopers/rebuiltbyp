import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Range = "today" | "7d" | "30d" | "90d" | "all";

function cutoffIso(range: Range): string | null {
  if (range === "all") return null;
  const d = new Date();
  if (range === "today") {
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

type Ev = {
  occurred_at: string;
  session_id: string;
  visitor_id: string;
  event_type: string;
  name: string | null;
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  device: string | null;
  duration_ms: number | null;
  is_new: boolean | null;
  href: string | null;
  dead_link: boolean | null;
  value_cents: number | null;
};

const SOCIALS: { match: RegExp; label: string }[] = [
  { match: /instagram|ig\.me|l\.instagram/i, label: "Instagram" },
  { match: /facebook|fb\.com|l\.facebook/i, label: "Facebook" },
  { match: /tiktok/i, label: "TikTok" },
  { match: /youtube|youtu\.be/i, label: "YouTube" },
  { match: /twitter|t\.co|(^|\.)x\.com/i, label: "X / Twitter" },
  { match: /linkedin|lnkd\.in/i, label: "LinkedIn" },
  { match: /reddit/i, label: "Reddit" },
  { match: /pinterest/i, label: "Pinterest" },
  { match: /threads/i, label: "Threads" },
  { match: /whatsapp/i, label: "WhatsApp" },
];

function classify(ev: Ev): { source: string; social: boolean } {
  const raw = (ev.utm_source || ev.referrer || "").trim();
  if (!raw) return { source: "Direct", social: false };
  for (const s of SOCIALS) if (s.match.test(raw)) return { source: s.label, social: true };
  if (/google|bing|duckduckgo|yahoo/i.test(raw)) return { source: "Search", social: false };
  try {
    const host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    if (host.includes("rebuiltbyp")) return { source: "Direct", social: false };
    return { source: host, social: false };
  } catch {
    return { source: raw.slice(0, 40), social: false };
  }
}

const dayKey = (iso: string) => iso.slice(0, 10);
const monthKey = (iso: string) => iso.slice(0, 7);
function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday-start
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function bucket(events: Ev[], key: (iso: string) => string) {
  const map = new Map<string, { visitors: Set<string>; sessions: Set<string> }>();
  for (const e of events) {
    const k = key(e.occurred_at);
    const b = map.get(k) ?? { visitors: new Set<string>(), sessions: new Set<string>() };
    b.visitors.add(e.visitor_id);
    b.sessions.add(e.session_id);
    map.set(k, b);
  }
  return [...map.entries()]
    .map(([k, b]) => ({ key: k, visitors: b.visitors.size, sessions: b.sessions.size }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const BUY_RE = /buy|checkout|enrol|enroll|subscribe|get the|join|upgrade|start|bundle|purchase|apply/i;

export async function analyticsOverview(range: Range) {
  const since = cutoffIso(range);

  let evQuery = supabaseAdmin
    .from("web_events")
    .select(
      "occurred_at, session_id, visitor_id, event_type, name, path, referrer, utm_source, device, duration_ms, is_new, href, dead_link, value_cents",
    )
    .order("occurred_at", { ascending: true })
    .limit(100000);
  if (since) evQuery = evQuery.gte("occurred_at", since);

  let txQuery = supabaseAdmin.from("payment_transactions").select("*").limit(20000);
  if (since) txQuery = txQuery.gte("occurred_at", since);

  const [evRes, txRes, subsRes, purchasesRes] = await Promise.all([
    evQuery,
    txQuery,
    supabaseAdmin.from("subscriptions").select("status, product_id, created_at").limit(5000),
    supabaseAdmin.from("course_purchases").select("plan, amount_cents, purchased_at").limit(5000),
  ]);

  const events = (evRes.data ?? []) as Ev[];
  const views = events.filter((e) => e.event_type === "pageview" && e.path);
  const leaves = events.filter((e) => e.event_type === "pageleave" && e.path);
  const clicks = events.filter((e) => e.event_type === "click");

  const visitors = new Set(views.map((e) => e.visitor_id)).size;
  const sessions = new Set(views.map((e) => e.session_id)).size;

  /* -------------------------------------------------------------- traffic */
  const traffic = {
    visitors,
    sessions,
    pageviews: views.length,
    byDay: bucket(views, dayKey),
    byWeek: bucket(views, weekKey),
    byMonth: bucket(views, monthKey),
  };

  /* -------------------------------------------------------------- sources */
  const sessionFirst = new Map<string, Ev>();
  for (const e of views) if (!sessionFirst.has(e.session_id)) sessionFirst.set(e.session_id, e);
  const srcMap = new Map<string, { sessions: number; social: boolean }>();
  for (const e of sessionFirst.values()) {
    const c = classify(e);
    const cur = srcMap.get(c.source) ?? { sessions: 0, social: c.social };
    cur.sessions += 1;
    srcMap.set(c.source, cur);
  }
  const sources = [...srcMap.entries()]
    .map(([source, v]) => ({ source, sessions: v.sessions, social: v.social }))
    .sort((a, b) => b.sessions - a.sessions);

  /* ------------------------------------------------- new/returning, device */
  const newVisitors = new Set(views.filter((e) => e.is_new).map((e) => e.visitor_id));
  const returning = new Set(views.map((e) => e.visitor_id));
  for (const v of newVisitors) returning.delete(v);
  const deviceMap = new Map<string, Set<string>>();
  for (const e of views) {
    const k = e.device ?? "unknown";
    const s = deviceMap.get(k) ?? new Set<string>();
    s.add(e.session_id);
    deviceMap.set(k, s);
  }

  /* ------------------------------------------------------------ page stats */
  const durByPath = new Map<string, number[]>();
  for (const l of leaves) {
    if (!l.duration_ms) continue;
    const arr = durByPath.get(l.path!) ?? [];
    arr.push(l.duration_ms);
    durByPath.set(l.path!, arr);
  }
  // Exit = the last page viewed in a session.
  const lastOfSession = new Map<string, string>();
  for (const v of views) lastOfSession.set(v.session_id, v.path!);
  const exits = new Map<string, number>();
  for (const p of lastOfSession.values()) exits.set(p, (exits.get(p) ?? 0) + 1);

  const pageMap = new Map<string, { visits: number; uniques: Set<string> }>();
  for (const v of views) {
    const cur = pageMap.get(v.path!) ?? { visits: 0, uniques: new Set<string>() };
    cur.visits += 1;
    cur.uniques.add(v.visitor_id);
    pageMap.set(v.path!, cur);
  }
  const pages = [...pageMap.entries()]
    .map(([path, v]) => {
      const durs = durByPath.get(path) ?? [];
      const avgSeconds = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 1000) : null;
      const exitCount = exits.get(path) ?? 0;
      return {
        path,
        visits: v.visits,
        visitors: v.uniques.size,
        avgSeconds,
        exitRate: v.visits ? Math.round((exitCount / v.visits) * 100) : 0,
      };
    })
    .sort((a, b) => b.visits - a.visits);

  /* ---------------------------------------------------------------- funnel */
  const sessionsWithView = new Set(views.map((e) => e.session_id));
  const courseSessions = new Set(views.filter((e) => /^\/course/.test(e.path!)).map((e) => e.session_id));
  const buyClickSessions = new Set(
    clicks.filter((c) => BUY_RE.test(`${c.name ?? ""} ${c.href ?? ""}`)).map((c) => c.session_id),
  );
  const checkoutSessions = new Set(
    events.filter((e) => (e.name ?? "").toLowerCase().includes("checkout_started")).map((e) => e.session_id),
  );
  const purchaseEventSessions = new Set(
    events.filter((e) => (e.name ?? "").toLowerCase().includes("purchase_completed")).map((e) => e.session_id),
  );
  const tx = txRes.data ?? [];
  const paid = tx.filter((t) => t.status === "completed");
  const purchases = Math.max(purchaseEventSessions.size, paid.length);

  const rawSteps = [
    { label: "Landed on the site", count: sessionsWithView.size },
    { label: "Viewed the course page", count: courseSessions.size },
    { label: "Clicked a buy button", count: buyClickSessions.size },
    { label: "Started checkout", count: checkoutSessions.size },
    { label: "Completed purchase", count: purchases },
  ];
  let biggestDrop = { label: "", dropPct: 0, lost: 0 };
  const steps = rawSteps.map((s, i) => {
    if (i === 0) return { ...s, dropPct: 0, lost: 0 };
    const prev = rawSteps[i - 1].count;
    const lost = Math.max(0, prev - s.count);
    const dropPct = prev ? Math.round((lost / prev) * 100) : 0;
    if (prev > 0 && lost > biggestDrop.lost) {
      biggestDrop = { label: `${rawSteps[i - 1].label} → ${s.label}`, dropPct, lost };
    }
    return { ...s, dropPct, lost };
  });

  /* ---------------------------------------------------------------- clicks */
  const clickMap = new Map<string, { name: string; path: string; count: number; dead: boolean; href: string | null }>();
  for (const c of clicks) {
    const key = `${c.name ?? "(unnamed)"}::${c.path ?? "/"}`;
    const cur = clickMap.get(key) ?? {
      name: c.name ?? "(unnamed)",
      path: c.path ?? "/",
      count: 0,
      dead: Boolean(c.dead_link),
      href: c.href,
    };
    cur.count += 1;
    cur.dead = cur.dead || Boolean(c.dead_link);
    clickMap.set(key, cur);
  }
  const clickRanked = [...clickMap.values()].sort((a, b) => b.count - a.count).slice(0, 60);
  const deadClicks = clickRanked.filter((c) => c.dead);

  /* ----------------------------------------------------------------- money */
  const revenueCents = paid.reduce((s, t) => s + (t.amount_cents ?? 0), 0);
  const refunds = tx.filter((t) => t.status === "refunded");
  const failed = tx.filter((t) => t.status === "failed");
  const byProduct = new Map<string, { cents: number; count: number }>();
  for (const t of paid) {
    const k = t.product_key ?? "unknown";
    const cur = byProduct.get(k) ?? { cents: 0, count: 0 };
    cur.cents += t.amount_cents ?? 0;
    cur.count += 1;
    byProduct.set(k, cur);
  }
  const revByDay = new Map<string, number>();
  const revByMonth = new Map<string, number>();
  for (const t of paid) {
    const iso = String(t.occurred_at);
    revByDay.set(dayKey(iso), (revByDay.get(dayKey(iso)) ?? 0) + (t.amount_cents ?? 0));
    revByMonth.set(monthKey(iso), (revByMonth.get(monthKey(iso)) ?? 0) + (t.amount_cents ?? 0));
  }
  const subs = subsRes.data ?? [];
  const activeSubs = subs.filter((s) => ["active", "trialing", "past_due"].includes(String(s.status))).length;
  const canceledSubs = subs.filter((s) => String(s.status) === "canceled").length;
  const coursePurchases = purchasesRes.data ?? [];
  const installments = coursePurchases.filter((p) => p.plan === "installment").length;

  const money = {
    hasData: tx.length > 0 || coursePurchases.length > 0 || subs.length > 0,
    revenueCents,
    refundedCents: refunds.reduce((s, t) => s + (t.amount_cents ?? 0), 0),
    refundCount: refunds.length,
    failedCount: failed.length,
    buyers: paid.length,
    aovCents: paid.length ? Math.round(revenueCents / paid.length) : 0,
    revenuePerVisitorCents: visitors ? Math.round(revenueCents / visitors) : 0,
    conversionPct: visitors ? Math.round((purchases / visitors) * 1000) / 10 : 0,
    byProduct: [...byProduct.entries()]
      .map(([key, v]) => ({ key, cents: v.cents, count: v.count }))
      .sort((a, b) => b.cents - a.cents),
    byDay: [...revByDay.entries()].map(([key, cents]) => ({ key, cents })).sort((a, b) => a.key.localeCompare(b.key)),
    byMonth: [...revByMonth.entries()].map(([key, cents]) => ({ key, cents })).sort((a, b) => a.key.localeCompare(b.key)),
    activeSubs,
    canceledSubs,
    churnPct: subs.length ? Math.round((canceledSubs / subs.length) * 100) : 0,
    coursePlans: { installment: installments, full: coursePurchases.length - installments },
  };

  return {
    range,
    hasTraffic: views.length > 0,
    traffic,
    sources,
    audience: {
      newVisitors: newVisitors.size,
      returningVisitors: returning.size,
      devices: [...deviceMap.entries()].map(([device, s]) => ({ device, sessions: s.size })).sort((a, b) => b.sessions - a.sessions),
    },
    pages,
    funnel: { steps, biggestDrop: biggestDrop.lost > 0 ? biggestDrop : null },
    clicks: { ranked: clickRanked, dead: deadClicks },
    money,
  };
}
