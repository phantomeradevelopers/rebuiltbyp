import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

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
export type RouteStep = {
  instruction: string;
  distance_m: number;
  maneuver?: string;
};
export type LoopRoute = {
  id: string;
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  polyline: string;
  waypoints: Array<{ lat: number; lng: number }>;
  destination_name?: string | null;
  steps?: RouteStep[];
};

export type CardioPreference = "outdoor" | "treadmill" | "mix" | "none";
export type TreadmillAccess = "home" | "gym" | "both";
export type NaturePreference = "loves_nature" | "neutral" | "prefers_urban";
export type OriginKind = "home" | "work";

export type OutdoorPrefs = {
  cardio_preference: CardioPreference | null;
  treadmill_access: TreadmillAccess | null;
  nature_preference: NaturePreference | null;
  has_dog: boolean;
  dog_count: number;
  outdoor_difficulty: "easy" | "moderate" | "hard" | null;
  outdoor_loop_shape: "loop" | "out_back" | "destination" | null;
};

export type DailyLoopResult = {
  hasHome: boolean;
  hasWork: boolean;
  workLabel: string | null;
  unit: "imperial" | "metric";
  origin: { lat: number; lng: number } | null;
  originKind: OriginKind;
  chosen: LoopRoute | null;
  alternates: LoopRoute[];
  prefs: OutdoorPrefs;
};

export type NearbyHike = {
  place_id: string;
  name: string;
  formatted_address?: string;
  lat: number;
  lng: number;
  rating?: number;
  user_ratings_total?: number;
  drive_distance_m?: number;
  drive_duration_s?: number;
  /** Haversine distance from the origin used for sorting. */
  distance_m?: number;
  photo_url?: string;
  types?: string[];
  saved?: boolean;
};

export type WalkDestination = {
  place_id: string;
  name: string;
  emoji: string;
  category: string;
  lat: number;
  lng: number;
  /** Round-trip walking distance estimate from origin (meters). */
  round_trip_m: number;
  rating?: number;
};

// ---------- Helpers ----------
function offsetLatLng(lat: number, lng: number, distanceM: number, bearingDeg: number) {
  const R = 6378137;
  const br = (bearingDeg * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const dr = distanceM / R;
  const newLat = Math.asin(Math.sin(latR) * Math.cos(dr) + Math.cos(latR) * Math.sin(dr) * Math.cos(br));
  const newLng =
    lngR +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(latR),
      Math.cos(dr) - Math.sin(latR) * Math.sin(newLat),
    );
  return { lat: (newLat * 180) / Math.PI, lng: (newLng * 180) / Math.PI };
}

/** Build N waypoints evenly around origin for a smooth ring loop. */
function ringWaypoints(
  originLat: number,
  originLng: number,
  perimeterM: number,
  startBearing: number,
  count = 6,
) {
  // For a regular N-gon inscribed in a circle, perimeter ≈ 2πr → r = perimeter / (2π).
  const radius = perimeterM / (2 * Math.PI);
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) =>
    offsetLatLng(originLat, originLng, radius, (startBearing + step * (i + 0.5)) % 360),
  );
}

/**
 * Triangle loop: three waypoints at 120° apart. Cleaner three-leg path than
 * the hexagon (which the Routes API would snap into zig-zag detours).
 * For an equilateral triangle of perimeter P, circumradius r = P / (3·√3).
 */
function triangleWaypoints(
  originLat: number,
  originLng: number,
  perimeterM: number,
  startBearing: number,
) {
  const radius = perimeterM / (3 * Math.sqrt(3));
  return [0, 120, 240].map((d) =>
    offsetLatLng(originLat, originLng, radius, (startBearing + d) % 360),
  );
}

/** Single waypoint for an out-and-back ~target meters total. */
function outAndBackWaypoint(
  originLat: number,
  originLng: number,
  totalDistanceM: number,
  bearing: number,
) {
  return offsetLatLng(originLat, originLng, totalDistanceM / 2, bearing);
}

/** Snap a list of lat/lng points to the nearest road via Google Roads API. */
async function snapToRoads(points: Array<{ lat: number; lng: number }>) {
  try {
    const path = points.map((p) => `${p.lat},${p.lng}`).join("|");
    const res = await fetch(
      `${GATEWAY}/roads/v1/nearestRoads?points=${encodeURIComponent(path)}`,
      { headers: gwHeaders() },
    );
    if (!res.ok) return points;
    const json = (await res.json()) as {
      snappedPoints?: Array<{
        location: { latitude: number; longitude: number };
        originalIndex?: number;
      }>;
    };
    const snapped = json.snappedPoints ?? [];
    // Map original index → snapped location (first match wins).
    const out = points.map((p) => ({ ...p }));
    const seen = new Set<number>();
    for (const s of snapped) {
      const idx = s.originalIndex ?? -1;
      if (idx >= 0 && idx < out.length && !seen.has(idx)) {
        out[idx] = { lat: s.location.latitude, lng: s.location.longitude };
        seen.add(idx);
      }
    }
    return out;
  } catch {
    return points;
  }
}


/** Find a real POI to walk to (~half target meters away). Returns null if none. */
async function findDestinationPlace(
  origin: { lat: number; lng: number },
  targetMeters: number,
): Promise<{ name: string; lat: number; lng: number } | null> {
  // Search radius is half the target (one-way distance), capped at Places' 50 km max.
  const searchRadius = Math.min(50000, Math.max(400, Math.round(targetMeters / 2)));
  const body = {
    includedTypes: ["park", "tourist_attraction", "cafe", "library", "plaza"],
    maxResultCount: 12,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius: searchRadius,
      },
    },
  };
  try {
    const res = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: gwHeaders({
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.types",
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        location?: { latitude: number; longitude: number };
        types?: string[];
      }>;
    };
    const halfTarget = targetMeters / 2;
    // Pick the place whose straight-line distance from origin is closest to halfTarget.
    const scored = (json.places ?? [])
      .filter((p) => p.location && p.displayName?.text)
      .map((p) => {
        const lat = p.location!.latitude;
        const lng = p.location!.longitude;
        const d = haversineMetersServer(origin, { lat, lng });
        return { name: p.displayName!.text!, lat, lng, d };
      })
      .filter((p) => p.d >= halfTarget * 0.4 && p.d <= halfTarget * 1.4)
      .sort((a, b) => Math.abs(a.d - halfTarget) - Math.abs(b.d - halfTarget));
    return scored[0] ?? null;
  } catch {
    return null;
  }
}

function haversineMetersServer(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}



async function computeWalkRoute(
  origin: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }>,
) {
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w.lat, longitude: w.lng } } })),
    travelMode: "WALK",
    computeAlternativeRoutes: false,
    units: "METRIC",
  };
  const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: gwHeaders({
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters",
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Routes API failed [${res.status}]: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
      legs?: Array<{
        steps?: Array<{
          distanceMeters?: number;
          navigationInstruction?: { instructions?: string; maneuver?: string };
        }>;
      }>;
    }>;
  };
  const r = json.routes?.[0];
  if (!r || !r.polyline?.encodedPolyline) return null;
  const durSec = r.duration ? parseInt(String(r.duration).replace(/[^\d]/g, ""), 10) || 0 : 0;
  const steps: RouteStep[] = [];
  for (const leg of r.legs ?? []) {
    for (const st of leg.steps ?? []) {
      const instr = st.navigationInstruction?.instructions;
      if (!instr) continue;
      steps.push({
        instruction: instr,
        distance_m: st.distanceMeters ?? 0,
        maneuver: st.navigationInstruction?.maneuver,
      });
    }
  }
  return {
    distance_m: r.distanceMeters ?? 0,
    duration_s: durSec,
    polyline: r.polyline.encodedPolyline,
    steps,
  };
}

// ---------- Server fns ----------

const SetHomeInput = z.object({
  address: z.string().min(2).max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const setHomeLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetHomeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let lat = data.lat ?? null;
    let lng = data.lng ?? null;

    if ((lat == null || lng == null) && data.address) {
      const url = `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`;
      const res = await fetch(url, { headers: gwHeaders() });
      if (!res.ok) throw new Error(`Geocoding failed [${res.status}]`);
      const json = (await res.json()) as {
        status?: string;
        results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
      };
      const loc = json.results?.[0]?.geometry?.location;
      if (!loc) throw new Error("Couldn't find that address. Try a more specific one.");
      lat = loc.lat;
      lng = loc.lng;
    }

    if (lat == null || lng == null) throw new Error("Provide an address or coordinates.");

    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ home_lat: lat, home_lng: lng, home_geocoded_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save your location.");
    return { ok: true as const, lat, lng };
  });

export const setUnitSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ unit: z.enum(["imperial", "metric"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ unit_system: data.unit } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save preference.");
    return { ok: true as const };
  });

const GetLoopInput = z.object({
  targetMeters: z.number().int().min(800).max(20000).optional(),
  shape: z.enum(["loop", "out_back", "destination"]).optional(),
  force: z.boolean().optional(),
});

const DIFFICULTY_DEFAULT_METERS: Record<string, number> = {
  easy: 1609, // 1 mi
  moderate: 3219, // 2 mi
  hard: 4828, // 3 mi
};

export const setOutdoorPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        difficulty: z.enum(["easy", "moderate", "hard"]).optional(),
        shape: z.enum(["loop", "out_back", "destination"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, string> = {};
    if (data.difficulty) update.outdoor_difficulty = data.difficulty;
    if (data.shape) update.outdoor_loop_shape = data.shape;
    if (Object.keys(update).length === 0) return { ok: true as const };
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save preference.");
    return { ok: true as const };
  });

/** Cardio style, treadmill access, nature preference, dog ownership. */
export const setCardioPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cardio_preference: z.enum(["outdoor", "treadmill", "mix", "none"]).optional(),
        treadmill_access: z.enum(["home", "gym", "both"]).nullable().optional(),
        nature_preference: z.enum(["loves_nature", "neutral", "prefers_urban"]).optional(),
        has_dog: z.boolean().optional(),
        dog_count: z.number().int().min(0).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, unknown> = {};
    if (data.cardio_preference !== undefined) update.cardio_preference = data.cardio_preference;
    if (data.treadmill_access !== undefined) update.treadmill_access = data.treadmill_access;
    if (data.nature_preference !== undefined) update.nature_preference = data.nature_preference;
    if (data.has_dog !== undefined) update.has_dog = data.has_dog;
    if (data.dog_count !== undefined) update.dog_count = data.dog_count;
    if (Object.keys(update).length === 0) return { ok: true as const };
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save preference.");
    return { ok: true as const };
  });

/** Save workplace location (mirrors setHomeLocation). */
export const setWorkLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        address: z.string().min(2).max(300).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        label: z.string().min(1).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let lat = data.lat ?? null;
    let lng = data.lng ?? null;
    let label = data.label ?? null;

    if ((lat == null || lng == null) && data.address) {
      const url = `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`;
      const res = await fetch(url, { headers: gwHeaders() });
      if (!res.ok) throw new Error(`Geocoding failed [${res.status}]`);
      const json = (await res.json()) as {
        results?: Array<{
          geometry?: { location?: { lat: number; lng: number } };
          formatted_address?: string;
        }>;
      };
      const first = json.results?.[0];
      const loc = first?.geometry?.location;
      if (!loc) throw new Error("Couldn't find that address.");
      lat = loc.lat;
      lng = loc.lng;
      if (!label && first?.formatted_address) label = first.formatted_address.slice(0, 120);
    }

    if (lat == null || lng == null) throw new Error("Provide an address or coordinates.");

    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        work_lat: lat,
        work_lng: lng,
        work_label: label,
        work_geocoded_at: new Date().toISOString(),
      } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save your workplace.");
    return { ok: true as const, lat, lng, label };
  });

export const clearWorkLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ work_lat: null, work_lng: null, work_label: null, work_geocoded_at: null } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't clear workplace.");
    return { ok: true as const };
  });

const GetLoopInputExt = GetLoopInput.extend({
  origin: z.enum(["home", "work"]).optional(),
});

export const getDailyLoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetLoopInputExt.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<DailyLoopResult> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile")
      .select(
        "home_lat, home_lng, work_lat, work_lng, work_label, unit_system, outdoor_difficulty, outdoor_loop_shape, cardio_preference, treadmill_access, nature_preference, has_dog, dog_count",
      )
      .eq("user_id", userId)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prof as any;
    const unit: "imperial" | "metric" = (p?.unit_system as "imperial" | "metric") ?? "imperial";
    const homeLat = p?.home_lat != null ? Number(p.home_lat) : null;
    const homeLng = p?.home_lng != null ? Number(p.home_lng) : null;
    const workLat = p?.work_lat != null ? Number(p.work_lat) : null;
    const workLng = p?.work_lng != null ? Number(p.work_lng) : null;
    const workLabel: string | null = (p?.work_label as string | null) ?? null;
    const hasHome = homeLat != null && homeLng != null;
    const hasWork = workLat != null && workLng != null;

    const prefs: OutdoorPrefs = {
      cardio_preference: (p?.cardio_preference as CardioPreference | null) ?? null,
      treadmill_access: (p?.treadmill_access as TreadmillAccess | null) ?? null,
      nature_preference: (p?.nature_preference as NaturePreference | null) ?? null,
      has_dog: !!p?.has_dog,
      dog_count: Number(p?.dog_count ?? 0),
      outdoor_difficulty: (p?.outdoor_difficulty as "easy" | "moderate" | "hard" | null) ?? null,
      outdoor_loop_shape: (p?.outdoor_loop_shape as "loop" | "out_back" | "destination" | null) ?? null,
    };

    // Decide which origin to use.
    const requestedOrigin: OriginKind = data.origin ?? "home";
    const useWork = requestedOrigin === "work" && hasWork;
    const originKind: OriginKind = useWork ? "work" : "home";
    const lat = useWork ? workLat : homeLat;
    const lng = useWork ? workLng : homeLng;

    if (lat == null || lng == null) {
      return {
        hasHome,
        hasWork,
        workLabel,
        unit,
        origin: null,
        originKind,
        chosen: null,
        alternates: [],
        prefs,
      };
    }

    const difficulty = (p?.outdoor_difficulty as string) ?? "easy";
    // First-time default is "destination" — a real place to walk to beats an
    // abstract loop. Triangle loop is reserved for users who explicitly pick it.
    const shape: "loop" | "out_back" | "destination" =
      data.shape ?? ((p?.outdoor_loop_shape as "loop" | "out_back" | "destination") || "destination");
    const target = data.targetMeters ?? DIFFICULTY_DEFAULT_METERS[difficulty] ?? 1609;

    // Today's cached row — scope cache key by origin so home/work don't collide.
    const today = new Date().toISOString().slice(0, 10);
    if (!data.force) {
      const { data: cached } = await supabase
        .from("outdoor_routes")
        .select("*")
        .eq("user_id", userId)
        .eq("generated_for_date", today)
        .order("created_at", { ascending: false })
        .limit(8);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (cached as any[]) ?? [];
      const c = rows.find(
        (r) =>
          Math.abs(Number(r.origin_lat) - lat) < 1e-4 &&
          Math.abs(Number(r.origin_lng) - lng) < 1e-4 &&
          Math.abs(r.target_distance_m - target) < 400,
      );
      if (c) {
        return {
          hasHome,
          hasWork,
          workLabel,
          unit,
          origin: { lat, lng },
          originKind,
          chosen: {
            id: c.id,
            distance_m: c.distance_m,
            duration_s: c.duration_s,
            elevation_gain_m: c.elevation_gain_m ?? 0,
            polyline: c.polyline,
            waypoints: (c.waypoints as Array<{ lat: number; lng: number }>) ?? [],
            destination_name: (c.destination_name as string | null) ?? null,
            steps: (c.steps as RouteStep[] | null) ?? undefined,
          },
          alternates: (c.candidates as LoopRoute[]) ?? [],
          prefs,
        };
      }
    }

    const candidates: LoopRoute[] = [];

    if (shape === "destination") {
      // Find a real POI ~half-target away and route there + back.
      const dest = await findDestinationPlace({ lat, lng }, target);
      if (dest) {
        try {
          const route = await computeWalkRoute({ lat, lng }, [{ lat: dest.lat, lng: dest.lng }, { lat, lng }]);
          if (route) {
            candidates.push({
              id: `cand-dest`,
              distance_m: route.distance_m,
              duration_s: route.duration_s,
              elevation_gain_m: 0,
              polyline: route.polyline,
              waypoints: [{ lat: dest.lat, lng: dest.lng }],
              destination_name: dest.name,
              steps: route.steps,
            });
          }
        } catch (e) {
          console.warn("destination route failed", e);
        }
      }
    }

    // Fall back to loop/out_back generation if shape is not destination, OR
    // if destination search came up empty. Order: out_back (impossible to
    // mess up — you just turn around) → triangle loop → hexagon ring.
    if (candidates.length === 0) {
      const baseBearing = Math.floor(Math.random() * 360);
      const seedBearings = [baseBearing, (baseBearing + 120) % 360];
      // Build the attempt list in priority order based on requested shape.
      type Builder = { kind: "out_back" | "triangle" | "ring"; b: number };
      const attempts: Builder[] = [];
      if (shape === "out_back") {
        for (const b of seedBearings) attempts.push({ kind: "out_back", b });
        for (const b of seedBearings) attempts.push({ kind: "triangle", b });
      } else {
        // shape === "loop" OR destination-fallback
        for (const b of seedBearings) attempts.push({ kind: "out_back", b });
        for (const b of seedBearings) attempts.push({ kind: "triangle", b });
        for (const b of seedBearings) attempts.push({ kind: "ring", b });
      }
      for (const a of attempts) {
        try {
          const rawWps =
            a.kind === "out_back"
              ? [outAndBackWaypoint(lat, lng, target, a.b)]
              : a.kind === "triangle"
                ? triangleWaypoints(lat, lng, target, a.b)
                : ringWaypoints(lat, lng, target, a.b, 6);
          // Only snap the far point on out_back (single waypoint). For multi-
          // waypoint loops, snapping every vertex is what made the route
          // zig-zag — let Routes API handle road-fitting between vertices.
          const wps = a.kind === "out_back" ? await snapToRoads(rawWps) : rawWps;
          const route = await computeWalkRoute({ lat, lng }, wps);
          if (route) {
            candidates.push({
              id: `cand-${a.kind}-${a.b}`,
              distance_m: route.distance_m,
              duration_s: route.duration_s,
              elevation_gain_m: 0,
              polyline: route.polyline,
              waypoints: wps,
              steps: route.steps,
            });
            // First good candidate wins for the fallback path — no need to
            // burn more API calls.
            if (candidates.length >= 2) break;
          }
        } catch (e) {
          console.warn("loop candidate failed", e);
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error("Couldn't build a loop here. Try a different distance.");
    }

    candidates.sort((a, b) => Math.abs(a.distance_m - target) - Math.abs(b.distance_m - target));
    const chosen = candidates[0];
    const alternates = candidates.slice(1);

    // Cache today's chosen + alternates (scoped by origin coords above)
    const { data: inserted } = await supabase
      .from("outdoor_routes")
      .insert({
        user_id: userId,
        generated_for_date: today,
        target_distance_m: target,
        distance_m: chosen.distance_m,
        duration_s: chosen.duration_s,
        elevation_gain_m: 0,
        polyline: chosen.polyline,
        waypoints: chosen.waypoints,
        candidates: alternates,
        origin_lat: lat,
        origin_lng: lng,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        steps: (chosen.steps ?? null) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(chosen.destination_name ? { destination_name: chosen.destination_name } as any : {}),
      })
      .select("id")
      .single();

    return {
      hasHome,
      hasWork,
      workLabel,
      unit,
      origin: { lat, lng },
      originKind,
      chosen: { ...chosen, id: (inserted as { id: string } | null)?.id ?? chosen.id },
      alternates,
      prefs,
    };
  });

export const regenerateLoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        targetMeters: z.number().int().min(800).max(20000).optional(),
        shape: z.enum(["loop", "out_back", "destination"]).optional(),
        origin: z.enum(["home", "work"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    // Delete all of today's cached rows (both origins) — cheap, regen happens next.
    await supabase
      .from("outdoor_routes")
      .delete()
      .eq("user_id", userId)
      .eq("generated_for_date", today);
    return { ok: true as const, targetMeters: data.targetMeters, shape: data.shape };
  });


// ---------- Hikes ----------

export const getNearbyHikes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        radiusMeters: z.number().int().min(5000).max(80000).optional(),
        origin: z.enum(["home", "work"]).optional(),
        dogFriendly: z.boolean().optional(),
        // Optional live coordinates — sorts/measures distance from here instead of home/work.
        fromLat: z.number().min(-90).max(90).optional(),
        fromLng: z.number().min(-180).max(180).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ hasHome: boolean; hikes: NearbyHike[] }> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile")
      .select("home_lat, home_lng, work_lat, work_lng, nature_preference, has_dog")
      .eq("user_id", userId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prof as any;
    const useWork = data.origin === "work" && p?.work_lat != null && p?.work_lng != null;
    const anchorLat = useWork
      ? Number(p.work_lat)
      : p?.home_lat != null
        ? Number(p.home_lat)
        : null;
    const anchorLng = useWork
      ? Number(p.work_lng)
      : p?.home_lng != null
        ? Number(p.home_lng)
        : null;

    // Live location wins for both the search circle and the distance ranking.
    const lat = data.fromLat ?? anchorLat;
    const lng = data.fromLng ?? anchorLng;
    if (lat == null || lng == null) return { hasHome: false, hikes: [] };

    const naturePref = (p?.nature_preference as string | null) ?? "neutral";
    const baseRadius =
      naturePref === "loves_nature" ? 50000 : naturePref === "prefers_urban" ? 20000 : 40000;
    const radius = Math.min(50000, data.radiusMeters ?? baseRadius);
    const wantsDogFriendly = data.dogFriendly ?? !!p?.has_dog;

    async function runSearch(textQuery: string) {
      const body = {
        textQuery,
        maxResultCount: 12,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
      };
      const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
        method: "POST",
        headers: gwHeaders({
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos",
        }),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Places API failed [${res.status}]: ${txt.slice(0, 200)}`);
      }
      return (await res.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          rating?: number;
          userRatingCount?: number;
          types?: string[];
          photos?: Array<{ name: string }>;
        }>;
      };
    }

    const primaryQuery = wantsDogFriendly ? "dog friendly hiking trails" : "hiking trails";
    let json = await runSearch(primaryQuery);
    if (!json.places || json.places.length === 0) {
      for (const q of ["nature trails", "walking trails", "parks"]) {
        json = await runSearch(q);
        if (json.places && json.places.length > 0) break;
      }
    }

    const { data: savedRows } = await supabase
      .from("saved_hikes")
      .select("place_id")
      .eq("user_id", userId);
    const savedSet = new Set(
      ((savedRows as Array<{ place_id: string }> | null) ?? []).map((r) => r.place_id),
    );

    const hikes: NearbyHike[] = (json.places ?? [])
      .map((pl) => {
        const hlat = pl.location?.latitude ?? 0;
        const hlng = pl.location?.longitude ?? 0;
        return {
          place_id: pl.id,
          name: pl.displayName?.text ?? "Trail",
          formatted_address: pl.formattedAddress,
          lat: hlat,
          lng: hlng,
          rating: pl.rating,
          user_ratings_total: pl.userRatingCount,
          types: pl.types,
          saved: savedSet.has(pl.id),
          distance_m: Math.round(haversineMetersServer({ lat, lng }, { lat: hlat, lng: hlng })),
        };
      })
      .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));

    return { hasHome: true, hikes };
  });

// ---------- Walkable destinations (fun nearby places) ----------

const DEST_CATEGORIES: Array<{ key: string; emoji: string; query: string; label: string }> = [
  { key: "cafe", emoji: "☕", query: "coffee shop", label: "Coffee" },
  { key: "smoothie", emoji: "🥤", query: "smoothie or juice bar", label: "Smoothie" },
  { key: "healthy", emoji: "🥗", query: "healthy food restaurant", label: "Healthy bite" },
  { key: "wellness", emoji: "🧘", query: "yoga or wellness studio", label: "Wellness" },
  { key: "park", emoji: "🌳", query: "park", label: "Park" },
  { key: "bakery", emoji: "🥐", query: "bakery", label: "Bakery" },
];

export const getWalkableDestinations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: z.enum(["home", "work"]).optional(),
        fromLat: z.number().min(-90).max(90).optional(),
        fromLng: z.number().min(-180).max(180).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ destinations: WalkDestination[] }> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile")
      .select("home_lat, home_lng, work_lat, work_lng")
      .eq("user_id", userId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prof as any;
    const useWork = data.origin === "work" && p?.work_lat != null;
    const anchorLat = useWork ? Number(p.work_lat) : p?.home_lat != null ? Number(p.home_lat) : null;
    const anchorLng = useWork ? Number(p.work_lng) : p?.home_lng != null ? Number(p.home_lng) : null;
    const latMaybe = data.fromLat ?? anchorLat;
    const lngMaybe = data.fromLng ?? anchorLng;
    if (latMaybe == null || lngMaybe == null) return { destinations: [] };
    const lat: number = latMaybe;
    const lng: number = lngMaybe;

    async function searchOne(cat: (typeof DEST_CATEGORIES)[number]) {
      const body = {
        textQuery: cat.query,
        maxResultCount: 3,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 2400 },
        },
      };
      try {
        const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
          method: "POST",
          headers: gwHeaders({
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.location,places.rating,places.userRatingCount",
          }),
          body: JSON.stringify(body),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          places?: Array<{
            id: string;
            displayName?: { text?: string };
            location?: { latitude: number; longitude: number };
            rating?: number;
            userRatingCount?: number;
          }>;
        };
        return (json.places ?? [])
          .filter((pl) => pl.location && pl.displayName?.text)
          .map((pl) => {
            const dLat = pl.location!.latitude;
            const dLng = pl.location!.longitude;
            const one = haversineMetersServer({ lat, lng }, { lat: dLat, lng: dLng });
            return {
              place_id: pl.id,
              name: pl.displayName!.text!,
              emoji: cat.emoji,
              category: cat.label,
              lat: dLat,
              lng: dLng,
              round_trip_m: Math.round(one * 2),
              rating: pl.rating,
              ratingCount: pl.userRatingCount ?? 0,
            };
          });
      } catch {
        return [];
      }
    }

    const all = (await Promise.all(DEST_CATEGORIES.map(searchOne))).flat();
    // Keep things genuinely walkable: cap round-trip at ~3 mi (4800 m).
    const walkable = all.filter((d) => d.round_trip_m > 200 && d.round_trip_m <= 4800);
    // De-dup by name (multiple categories can return the same place).
    const seen = new Set<string>();
    const unique = walkable.filter((d) => {
      if (seen.has(d.place_id)) return false;
      seen.add(d.place_id);
      return true;
    });
    // Sort: nearest first, but boost well-rated places slightly.
    unique.sort((a, b) => {
      const aScore = a.round_trip_m - (a.rating ?? 0) * 100;
      const bScore = b.round_trip_m - (b.rating ?? 0) * 100;
      return aScore - bScore;
    });
    return {
      destinations: unique.slice(0, 8).map(({ ratingCount: _ignored, ...rest }) => rest),
    };
  });

// ---------- Activity preference (walk vs jog) ----------

export const setOutdoorActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ activity: z.enum(["walk", "jog"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_profile")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ outdoor_activity: data.activity } as any)
      .eq("user_id", userId);
    if (error) throw new Error("Couldn't save your activity preference.");
    return { ok: true as const, activity: data.activity };
  });

// Walk to a specific place chosen from the destinations strip.
export const setLoopDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        destLat: z.number().min(-90).max(90),
        destLng: z.number().min(-180).max(180),
        destName: z.string().min(1).max(200),
        origin: z.enum(["home", "work"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("user_profile")
      .select("home_lat, home_lng, work_lat, work_lng")
      .eq("user_id", userId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prof as any;
    const useWork = data.origin === "work" && p?.work_lat != null;
    const lat = useWork ? Number(p.work_lat) : p?.home_lat != null ? Number(p.home_lat) : null;
    const lng = useWork ? Number(p.work_lng) : p?.home_lng != null ? Number(p.home_lng) : null;
    if (lat == null || lng == null) throw new Error("Set your home or work address first.");

    const route = await computeWalkRoute(
      { lat, lng },
      [{ lat: data.destLat, lng: data.destLng }, { lat, lng }],
    );
    if (!route) throw new Error("Couldn't build a walk to that place.");

    const today = new Date().toISOString().slice(0, 10);
    // Wipe today's cached rows so the new destination loop wins.
    await supabase
      .from("outdoor_routes")
      .delete()
      .eq("user_id", userId)
      .eq("generated_for_date", today);

    const { data: inserted } = await supabase
      .from("outdoor_routes")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        user_id: userId,
        generated_for_date: today,
        target_distance_m: route.distance_m,
        distance_m: route.distance_m,
        duration_s: route.duration_s,
        elevation_gain_m: 0,
        polyline: route.polyline,
        waypoints: [{ lat: data.destLat, lng: data.destLng }],
        candidates: [],
        origin_lat: lat,
        origin_lng: lng,
        destination_name: data.destName,
        steps: route.steps ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .single();

    return { ok: true as const, route_id: (inserted as { id: string } | null)?.id ?? null };
  });


export const saveHike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      place_id: z.string().min(1).max(255),
      name: z.string().min(1).max(255),
      snapshot: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("saved_hikes").upsert(
      {
        user_id: userId,
        place_id: data.place_id,
        name: data.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshot: (data.snapshot ?? {}) as any,
      },
      { onConflict: "user_id,place_id" },
    );
    if (error) throw new Error("Couldn't save that hike.");
    return { ok: true as const };
  });

export const unsaveHike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ place_id: z.string().min(1).max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("saved_hikes")
      .delete()
      .eq("user_id", userId)
      .eq("place_id", data.place_id);
    if (error) throw new Error("Couldn't remove that hike.");
    return { ok: true as const };
  });

// ---------- Live tracking sessions ----------

const TrackPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().min(0),
});

export const finishOutdoorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      route_id: z.string().uuid().nullable().optional(),
      started_at: z.string().min(10).max(40),
      ended_at: z.string().min(10).max(40),
      distance_meters: z.number().int().min(0).max(500_000),
      duration_seconds: z.number().int().min(0).max(86_400),
      track: z.array(TrackPoint).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pace =
      data.distance_meters > 100
        ? Math.round((data.duration_seconds / data.distance_meters) * 1000)
        : null;
    const { error } = await supabase.from("outdoor_sessions").insert({
      user_id: userId,
      route_id: data.route_id ?? null,
      started_at: data.started_at,
      ended_at: data.ended_at,
      distance_meters: data.distance_meters,
      duration_seconds: data.duration_seconds,
      avg_pace_seconds_per_km: pace,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      track: data.track as any,
    });
    if (error) throw new Error("Couldn't save your session.");

    // Feed the machine: outdoor loop ticks the workout streak (walks/jogs
    // count as movement) if the session was a real walk (>= 200m).
    if (data.distance_meters >= 200) {
      try {
        const dayLocal = new Date(data.ended_at).toISOString().slice(0, 10);
        await supabase.rpc("fn_tick_streak", {
          p_kind: "workout",
          p_day_local: dayLocal,
          p_grace_days: 1,
          p_source: `outdoor:${data.ended_at.slice(0, 10)}`,
        });
      } catch (e) {
        console.warn("streak tick failed", (e as Error).message);
      }
    }
    return { ok: true as const, avg_pace_seconds_per_km: pace };
  });
