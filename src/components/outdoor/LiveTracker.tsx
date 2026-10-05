import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Pause, Square, Loader2, MapPin, Home } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { finishOutdoorSession } from "@/lib/outdoor.functions";
import { celebrateTask } from "@/lib/celebrate";
import {
  formatDistance,
  formatDuration,
  haversineMeters,
  type Unit,
} from "@/lib/outdoor-format";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Sample = { lat: number; lng: number; t: number; acc?: number };

type Props = {
  routeId: string | null;
  unit: Unit;
  origin: { lat: number; lng: number };
  loopDistanceM: number;
  /** Encoded polyline for the planned loop (so we can render it behind the live track). */
  plannedPolyline?: string;
};

function paceLabel(secPerKm: number | null, unit: Unit): string {
  if (!secPerKm || !isFinite(secPerKm)) return "—";
  const per = unit === "imperial" ? secPerKm * 1.60934 : secPerKm;
  const m = Math.floor(per / 60);
  const s = Math.round(per % 60).toString().padStart(2, "0");
  return `${m}:${s} / ${unit === "imperial" ? "mi" : "km"}`;
}

export function LiveTracker({ routeId, unit, origin, loopDistanceM, plannedPolyline }: Props) {
  const [state, setState] = useState<"idle" | "running" | "paused" | "saving">("idle");
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [permError, setPermError] = useState<string | null>(null);
  const [distFromOrigin, setDistFromOrigin] = useState<number | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const pausedAccumRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSampleRef = useRef<Sample | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const lastDownsampleRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  const leftHomeRef = useRef(false);
  const autoFinishedRef = useRef(false);

  // Map refs (mirrors LoopMap but lives in this component so we can draw the
  // planned route + live polyline + pulsing dot together).
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const liveLineRef = useRef<any>(null);
  const liveMarkerRef = useRef<any>(null);
  const plannedLineRef = useRef<any>(null);

  // Mount map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g: any) => {
        if (cancelled || !mapContainerRef.current) return;
        mapRef.current = new g.maps.Map(mapContainerRef.current, {
          center: origin,
          zoom: 15,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1f2024" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1f2024" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2c31" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#11151c" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1b2a1f" }] },
          ],
        });
        if (plannedPolyline) {
          const path = g.maps.geometry.encoding.decodePath(plannedPolyline);
          plannedLineRef.current = new g.maps.Polyline({
            path,
            strokeColor: "#d4af37",
            strokeOpacity: 0.35,
            strokeWeight: 4,
            map: mapRef.current,
          });
          const b = new g.maps.LatLngBounds();
          path.forEach((p: any) => b.extend(p));
          mapRef.current.fitBounds(b, { top: 32, right: 32, bottom: 32, left: 32 });
          g.maps.event.addListenerOnce(mapRef.current, "idle", () => {
            const z = mapRef.current.getZoom?.() ?? 15;
            if (z > 17) mapRef.current.setZoom(17);
          });
        }
        liveLineRef.current = new g.maps.Polyline({
          path: [],
          strokeColor: "#ffd966",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map: mapRef.current,
        });
        liveMarkerRef.current = new g.maps.Marker({
          position: origin,
          map: mapRef.current,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#ffd966",
            fillOpacity: 1,
            strokeColor: "#1f2024",
            strokeWeight: 3,
          },
        });
      })
      .catch((e: unknown) => console.error("Map load failed", e));
    return () => {
      cancelled = true;
    };
  }, [origin, plannedPolyline]);

  // Elapsed clock
  useEffect(() => {
    if (state !== "running") return;
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        const total = Date.now() - startedAtRef.current - pausedAccumRef.current;
        setElapsed(Math.max(0, Math.round(total / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  async function requestWakeLock() {
    try {
      const n = navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } };
      if (n.wakeLock?.request) {
        wakeLockRef.current = await n.wakeLock.request("screen");
      }
    } catch {
      /* ignore */
    }
  }
  function releaseWakeLock() {
    try {
      wakeLockRef.current?.release?.();
    } catch {
      /* ignore */
    }
    wakeLockRef.current = null;
  }

  function stopWatch() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function start() {
    if (!("geolocation" in navigator)) {
      setPermError("Location isn't available in this browser.");
      return;
    }
    setPermError(null);
    setDistance(0);
    setElapsed(0);
    setDistFromOrigin(null);
    samplesRef.current = [];
    lastSampleRef.current = null;
    lastDownsampleRef.current = 0;
    pausedAccumRef.current = 0;
    pauseStartRef.current = null;
    startedAtRef.current = Date.now();
    leftHomeRef.current = false;
    autoFinishedRef.current = false;
    setState("running");
    requestWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => onPosition(pos),
      (err) => {
        setPermError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Enable it in your browser to track."
            : "Couldn't read your location. Try again.",
        );
        setState("idle");
        stopWatch();
        releaseWakeLock();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  function pause() {
    if (state !== "running") return;
    pauseStartRef.current = Date.now();
    setState("paused");
    stopWatch();
  }
  function resume() {
    if (state !== "paused") return;
    if (pauseStartRef.current) {
      pausedAccumRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    lastSampleRef.current = null; // avoid bogus jump
    setState("running");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => onPosition(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  function onPosition(pos: GeolocationPosition) {
    const sample: Sample = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: Date.now(),
      acc: pos.coords.accuracy,
    };
    // Filter low-accuracy fixes
    if (sample.acc != null && sample.acc > 25) return;

    const last = lastSampleRef.current;
    if (last) {
      const dM = haversineMeters(last, sample);
      const dT = (sample.t - last.t) / 1000;
      // Reject implausible jumps (>50 m/s ≈ 180 km/h)
      if (dT > 0 && dM / dT > 50) return;
      if (dM >= 3) {
        setDistance((d) => d + dM);
        if (liveLineRef.current) {
          const path = liveLineRef.current.getPath();
          path.push(new (window as any).google.maps.LatLng(sample.lat, sample.lng));
        }
      }
    } else if (liveLineRef.current) {
      liveLineRef.current.getPath().push(
        new (window as any).google.maps.LatLng(sample.lat, sample.lng),
      );
    }

    lastSampleRef.current = sample;
    if (liveMarkerRef.current) {
      liveMarkerRef.current.setPosition({ lat: sample.lat, lng: sample.lng });
    }
    if (mapRef.current) {
      mapRef.current.panTo({ lat: sample.lat, lng: sample.lng });
    }

    // Downsample track to ~1 point / 3s for upload
    if (sample.t - lastDownsampleRef.current >= 3000) {
      samplesRef.current.push({ lat: sample.lat, lng: sample.lng, t: sample.t });
      lastDownsampleRef.current = sample.t;
    }

    // Geofence: detect return to origin to auto-finish.
    const dFromOrigin = haversineMeters(origin, { lat: sample.lat, lng: sample.lng });
    setDistFromOrigin(dFromOrigin);
    if (!leftHomeRef.current && dFromOrigin > 200) leftHomeRef.current = true;
    if (leftHomeRef.current && !autoFinishedRef.current && dFromOrigin < 40) {
      autoFinishedRef.current = true;
      toast.success("Looks like you're home — finishing your walk.");
      void finish();
    }
  }

  const saveFn = useServerFn(finishOutdoorSession);
  async function finish() {
    if (state === "idle") return;
    stopWatch();
    releaseWakeLock();
    setState("saving");
    const endedAt = new Date().toISOString();
    const startedAt = new Date(startedAtRef.current ?? Date.now()).toISOString();
    const durSec = Math.round(((Date.now() - (startedAtRef.current ?? Date.now())) - pausedAccumRef.current) / 1000);
    try {
      await saveFn({
        data: {
          route_id: routeId,
          started_at: startedAt,
          ended_at: endedAt,
          distance_meters: Math.round(distance),
          duration_seconds: Math.max(0, durSec),
          track: samplesRef.current.map((s) => ({ lat: s.lat, lng: s.lng, t: s.t })),
        },
      });
      toast.success(`Logged ${formatDistance(distance, unit)} in ${formatDuration(durSec)}.`);
      // Knock-off feedback. We don't know exact remaining-tasks-count here
      // (lives on the home page), so estimate generously: 3 more to go after
      // a walk is the typical mid-day state.
      celebrateTask(3, 6, "Walk");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setState("idle");
      // keep distance/elapsed visible until next start
    }
  }

  useEffect(() => () => {
    stopWatch();
    releaseWakeLock();
  }, []);

  const pace =
    distance > 50 && elapsed > 5
      ? Math.round((elapsed / distance) * 1000)
      : null;
  const pct = loopDistanceM > 0 ? Math.min(100, Math.round((distance / loopDistanceM) * 100)) : 0;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-gold" />
        <p className="label-mono text-gold">Live tracking</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Distance" value={formatDistance(distance, unit)} />
        <Stat label="Time" value={formatDuration(elapsed)} />
        <Stat label="Pace" value={paceLabel(pace, unit)} />
      </div>

      <div className="overflow-hidden rounded-xl mb-3">
        <div ref={mapContainerRef} className="w-full h-56 bg-muted" />
      </div>

      {loopDistanceM > 0 && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground label-mono">
            {pct}% of today's loop
          </p>
        </div>
      )}

      {state !== "idle" && distFromOrigin != null && (
        <p className="mb-3 text-xs text-muted-foreground label-mono inline-flex items-center gap-1.5">
          <Home className="h-3 w-3 text-gold" />
          ~{Math.round(distFromOrigin)} m from start
          {leftHomeRef.current ? " · auto-finish when you're back" : ""}
        </p>
      )}

      {permError && (
        <p className="text-xs text-rose-300 mb-3">{permError}</p>
      )}

      <div className="flex gap-2">
        {state === "idle" && (
          <button
            onClick={start}
            className="btn-gold flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm"
          >
            <Play className="h-4 w-4" /> Start tracking
          </button>
        )}
        {state === "running" && (
          <>
            <button
              onClick={pause}
              className="flex-1 h-11 rounded-full border border-border text-sm inline-flex items-center justify-center gap-2 hover:border-gold transition-colors"
            >
              <Pause className="h-4 w-4" /> Pause
            </button>
            <button
              onClick={finish}
              className="flex-1 h-11 rounded-full border border-gold/60 text-gold text-sm inline-flex items-center justify-center gap-2"
            >
              <Square className="h-4 w-4" /> Finish
            </button>
          </>
        )}
        {state === "paused" && (
          <>
            <button
              onClick={resume}
              className="btn-gold flex-1 h-11 rounded-full inline-flex items-center justify-center gap-2 text-sm"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
            <button
              onClick={finish}
              className="flex-1 h-11 rounded-full border border-gold/60 text-gold text-sm inline-flex items-center justify-center gap-2"
            >
              <Square className="h-4 w-4" /> Finish
            </button>
          </>
        )}
        {state === "saving" && (
          <button
            disabled
            className="flex-1 h-11 rounded-full border border-border text-sm inline-flex items-center justify-center gap-2 text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-2 text-center">
      <p className="font-display text-base leading-tight text-gold-shimmer">{value}</p>
      <p className="label-mono mt-0.5 text-[11px]">{label}</p>
    </div>
  );
}
