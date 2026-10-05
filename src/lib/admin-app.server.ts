import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ------------------------------------------------------------------ helpers */

function daysAgoIso(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}
function daysAgoDate(n: number) {
  return daysAgoIso(n).slice(0, 10);
}
function monthKey(iso: string) {
  return String(iso).slice(0, 7);
}

/** Tables that record "the member did something", used for last-seen + active. */
const ACTIVITY: { table: string; col: string; dateOnly?: boolean }[] = [
  { table: "daily_checkins", col: "date", dateOnly: true },
  { table: "food_log", col: "date", dateOnly: true },
  { table: "xp_ledger", col: "created_at" },
  { table: "voice_journals", col: "created_at" },
  { table: "breathing_sessions", col: "created_at" },
  { table: "streak_events", col: "created_at" },
];

async function lastSeenMap(sinceDays = 120): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    ACTIVITY.map(async (a) => {
      const since = a.dateOnly ? daysAgoDate(sinceDays) : daysAgoIso(sinceDays);
      const { data } = await supabaseAdmin
        .from(a.table as never)
        .select(`user_id, ${a.col}`)
        .gte(a.col, since)
        .limit(20000);
      for (const row of (data ?? []) as unknown as Record<string, string>[]) {
        const uid = row["user_id"];
        const ts = String(row[a.col] ?? "").slice(0, 10);
        if (!uid || !ts) continue;
        const cur = out.get(uid);
        if (!cur || ts > cur) out.set(uid, ts);
      }
    }),
  );
  return out;
}

export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro · $129/yr",
  elite: "Elite · $219/yr",
  lifetime_pro: "Lifetime Pro",
};

/* ------------------------------------------------------------------ members */

export async function members() {
  const [profilesRes, seen] = await Promise.all([
    supabaseAdmin
      .from("user_profile")
      .select("user_id, first_name, email, tier, entitlement, created_at, subscription_status, trial_ends_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    lastSeenMap(),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const cutoff = daysAgoDate(30);
  const rows = (profilesRes.data ?? []).map((p) => {
    const last = seen.get(p.user_id) ?? null;
    return {
      user_id: p.user_id,
      name: p.first_name ?? "",
      email: p.email ?? "",
      tier: (p.tier as string) ?? "free",
      plan: PLAN_LABELS[(p.tier as string) ?? "free"] ?? "Free",
      joined: p.created_at ? String(p.created_at).slice(0, 10) : "",
      lastSeen: last,
      state: last && last >= cutoff ? "active" : ("lapsed" as "active" | "lapsed"),
      subscriptionStatus: (p.subscription_status as string) ?? null,
    };
  });

  return {
    members: rows,
    total: rows.length,
    active: rows.filter((r) => r.state === "active").length,
    lapsed: rows.filter((r) => r.state === "lapsed").length,
    byPlan: Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.tier] = (acc[r.tier] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([tier, count]) => ({ tier, label: PLAN_LABELS[tier] ?? tier, count })),
  };
}

export async function memberDetail(userId: string) {
  const [profile, subs, payments, progress, purchases, support, apps] = await Promise.all([
    supabaseAdmin.from("user_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("subscriptions").select("*").eq("user_id", userId).limit(50),
    supabaseAdmin.from("payment_transactions").select("*").eq("user_id", userId).limit(200),
    supabaseAdmin.from("course_progress").select("*").eq("user_id", userId).limit(200),
    supabaseAdmin.from("course_purchases").select("*").eq("user_id", userId).limit(50),
    supabaseAdmin.from("support_messages").select("*").eq("user_id", userId).limit(50),
    supabaseAdmin.from("consult_applications").select("*").eq("user_id", userId).limit(20),
  ]);

  const p = profile.data as Record<string, unknown> | null;
  if (!p) throw new Error("No member with that id.");

  const counts: { label: string; count: number }[] = [];
  const sources: { label: string; table: string; col: string }[] = [
    { label: "Check-ins", table: "daily_checkins", col: "date" },
    { label: "Meals logged", table: "food_log", col: "date" },
    { label: "Journals", table: "voice_journals", col: "created_at" },
    { label: "Breathe sessions", table: "breathing_sessions", col: "created_at" },
    { label: "Coach messages", table: "ai_coach_messages", col: "created_at" },
    { label: "Reps / XP events", table: "xp_ledger", col: "created_at" },
    { label: "Trophies", table: "user_achievements", col: "unlocked_at" },
  ];
  await Promise.all(
    sources.map(async (s) => {
      if (s.table === "ai_coach_messages") {
        const { data: convs } = await supabaseAdmin
          .from("ai_coach_conversations")
          .select("id")
          .eq("user_id", userId)
          .limit(500);
        const ids = (convs ?? []).map((c) => c.id);
        if (!ids.length) return counts.push({ label: s.label, count: 0 });
        const { count } = await supabaseAdmin
          .from("ai_coach_messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", ids);
        return counts.push({ label: s.label, count: count ?? 0 });
      }
      const { count } = await supabaseAdmin
        .from(s.table as never)
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      counts.push({ label: s.label, count: count ?? 0 });
    }),
  );

  const seen = await lastSeenMap(365);

  return {
    profile: {
      user_id: userId,
      name: (p["first_name"] as string) ?? "",
      email: (p["email"] as string) ?? "",
      tier: (p["tier"] as string) ?? "free",
      plan: PLAN_LABELS[(p["tier"] as string) ?? "free"] ?? "Free",
      entitlement: (p["entitlement"] as string) ?? "free",
      joined: p["created_at"] ? String(p["created_at"]).slice(0, 10) : "",
      lastSeen: seen.get(userId) ?? null,
      gender: (p["gender"] as string) ?? null,
      goalSummary: (p["goals"] as unknown) ?? null,
      trialEndsAt: p["trial_ends_at"] ? String(p["trial_ends_at"]).slice(0, 10) : null,
      onboarded: Boolean(p["onboarding_completed_at"]),
    },
    counts: counts.sort((a, b) => b.count - a.count),
    subscriptions: (subs.data ?? []).map((s) => ({
      id: s.id,
      product: s.product_id,
      status: s.status,
      environment: s.environment,
      periodEnd: s.current_period_end ? String(s.current_period_end).slice(0, 10) : null,
      cancelAtPeriodEnd: s.cancel_at_period_end,
    })),
    payments: (payments.data ?? []).map((t) => ({
      id: t.id,
      product: t.product_key,
      amount: t.amount_cents,
      status: t.status,
      kind: t.billing_kind,
      at: String(t.occurred_at).slice(0, 10),
    })),
    courseProgress: (progress.data ?? []).map((r) => ({
      module: r.module_slug,
      started: String(r.started_at).slice(0, 10),
      completed: r.completed_at ? String(r.completed_at).slice(0, 10) : null,
    })),
    purchases: (purchases.data ?? []).map((c) => ({
      plan: c.plan,
      amount: c.amount_cents,
      at: String(c.purchased_at).slice(0, 10),
    })),
    support: (support.data ?? []).map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      at: String(m.created_at).slice(0, 10),
      read: Boolean(m.read_at),
    })),
    coachingApplications: (apps.data ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      at: String(a.created_at).slice(0, 10),
    })),
  };
}

/* ------------------------------------------------------------------- course */

export async function courseStats() {
  const [modulesRes, progressRes, purchasesRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("course_modules").select("*").order("sort_order"),
    supabaseAdmin.from("course_progress").select("*").limit(20000),
    supabaseAdmin.from("course_purchases").select("*").limit(5000),
    supabaseAdmin.from("user_profile").select("user_id, email, first_name").limit(20000),
  ]);

  const modules = modulesRes.data ?? [];
  const progress = progressRes.data ?? [];
  const purchases = purchasesRes.data ?? [];
  const nameByEmail = new Map<string, string>();
  const idByEmail = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    if (p.email) {
      nameByEmail.set(p.email.toLowerCase(), p.first_name ?? "");
      idByEmail.set(p.email.toLowerCase(), p.user_id);
    }
  }

  const buyers = purchases.length;
  const startedBy = new Set(progress.map((r) => r.user_id));

  const moduleRows = modules.map((m) => {
    const rows = progress.filter((r) => r.module_slug === m.slug);
    const done = rows.filter((r) => r.completed_at).length;
    return {
      slug: m.slug,
      title: m.title,
      order: m.sort_order,
      published: m.published,
      started: rows.length,
      completed: done,
      completionPct: rows.length ? Math.round((done / rows.length) * 100) : 0,
      dropped: rows.length - done,
    };
  });

  // Drop-off module: the published module with the most people who started and
  // never finished. Ties break toward the earliest module.
  const dropOff =
    moduleRows.filter((m) => m.dropped > 0).sort((a, b) => b.dropped - a.dropped || a.order - b.order)[0] ?? null;

  // Average days to finish: first started_at to last completed_at per learner
  // who has completed every published module.
  const publishedSlugs = modules.filter((m) => m.published).map((m) => m.slug);
  const perUser = new Map<string, { first: string; last: string; done: number }>();
  for (const r of progress) {
    if (!publishedSlugs.includes(r.module_slug)) continue;
    const cur = perUser.get(r.user_id) ?? { first: r.started_at, last: "", done: 0 };
    if (r.started_at < cur.first) cur.first = r.started_at;
    if (r.completed_at) {
      cur.done += 1;
      if (r.completed_at > cur.last) cur.last = r.completed_at;
    }
    perUser.set(r.user_id, cur);
  }
  const finishers = [...perUser.values()].filter((v) => v.done >= publishedSlugs.length && v.last);
  const avgDays = finishers.length
    ? Math.round(
        finishers.reduce((s, v) => s + (new Date(v.last).getTime() - new Date(v.first).getTime()), 0) /
          finishers.length /
          86400000,
      )
    : null;

  const midCourse = [...perUser.values()].filter((v) => v.done > 0 && v.done < publishedSlugs.length).length;

  return {
    buyers,
    fullPay: purchases.filter((p) => p.plan !== "installment").length,
    installmentPay: purchases.filter((p) => p.plan === "installment").length,
    started: startedBy.size,
    midCourse,
    finished: finishers.length,
    avgDaysToFinish: avgDays,
    dropOff,
    modules: moduleRows,
    recentBuyers: purchases
      .slice()
      .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)))
      .slice(0, 50)
      .map((p) => ({
        email: p.email,
        name: nameByEmail.get(String(p.email).toLowerCase()) ?? "",
        user_id: idByEmail.get(String(p.email).toLowerCase()) ?? null,
        plan: p.plan === "installment" ? "3 × $199" : "$497 one-time",
        amount: p.amount_cents,
        at: String(p.purchased_at).slice(0, 10),
      })),
  };
}

/* -------------------------------------------------------------------- money */

const PRODUCT_LABEL: Record<string, string> = {
  rebuilt_pro: "Pro subscription",
  rebuilt_plus: "Plus subscription",
  rebuilt_elite: "Elite subscription",
  mogul_bundle: "Mogul Bundle",
  course_full: "Course · one-time",
  course_installment: "Course · payment plan",
  consult_1on1: "1-on-1 coaching",
};

export async function moneyStats() {
  const [txRes, subsRes, purchasesRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("payment_transactions").select("*").limit(20000),
    supabaseAdmin.from("subscriptions").select("*").limit(5000),
    supabaseAdmin.from("course_purchases").select("*").limit(5000),
    supabaseAdmin.from("user_profile").select("user_id, tier").limit(20000),
  ]);

  const tx = txRes.data ?? [];
  const paid = tx.filter((t) => t.status === "completed");
  const refunds = tx.filter((t) => t.status === "refunded");
  const failed = tx.filter((t) => t.status === "failed");

  const revenueCents = paid.reduce((s, t) => s + (t.amount_cents ?? 0), 0);
  const refundedCents = refunds.reduce((s, t) => s + (t.amount_cents ?? 0), 0);

  const byProductMap = new Map<string, number>();
  for (const t of paid) {
    const k = t.product_key ?? "unknown";
    byProductMap.set(k, (byProductMap.get(k) ?? 0) + (t.amount_cents ?? 0));
  }
  const byProduct = [...byProductMap.entries()]
    .map(([key, cents]) => ({
      key,
      label: PRODUCT_LABEL[key] ?? key,
      cents,
      sharePct: revenueCents ? Math.round((cents / revenueCents) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);

  const byMonthMap = new Map<string, number>();
  for (const t of paid) {
    const k = monthKey(String(t.occurred_at));
    byMonthMap.set(k, (byMonthMap.get(k) ?? 0) + (t.amount_cents ?? 0));
  }
  const byMonth = [...byMonthMap.entries()].map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month));

  const oneTimeCents = paid.filter((t) => t.billing_kind === "one_time").reduce((s, t) => s + t.amount_cents, 0);
  const planCents = paid.filter((t) => t.billing_kind !== "one_time").reduce((s, t) => s + t.amount_cents, 0);

  const subs = subsRes.data ?? [];
  const activeSubs = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status)).length;
  const canceled = subs.filter((s) => s.status === "canceled").length;
  const churnPct = subs.length ? Math.round((canceled / subs.length) * 100) : 0;

  const payers = new Set(paid.map((t) => t.user_id ?? t.email).filter(Boolean));
  const ltvCents = payers.size ? Math.round((revenueCents - refundedCents) / payers.size) : 0;

  const purchases = purchasesRes.data ?? [];
  const installments = purchases.filter((p) => p.plan === "installment").length;

  const tierCounts = (profilesRes.data ?? []).reduce<Record<string, number>>((acc, p) => {
    const t = (p.tier as string) ?? "free";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return {
    hasData: tx.length > 0 || purchases.length > 0 || subs.length > 0,
    revenueCents,
    refundedCents,
    refundCount: refunds.length,
    failedCount: failed.length,
    netCents: revenueCents - refundedCents,
    oneTimeCents,
    planCents,
    byProduct,
    byMonth,
    activeSubs,
    canceledSubs: canceled,
    churnPct,
    ltvCents,
    payers: payers.size,
    surcharge: {
      installments,
      full: purchases.length - installments,
      extraPerBuyerCents: 59700 - 49700,
      extraTotalCents: installments * (59700 - 49700),
    },
    tierCounts: Object.entries(tierCounts).map(([tier, count]) => ({
      tier,
      label: PLAN_LABELS[tier] ?? tier,
      count,
    })),
  };
}

/* ----------------------------------------------------------------- features */

const FEATURES: { key: string; label: string; table: string; col: string; dateOnly?: boolean }[] = [
  { key: "checkin", label: "Daily check-in", table: "daily_checkins", col: "date", dateOnly: true },
  { key: "food", label: "Food & plate logging", table: "food_log", col: "date", dateOnly: true },
  { key: "journal", label: "Journal", table: "voice_journals", col: "created_at" },
  { key: "breathe", label: "Breathe", table: "breathing_sessions", col: "created_at" },
  { key: "anchor", label: "Spirit anchors", table: "anchor_reflections", col: "anchor_date", dateOnly: true },
  { key: "mindset", label: "Mindset reps", table: "mindset_logs", col: "date", dateOnly: true },
  { key: "readiness", label: "Readiness check", table: "readiness_checkins", col: "day_date", dateOnly: true },
  { key: "identity", label: "Identity check-ins", table: "identity_checkins", col: "created_at" },
  { key: "gyms", label: "Gym visits", table: "gym_visits", col: "entered_at" },
  { key: "outdoor", label: "Outdoor sessions", table: "outdoor_sessions", col: "started_at" },
  { key: "meds", label: "Medication doses", table: "medication_doses", col: "created_at" },
  { key: "trophies", label: "Trophies", table: "user_achievements", col: "unlocked_at" },
  { key: "weekly", label: "Weekly review", table: "weekly_reviews", col: "generated_at" },
];

export async function featureStats() {
  const since = 90;
  const perFeature = await Promise.all(
    FEATURES.map(async (f) => {
      const from = f.dateOnly ? daysAgoDate(since) : daysAgoIso(since);
      const { data } = await supabaseAdmin
        .from(f.table as never)
        .select(`user_id, ${f.col}`)
        .gte(f.col, from)
        .limit(20000);
      const events = ((data ?? []) as unknown as Record<string, string>[])
        .map((r) => ({ user: r["user_id"], ts: String(r[f.col] ?? "").slice(0, 10) }))
        .filter((e) => e.user && e.ts);
      return { ...f, events };
    }),
  );

  const cut30 = daysAgoDate(30);

  const ranked = perFeature
    .map((f) => {
      const users = new Set(f.events.map((e) => e.user));
      const recent = f.events.filter((e) => e.ts >= cut30);
      return {
        key: f.key,
        label: f.label,
        count30: recent.length,
        count90: f.events.length,
        users30: new Set(recent.map((e) => e.user)).size,
        users90: users.size,
      };
    })
    .sort((a, b) => b.count30 - a.count30);

  // First touch: for each member, the feature with the earliest event.
  const firstByUser = new Map<string, { key: string; ts: string }>();
  for (const f of perFeature) {
    for (const e of f.events) {
      const cur = firstByUser.get(e.user);
      if (!cur || e.ts < cur.ts) firstByUser.set(e.user, { key: f.key, ts: e.ts });
    }
  }
  const firstCounts = new Map<string, number>();
  for (const v of firstByUser.values()) firstCounts.set(v.key, (firstCounts.get(v.key) ?? 0) + 1);
  const firstTouch = FEATURES.map((f) => ({
    key: f.key,
    label: f.label,
    count: firstCounts.get(f.key) ?? 0,
  }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);

  // Stickiness: of the members who ever used a feature, the share that came
  // back to it on 3 or more separate days.
  const sticky = perFeature
    .map((f) => {
      const days = new Map<string, Set<string>>();
      for (const e of f.events) {
        const set = days.get(e.user) ?? new Set<string>();
        set.add(e.ts);
        days.set(e.user, set);
      }
      const total = days.size;
      const repeat = [...days.values()].filter((s) => s.size >= 3).length;
      return {
        key: f.key,
        label: f.label,
        users: total,
        repeat,
        stickyPct: total ? Math.round((repeat / total) * 100) : 0,
      };
    })
    .filter((f) => f.users > 0)
    .sort((a, b) => b.stickyPct - a.stickyPct || b.repeat - a.repeat);

  return { ranked, firstTouch, sticky, hasData: ranked.some((r) => r.count90 > 0) };
}

/* ----------------------------------------------------------------- coaching */

export async function coachingStats() {
  const [appsRes, seatsRes, sessionsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("consult_applications").select("*").order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("consult_seats").select("*").limit(1000),
    supabaseAdmin.from("consult_sessions").select("*").limit(2000),
    supabaseAdmin.from("user_profile").select("user_id, first_name, email").limit(20000),
  ]);

  const who = new Map<string, { name: string; email: string }>();
  for (const p of profilesRes.data ?? [])
    who.set(p.user_id, { name: p.first_name ?? "", email: p.email ?? "" });

  const apps = (appsRes.data ?? []).map((a) => ({
    id: a.id,
    user_id: a.user_id,
    name: who.get(a.user_id)?.name ?? "",
    email: who.get(a.user_id)?.email ?? "",
    status: a.status ?? "new",
    want: a.want ?? "",
    obstacle: a.obstacle ?? "",
    at: String(a.created_at).slice(0, 10),
  }));

  const pipeline = ["new", "reviewing", "accepted", "declined"].map((s) => ({
    stage: s,
    count: apps.filter((a) => (a.status ?? "new") === s).length,
  }));

  const seats = (seatsRes.data ?? []).map((s) => ({
    id: s.id,
    user_id: s.user_id,
    name: who.get(s.user_id)?.name ?? "",
    email: who.get(s.user_id)?.email ?? "",
    status: s.status,
    started: s.started_at ? String(s.started_at).slice(0, 10) : null,
    ended: s.ended_at ? String(s.ended_at).slice(0, 10) : null,
  }));

  const sessions = sessionsRes.data ?? [];

  return {
    hasData: apps.length > 0 || seats.length > 0,
    applications: apps,
    pipeline,
    seats,
    activeSeats: seats.filter((s) => s.status === "active").length,
    sessionsBooked: sessions.filter((s) => s.status === "scheduled").length,
    sessionsCompleted: sessions.filter((s) => s.status === "completed").length,
    programValueCents: seats.filter((s) => s.status === "active").length * 300000,
  };
}

/* ------------------------------------------------------------------ support */

export async function supportList() {
  const [msgsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("support_messages").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("user_profile").select("user_id, first_name, email").limit(20000),
  ]);
  const who = new Map<string, { name: string; email: string }>();
  for (const p of profilesRes.data ?? []) who.set(p.user_id, { name: p.first_name ?? "", email: p.email ?? "" });

  const rows = (msgsRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name ?? (m.user_id ? who.get(m.user_id)?.name ?? "" : ""),
    email: m.email ?? (m.user_id ? who.get(m.user_id)?.email ?? "" : ""),
    subject: m.subject ?? "",
    body: m.body,
    source: m.source,
    read: Boolean(m.read_at),
    at: String(m.created_at).slice(0, 16).replace("T", " "),
  }));
  return { messages: rows, unread: rows.filter((r) => !r.read).length, total: rows.length };
}

export async function markSupportRead(id: string, read: boolean) {
  const { error } = await supabaseAdmin
    .from("support_messages")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/* ------------------------------------------------------------------ content */

export async function contentList() {
  const [modulesRes, lessonsRes, quotesRes] = await Promise.all([
    supabaseAdmin.from("course_modules").select("*").order("sort_order"),
    supabaseAdmin.from("nutrition_lessons").select("id, slug, title, summary, sort_order").order("sort_order"),
    supabaseAdmin.from("daily_quotes").select("id, content, context").order("id").limit(500),
  ]);
  return {
    modules: (modulesRes.data ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      summary: m.summary ?? "",
      order: m.sort_order,
      published: m.published,
    })),
    lessons: (lessonsRes.data ?? []).map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      summary: l.summary ?? "",
      order: l.sort_order ?? 0,
    })),
    quotes: (quotesRes.data ?? []).map((q) => ({ id: q.id, content: q.content, context: q.context ?? "" })),
  };
}

export async function saveModule(input: {
  id?: string;
  slug: string;
  title: string;
  summary?: string;
  sort_order?: number;
  published?: boolean;
}) {
  const payload = {
    slug: input.slug,
    title: input.title,
    summary: input.summary ?? null,
    sort_order: input.sort_order ?? 0,
    published: input.published ?? true,
  };
  const q = input.id
    ? supabaseAdmin.from("course_modules").update(payload).eq("id", input.id)
    : supabaseAdmin.from("course_modules").insert(payload);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function setModulePublished(id: string, published: boolean) {
  const { error } = await supabaseAdmin.from("course_modules").update({ published }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteModule(id: string) {
  const { error } = await supabaseAdmin.from("course_modules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
