import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "./push.server";
import { entryMessage, dwellMessage, exitMessage, type EntryContext } from "./gym-copy";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const NEARBY_RADIUS_M = 1500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function gwHeaders(extra: Record<string, string> = {}): HeadersInit {
  const key = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_MAPS_API_KEY_1 ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  if (!conn) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ---------- Types ----------

export type Gym = {
  id: string;
  google_place_id: string;
  name: string;
  formatted_address: string | null;
  lat: number;
  lng: number;
  distance_meters?: number;
};

export type UserGymRow = {
  id: string;
  gym_id: string;
  is_primary: boolean;
  nickname: string | null;
  gym: Gym;
};

export type OpenVisit = {
  id: string;
  gym_id: string | null;
  entered_at: string;
  minutes_in: number;
  gym: Gym | null;
};

export type GymContext = {
  userGyms: UserGymRow[];
  openVisit: OpenVisit | null;
  todayVisitCount: number;
  streakDays: number;
  hasLocation: boolean;
  location: { lat: number; lng: number } | null;
};

// ---------- Helpers ----------

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

type PlaceRow = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
};

async function upsertGyms(places: PlaceRow[]): Promise<Gym[]> {
  if (places.length === 0) return [];
  const rows = places
    .filter((p) => p.id && p.location)
    .map((p) => ({
      google_place_id: p.id,
      name: p.displayName?.text ?? "Gym",
      formatted_address: p.formattedAddress ?? null,
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      metadata: {
        rating: p.rating ?? null,
        user_ratings_total: p.userRatingCount ?? null,
        types: p.types ?? [],
      },
    }));
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("gyms")
    .upsert(rows, { onConflict: "google_place_id" })
    .select("id, google_place_id, name, formatted_address, lat, lng");
  if (error) throw new Error(`gyms upsert failed: ${error.message}`);
  return (data ?? []) as Gym[];
}

// ---------- Find nearby gyms ----------

export const findNearbyGyms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusMeters: z.number().min(100).max(50000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const radius = data.radiusMeters ?? NEARBY_RADIUS_M;
    const cacheKey = `nearby:${data.lat.toFixed(3)}:${data.lng.toFixed(3)}:${radius}`;

    // Try cache first
    const { data: cached } = await supabaseAdmin
      .from("gym_lookup_cache")
      .select("result, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    let placeIds: string[];
    if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS) {
      placeIds = (cached.result as { place_ids: string[] }).place_ids;
    } else {
      const body = {
        includedTypes: ["gym", "fitness_center"],
        maxResultCount: 15,
        locationRestriction: {
          circle: { center: { latitude: data.lat, longitude: data.lng }, radius },
        },
      };
      const res = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
        method: "POST",
        headers: gwHeaders({
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types",
        }),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Places API failed [${res.status}]: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as { places?: PlaceRow[] };
      const places = json.places ?? [];
      const upserted = await upsertGyms(places);
      placeIds = upserted.map((g) => g.google_place_id);

      await supabaseAdmin
        .from("gym_lookup_cache")
        .upsert(
          { cache_key: cacheKey, result: { place_ids: placeIds }, fetched_at: new Date().toISOString() },
          { onConflict: "cache_key" },
        );
    }

    if (placeIds.length === 0) return { gyms: [] as Gym[] };

    const { data: rows } = await supabaseAdmin
      .from("gyms")
      .select("id, google_place_id, name, formatted_address, lat, lng")
      .in("google_place_id", placeIds);

    const origin = { lat: data.lat, lng: data.lng };
    const gyms: Gym[] = ((rows ?? []) as Gym[])
      .map((g) => ({ ...g, distance_meters: Math.round(haversineMeters(origin, { lat: g.lat, lng: g.lng })) }))
      .sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));

    return { gyms };
  });

// ---------- Text search for "find my gym" picker ----------

export const searchGymsByText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      query: z.string().min(2).max(120),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      textQuery: `${data.query} gym`,
      includedType: "gym",
      maxResultCount: 10,
    };
    if (data.lat != null && data.lng != null) {
      body.locationBias = {
        circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 50000 },
      };
    }
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: gwHeaders({
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types",
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Places API failed [${res.status}]: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { places?: PlaceRow[] };
    const gyms = await upsertGyms(json.places ?? []);
    return { gyms };
  });

// ---------- User gyms CRUD ----------

export const addUserGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      gymId: z.string().uuid(),
      isPrimary: z.boolean().optional(),
      nickname: z.string().max(60).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.isPrimary) {
      await supabase.from("user_gyms").update({ is_primary: false }).eq("user_id", userId);
    }
    const { error } = await supabase.from("user_gyms").upsert(
      {
        user_id: userId,
        gym_id: data.gymId,
        is_primary: data.isPrimary ?? false,
        nickname: data.nickname ?? null,
      },
      { onConflict: "user_id,gym_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeUserGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userGymId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_gyms")
      .delete()
      .eq("id", data.userGymId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userGymId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_gyms").update({ is_primary: false }).eq("user_id", userId);
    const { error } = await supabase
      .from("user_gyms")
      .update({ is_primary: true })
      .eq("id", data.userGymId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Gym context (for app shell) ----------

async function loadUserGyms(supabase: typeof supabaseAdmin, userId: string): Promise<UserGymRow[]> {
  const { data } = await supabase
    .from("user_gyms")
    .select("id, gym_id, is_primary, nickname, gym:gyms(id, google_place_id, name, formatted_address, lat, lng)")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });
  return ((data ?? []) as unknown) as UserGymRow[];
}

async function loadOpenVisit(supabase: typeof supabaseAdmin, userId: string): Promise<OpenVisit | null> {
  const { data } = await supabase
    .from("gym_visits")
    .select("id, gym_id, entered_at, gym:gyms(id, google_place_id, name, formatted_address, lat, lng)")
    .eq("user_id", userId)
    .is("left_at", null)
    .order("entered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const entered = new Date(data.entered_at as string).getTime();
  return {
    id: data.id as string,
    gym_id: (data.gym_id as string | null) ?? null,
    entered_at: data.entered_at as string,
    minutes_in: Math.floor((Date.now() - entered) / 60000),
    gym: (data.gym as unknown as Gym | null) ?? null,
  };
}

async function computeStreak(userId: string): Promise<{ streakDays: number; todayVisitCount: number; visitsThisWeek: number; daysSinceLast: number | null; isFirstEver: boolean }> {
  const { data } = await supabaseAdmin
    .from("gym_visits")
    .select("entered_at")
    .eq("user_id", userId)
    .order("entered_at", { ascending: false })
    .limit(120);
  const visits = (data ?? []) as Array<{ entered_at: string }>;
  if (visits.length === 0) {
    return { streakDays: 0, todayVisitCount: 0, visitsThisWeek: 0, daysSinceLast: null, isFirstEver: true };
  }

  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const todayKey = dayKey(new Date().toISOString());

  // Unique day set
  const dayKeys = new Set<string>();
  for (const v of visits) dayKeys.add(dayKey(v.entered_at));

  // Streak: walk back from today (or yesterday if no visit today)
  let cursor = new Date();
  if (!dayKeys.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (dayKeys.has(dayKey(cursor.toISOString()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const todayVisitCount = visits.filter((v) => dayKey(v.entered_at) === todayKey).length;

  // Week boundary: Monday 00:00 local
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - day);
  const visitsThisWeek = visits.filter((v) => new Date(v.entered_at).getTime() >= weekStart.getTime()).length;

  // Days since last (excluding any open visit just inserted)
  const last = new Date(visits[0].entered_at);
  const daysSinceLast = Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000));

  return { streakDays: streak, todayVisitCount, visitsThisWeek, daysSinceLast, isFirstEver: false };
}

export const getGymContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [userGyms, openVisit, streak, profile] = await Promise.all([
      loadUserGyms(supabase as unknown as typeof supabaseAdmin, userId),
      loadOpenVisit(supabase as unknown as typeof supabaseAdmin, userId),
      computeStreak(userId),
      supabase
        .from("user_profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("location, home_lat, home_lng" as any)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = (profile.data ?? null) as any;
    const loc = (prof?.location as { lat?: number; lng?: number } | null) ?? null;
    let location: { lat: number; lng: number } | null =
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : null;
    // Fall back to the home_lat/home_lng pair set during onboarding/outdoor setup.
    if (!location && prof?.home_lat != null && prof?.home_lng != null) {
      location = { lat: Number(prof.home_lat), lng: Number(prof.home_lng) };
    }
    return {
      userGyms,
      openVisit,
      todayVisitCount: streak.todayVisitCount,
      streakDays: streak.streakDays,
      hasLocation: !!location,
      location,
    } satisfies GymContext;
  });

// ---------- Enter / dwell / leave ----------

export const enterGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      gymId: z.string().uuid().nullable(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      source: z.enum(["geofence", "manual"]).default("manual"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Close any stale open visit (older than 8h) and reject if there's a fresh one.
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("gym_visits")
      .update({ left_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("left_at", null)
      .lt("entered_at", eightHoursAgo);

    const { data: existing } = await supabaseAdmin
      .from("gym_visits")
      .select("id, entered_at, gym_id, notification_sent")
      .eq("user_id", userId)
      .is("left_at", null)
      .order("entered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const minsIn = Math.floor((Date.now() - new Date(existing.entered_at as string).getTime()) / 60000);
      return {
        visitId: existing.id as string,
        alreadyOpen: true,
        minutesIn: minsIn,
        message: null,
        gymName: null,
      };
    }

    // Compute context BEFORE insert (so isFirstEver/streak reflect prior state).
    const streak = await computeStreak(userId);
    const ctx: EntryContext = {
      isFirstEver: streak.isFirstEver,
      isFirstOfWeek: streak.visitsThisWeek === 0,
      daysSinceLast: streak.daysSinceLast,
      streakDays: streak.streakDays,
      visitsThisWeek: streak.visitsThisWeek,
    };
    const copy = entryMessage(ctx);

    const { data: inserted, error } = await supabaseAdmin
      .from("gym_visits")
      .insert({
        user_id: userId,
        gym_id: data.gymId,
        lat: data.lat,
        lng: data.lng,
        source: data.source,
        verified: data.source === "manual",
        notification_sent: { entered: new Date().toISOString() },
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to record visit");

    // Resolve gym name for overlay/push body
    let gymName: string | null = null;
    if (data.gymId) {
      const { data: g } = await supabaseAdmin.from("gyms").select("name").eq("id", data.gymId).maybeSingle();
      gymName = (g?.name as string | undefined) ?? null;
    }

    // Fire push (best-effort, don't fail the call if it fails)
    try {
      await sendPushToUser(userId, {
        title: copy.title,
        body: gymName ? `${gymName} · ${copy.body}` : copy.body,
        url: "/app",
        tag: copy.tag,
      });
    } catch (e) {
      console.warn("gym entry push failed:", (e as Error).message);
    }

    return {
      visitId: inserted.id as string,
      alreadyOpen: false,
      minutesIn: 0,
      message: copy,
      gymName,
      streakDays: ctx.streakDays + (ctx.isFirstOfWeek || streak.todayVisitCount === 0 ? 1 : 0),
    };
  });

export const keepAliveVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      visitId: z.string().uuid(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: visit } = await supabaseAdmin
      .from("gym_visits")
      .select("id, entered_at, notification_sent, verified")
      .eq("id", data.visitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!visit) return { minutesIn: 0, firedTier: null as null | "thirty" | "sixty" };

    const minutesIn = Math.floor((Date.now() - new Date(visit.entered_at as string).getTime()) / 60000);
    const sent = ((visit.notification_sent as Record<string, string>) ?? {});
    let firedTier: null | "thirty" | "sixty" = null;
    const updated: Record<string, string> = { ...sent };
    let shouldVerify = false;
    if (!visit.verified && minutesIn >= 5) shouldVerify = true;

    const copy30 = !sent.thirty && minutesIn >= 30 ? dwellMessage(30) : null;
    const copy60 = !sent.sixty && minutesIn >= 60 ? dwellMessage(60) : null;
    if (copy60) {
      try {
        await sendPushToUser(userId, { ...copy60, url: "/app" });
      } catch (e) { console.warn("dwell60 push failed:", (e as Error).message); }
      updated.sixty = new Date().toISOString();
      firedTier = "sixty";
    } else if (copy30) {
      try {
        await sendPushToUser(userId, { ...copy30, url: "/app" });
      } catch (e) { console.warn("dwell30 push failed:", (e as Error).message); }
      updated.thirty = new Date().toISOString();
      firedTier = "thirty";
    }

    if (firedTier || shouldVerify) {
      await supabaseAdmin
        .from("gym_visits")
        .update({
          notification_sent: updated,
          verified: shouldVerify ? true : visit.verified,
          updated_at: new Date().toISOString(),
        })
        .eq("id", visit.id as string);
    }

    return { minutesIn, firedTier };
  });

export const leaveGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ visitId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: visit } = await supabaseAdmin
      .from("gym_visits")
      .select("id, entered_at")
      .eq("id", data.visitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!visit) return { ok: false, minutesIn: 0 };
    const minutesIn = Math.floor((Date.now() - new Date(visit.entered_at as string).getTime()) / 60000);
    await supabaseAdmin
      .from("gym_visits")
      .update({ left_at: new Date().toISOString() })
      .eq("id", visit.id as string);

    const exitCopy = exitMessage(minutesIn);
    if (exitCopy) {
      try {
        await sendPushToUser(userId, { ...exitCopy, url: "/app" });
      } catch (e) { console.warn("exit push failed:", (e as Error).message); }
    }
    return { ok: true, minutesIn };
  });
