import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "coach"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Not authorized.");
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}
function dateDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const adminUsageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const since7 = isoDaysAgo(7);
    const since30 = isoDaysAgo(30);
    const date30 = dateDaysAgo(30);

    const [
      usersTotal, signups7, signups30,
      active7, active30,
      checkins30, meals30, journals30, mindset30, outdoor30, mobility30, breath30,
      signupsRaw,
    ] = await Promise.all([
      supabaseAdmin.from("user_profile").select("user_id", { count: "exact", head: true }).eq("is_demo", false),
      supabaseAdmin.from("user_profile").select("user_id", { count: "exact", head: true }).eq("is_demo", false).gte("created_at", since7),
      supabaseAdmin.from("user_profile").select("user_id", { count: "exact", head: true }).eq("is_demo", false).gte("created_at", since30),
      supabaseAdmin.from("daily_checkins").select("user_id").gte("date", dateDaysAgo(7)),
      supabaseAdmin.from("daily_checkins").select("user_id").gte("date", date30),
      supabaseAdmin.from("daily_checkins").select("id", { count: "exact", head: true }).gte("date", date30),
      supabaseAdmin.from("food_log").select("id", { count: "exact", head: true }).gte("date", date30),
      supabaseAdmin.from("anchor_reflections").select("id", { count: "exact", head: true }).gte("anchor_date", date30),
      supabaseAdmin.from("mindset_logs").select("id", { count: "exact", head: true }).gte("date", date30),
      supabaseAdmin.from("outdoor_sessions").select("id", { count: "exact", head: true }).gte("started_at", since30),
      supabaseAdmin.from("readiness_checkins").select("id", { count: "exact", head: true }).gte("day_date", date30),
      supabaseAdmin.from("ai_coach_messages").select("id", { count: "exact", head: true }).gte("created_at", since30),
      supabaseAdmin.from("user_profile").select("created_at").eq("is_demo", false).gte("created_at", since30),
    ]);

    const active7Set = new Set((active7.data ?? []).map((r) => r.user_id));
    const active30Set = new Set((active30.data ?? []).map((r) => r.user_id));

    // 30-day signup buckets
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) buckets[dateDaysAgo(i)] = 0;
    for (const row of signupsRaw.data ?? []) {
      const k = String(row.created_at).slice(0, 10);
      if (k in buckets) buckets[k]++;
    }
    const signupSeries = Object.entries(buckets).map(([date, count]) => ({ date, count }));

    return {
      users: usersTotal.count ?? 0,
      signups7: signups7.count ?? 0,
      signups30: signups30.count ?? 0,
      active7: active7Set.size,
      active30: active30Set.size,
      features: [
        { key: "Check-ins", count: checkins30.count ?? 0 },
        { key: "Meals", count: meals30.count ?? 0 },
        { key: "Journal", count: journals30.count ?? 0 },
        { key: "Mindset reps", count: mindset30.count ?? 0 },
        { key: "Outdoor", count: outdoor30.count ?? 0 },
        { key: "Readiness", count: mobility30.count ?? 0 },
        { key: "AI Coach msgs", count: breath30.count ?? 0 },
      ].sort((a, b) => b.count - a.count),
      signupSeries,
    };
  });

export const adminGeoBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("user_profile")
      .select("location").eq("is_demo", false);
    if (error) throw new Error(error.message);

    const countries = new Map<string, number>();
    const cities = new Map<string, { city: string; country: string; count: number }>();
    for (const row of data ?? []) {
      const loc = (row.location ?? {}) as { city?: string; country?: string };
      const country = (loc.country || "Unknown").trim();
      const city = (loc.city || "Unknown").trim();
      countries.set(country, (countries.get(country) ?? 0) + 1);
      const key = `${country}::${city}`;
      const existing = cities.get(key);
      cities.set(key, { city, country, count: (existing?.count ?? 0) + 1 });
    }
    return {
      countries: [...countries.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
      cities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 100),
    };
  });

export const adminListUsersDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const date30 = dateDaysAgo(30);

    const [profilesRes, checkinsRes, mealsRes] = await Promise.all([
      supabaseAdmin
        .from("user_profile")
        .select("user_id, first_name, email, location, rebuilt_start_date, created_at, entitlement").eq("is_demo", false)
        .limit(1000),
      supabaseAdmin.from("daily_checkins").select("user_id, date").gte("date", date30),
      supabaseAdmin.from("food_log").select("user_id, date").gte("date", date30),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const checkinsByUser = new Map<string, Set<string>>();
    for (const row of checkinsRes.data ?? []) {
      const s = checkinsByUser.get(row.user_id) ?? new Set();
      s.add(row.date);
      checkinsByUser.set(row.user_id, s);
    }
    const mealsByUser = new Map<string, number>();
    for (const row of mealsRes.data ?? []) {
      mealsByUser.set(row.user_id, (mealsByUser.get(row.user_id) ?? 0) + 1);
    }

    const rows = (profilesRes.data ?? []).map((p) => {
      const loc = (p.location ?? {}) as { city?: string; country?: string };
      const ci = checkinsByUser.get(p.user_id) ?? new Set();
      const lastActive = [...ci].sort().pop() ?? null;
      return {
        user_id: p.user_id,
        first_name: p.first_name ?? "",
        email: p.email ?? "",
        city: loc.city ?? "",
        country: loc.country ?? "",
        signed_up: p.created_at ? String(p.created_at).slice(0, 10) : null,
        start_date: p.rebuilt_start_date ?? null,
        entitlement: p.entitlement ?? "free",
        checkins_30d: ci.size,
        meals_30d: mealsByUser.get(p.user_id) ?? 0,
        last_active: lastActive,
      };
    });
    rows.sort((a, b) => (a.first_name || a.email).toLowerCase().localeCompare((b.first_name || b.email).toLowerCase()));
    return { users: rows };
  });

export const adminUserUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const date30 = dateDaysAgo(30);
    const cid = data.userId;
    const [ci, fl, ml, je, od, rc] = await Promise.all([
      supabaseAdmin.from("daily_checkins").select("date").eq("user_id", cid).gte("date", date30),
      supabaseAdmin.from("food_log").select("id", { count: "exact", head: true }).eq("user_id", cid).gte("date", date30),
      supabaseAdmin.from("mindset_logs").select("id", { count: "exact", head: true }).eq("user_id", cid).gte("date", date30),
      supabaseAdmin.from("anchor_reflections").select("id", { count: "exact", head: true }).eq("user_id", cid).gte("anchor_date", date30),
      supabaseAdmin.from("outdoor_sessions").select("id", { count: "exact", head: true }).eq("user_id", cid).gte("started_at", isoDaysAgo(30)),
      supabaseAdmin.from("readiness_checkins").select("id", { count: "exact", head: true }).eq("user_id", cid).gte("day_date", date30),
    ]);
    const dates = (ci.data ?? []).map((r) => r.date).sort();
    // current streak ending today or yesterday
    let streak = 0;
    const set = new Set(dates);
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (set.has(k)) streak++;
      else if (i > 0) break;
    }
    return {
      checkins_30d: dates.length,
      meals_30d: fl.count ?? 0,
      mindset_30d: ml.count ?? 0,
      journal_30d: je.count ?? 0,
      outdoor_30d: od.count ?? 0,
      readiness_30d: rc.count ?? 0,
      streak,
      last_active: dates[dates.length - 1] ?? null,
    };
  });
