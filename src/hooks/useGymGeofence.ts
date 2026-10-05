import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  enterGym,
  keepAliveVisit,
  leaveGym,
  findNearbyGyms,
  type Gym,
  type GymContext,
} from "@/lib/gyms.functions";

const ENTER_RADIUS_M = 75;
const LEAVE_RADIUS_M = 200;
const ENTER_CONFIRM_FIXES = 2;
const LEAVE_CONFIRM_MS = 3 * 60 * 1000;
const KEEPALIVE_INTERVAL_MS = 60 * 1000;
const DISCOVERY_KEY = "rebuilt_gym_discovery_v1";
const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;

type EntryEvent = {
  title: string;
  body: string;
  gymName: string | null;
  streakDays: number;
};

let listener: ((e: EntryEvent) => void) | null = null;
export function onGymEntry(cb: (e: EntryEvent) => void): () => void {
  listener = cb;
  return () => { if (listener === cb) listener = null; };
}

async function showGymEntryNotification(evt: EntryEvent): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return;
    const streakLine = evt.streakDays > 1 ? ` · ${evt.streakDays}-day streak 🔥` : "";
    await reg.showNotification(evt.title || "You're in the gym 💪", {
      body: (evt.body || `Today's session is ready.${streakLine}`).slice(0, 200),
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "rebuilt-gym-entry",
      data: { url: "/app/plan" },
      vibrate: [80, 40, 80],
    } as NotificationOptions);
  } catch (e) {
    console.warn("gym entry notification failed:", (e as Error).message);
  }
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function loadCachedDiscovery(): Gym[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { at: number; gyms: Gym[] };
    if (Date.now() - parsed.at > DISCOVERY_TTL_MS) return [];
    return parsed.gyms ?? [];
  } catch { return []; }
}

function saveCachedDiscovery(gyms: Gym[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DISCOVERY_KEY, JSON.stringify({ at: Date.now(), gyms })); } catch { }
}

export function useGymGeofence(ctx: GymContext | null | undefined, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false;
  const enterFn = useServerFn(enterGym);
  const keepAliveFn = useServerFn(keepAliveVisit);
  const leaveFn = useServerFn(leaveGym);
  const findNearbyFn = useServerFn(findNearbyGyms);
  const queryClient = useQueryClient();

  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  const watchIdRef = useRef<number | null>(null);
  const consecutiveInsideRef = useRef<{ gymId: string | null; count: number }>({ gymId: null, count: 0 });
  const outsideSinceRef = useRef<number | null>(null);
  const lastKeepAliveRef = useRef<number>(0);
  const discoveryDoneRef = useRef<boolean>(false);
  const currentVisitIdRef = useRef<string | null>(null);
  const enteringRef = useRef<boolean>(false);

  useEffect(() => {
    currentVisitIdRef.current = ctx?.openVisit?.id ?? null;
  }, [ctx?.openVisit?.id]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;

    const userGymsList: Gym[] = (ctx?.userGyms ?? []).map((u) => u.gym);
    let detectionGyms: Gym[] = [...userGymsList, ...loadCachedDiscovery()];

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          setPermission(p.state);
          p.onchange = () => setPermission(p.state);
        })
        .catch(() => { });
    }

    const onPosition = async (pos: GeolocationPosition) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (!discoveryDoneRef.current) {
        discoveryDoneRef.current = true;
        try {
          const { gyms } = await findNearbyFn({ data: { lat: here.lat, lng: here.lng } });
          if (gyms.length) {
            saveCachedDiscovery(gyms);
            const seen = new Set(detectionGyms.map((g) => g.id));
            detectionGyms = [...detectionGyms, ...gyms.filter((g) => !seen.has(g.id))];
          }
        } catch (e) {
          console.warn("gym discovery failed:", (e as Error).message);
        }
      }

      if (currentVisitIdRef.current) {
        const now = Date.now();
        const visitGym = ctx?.openVisit?.gym;
        if (visitGym) {
          const distance = haversine(here, { lat: visitGym.lat, lng: visitGym.lng });
          if (distance > LEAVE_RADIUS_M) {
            if (outsideSinceRef.current == null) outsideSinceRef.current = now;
            else if (now - outsideSinceRef.current >= LEAVE_CONFIRM_MS) {
              try {
                await leaveFn({ data: { visitId: currentVisitIdRef.current } });
                outsideSinceRef.current = null;
                currentVisitIdRef.current = null;
                queryClient.invalidateQueries({ queryKey: ["gym-context"] });
              } catch (e) { console.warn("leaveGym failed:", (e as Error).message); }
              return;
            }
          } else {
            outsideSinceRef.current = null;
          }
        }
        if (now - lastKeepAliveRef.current >= KEEPALIVE_INTERVAL_MS) {
          lastKeepAliveRef.current = now;
          try {
            await keepAliveFn({ data: { visitId: currentVisitIdRef.current, lat: here.lat, lng: here.lng } });
          } catch (e) { console.warn("keepAlive failed:", (e as Error).message); }
        }
        return;
      }

      let nearest: { gym: Gym; distance: number } | null = null;
      for (const g of detectionGyms) {
        const d = haversine(here, { lat: g.lat, lng: g.lng });
        if (d <= ENTER_RADIUS_M && (!nearest || d < nearest.distance)) {
          nearest = { gym: g, distance: d };
        }
      }

      if (!nearest) {
        consecutiveInsideRef.current = { gymId: null, count: 0 };
        return;
      }

      const tracker = consecutiveInsideRef.current;
      if (tracker.gymId === nearest.gym.id) tracker.count += 1;
      else consecutiveInsideRef.current = { gymId: nearest.gym.id, count: 1 };

      if (consecutiveInsideRef.current.count >= ENTER_CONFIRM_FIXES && !enteringRef.current) {
        enteringRef.current = true;
        try {
          const result = await enterFn({
            data: { gymId: nearest.gym.id, lat: here.lat, lng: here.lng, source: "geofence" },
          });
          if (!result.alreadyOpen && result.message) {
            const evt: EntryEvent = {
              title: result.message.title,
              body: result.message.body,
              gymName: result.gymName,
              streakDays: result.streakDays ?? 0,
            };
            if (listener) listener(evt);
            // Fire a system notification so the user sees it even if the tab is backgrounded.
            void showGymEntryNotification(evt);
          }
          currentVisitIdRef.current = result.visitId;
          queryClient.invalidateQueries({ queryKey: ["gym-context"] });
        } catch (e) {
          console.warn("enterGym failed:", (e as Error).message);
        } finally {
          enteringRef.current = false;
        }
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setPermission("denied");
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 30_000,
    });

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, ctx?.userGyms.length, ctx?.openVisit?.id]);

  return { permission };
}
