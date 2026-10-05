import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Mountain, Star, Bookmark, BookmarkCheck, ExternalLink, Loader2, Home, Briefcase, Dog, Plus, MapPin } from "lucide-react";
import { DailyLoopCard } from "@/components/outdoor/DailyLoopCard";
import { AskCoachFooter } from "@/components/AskCoachFooter";
import { LiveTracker } from "@/components/outdoor/LiveTracker";
import { SetAnchorLocation } from "@/components/outdoor/SetAnchorLocation";
import { TreadmillCard } from "@/components/outdoor/TreadmillCard";
import {
  getNearbyHikes,
  getDailyLoop,
  regenerateLoop,
  setUnitSystem,
  setOutdoorPrefs,
  saveHike,
  unsaveHike,
  type NearbyHike,
  type DailyLoopResult,
  type OriginKind,
} from "@/lib/outdoor.functions";
import { type Unit } from "@/lib/outdoor-format";
import { getCardioPrescription } from "@/lib/cardio";
import { supabase } from "@/integrations/supabase/client";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/app/outdoor")({
  head: () => ({ meta: [{ title: "Outdoor — REBUILT" },{ name: "description", content: "Log hikes, walks, and outdoor sessions." },{ property: "og:title", content: "Outdoor — REBUILT" },{ property: "og:description", content: "Log hikes, walks, and outdoor sessions." },] }),
  component: Outdoor,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
});

type Difficulty = "easy" | "moderate" | "hard";
type Shape = "loop" | "out_back" | "destination";

const IMPERIAL_STEPS_MI = [1, 2, 3, 5, 8, 10];
const METRIC_STEPS_KM = [2, 3, 5, 8, 13, 16];

const DIFFICULTY_METERS: Record<Difficulty, number> = {
  easy: 1609,
  moderate: 3219,
  hard: 4828,
};

const DIFFICULTIES: Array<{ key: Difficulty; label: string; sub: string }> = [
  { key: "easy", label: "Easy", sub: "~1 mi" },
  { key: "moderate", label: "Moderate", sub: "~2 mi" },
  { key: "hard", label: "Hard", sub: "~3 mi" },
];

function Outdoor() {
  const [hikes, setHikes] = useState<NearbyHike[] | null>(null);
  const [loadingHikes, setLoadingHikes] = useState(false);
  const [loop, setLoop] = useState<DailyLoopResult | null>(null);
  const [unit, setUnit] = useState<Unit>("imperial");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [shape, setShape] = useState<Shape>("loop");
  const [origin, setOrigin] = useState<OriginKind>("home");
  const [busyUnit, setBusyUnit] = useState(false);
  const [busyDist, setBusyDist] = useState(false);
  const [showAddWork, setShowAddWork] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [dogFilter, setDogFilter] = useState<boolean | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(null);
  const [showTreadmill, setShowTreadmill] = useState(true);
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingLive, setLocatingLive] = useState(false);

  const fetchHikes = useServerFn(getNearbyHikes);
  const fetchLoop = useServerFn(getDailyLoop);
  const regen = useServerFn(regenerateLoop);
  const saveUnit = useServerFn(setUnitSystem);
  const savePrefs = useServerFn(setOutdoorPrefs);
  const save = useServerFn(saveHike);
  const unsave = useServerFn(unsaveHike);

  // Pull session minutes once for the treadmill prescription.
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("user_profile")
        .select("session_minutes")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (p?.session_minutes) setSessionMinutes(Number(p.session_minutes));
    })();
  }, []);

  async function loadAll(nextOrigin: OriginKind = origin) {
    setLoadingHikes(true);
    try {
      const wantsDog = dogFilter ?? undefined;
      const liveBits =
        useLiveLocation && liveCoords ? { fromLat: liveCoords.lat, fromLng: liveCoords.lng } : {};
      const [l, h] = await Promise.all([
        fetchLoop({ data: { origin: nextOrigin } }),
        fetchHikes({ data: { origin: nextOrigin, ...(wantsDog !== undefined ? { dogFriendly: wantsDog } : {}), ...liveBits } }),
      ]);
      setLoop(l);
      setUnit(l.unit);
      setHikes(h.hikes);
      // First-time defaults: brand-new user lands on Home + Destination + Easy.
      // "Walk to a place" is the most concrete, repeatable starter — beats an
      // abstract loop every time.
      const savedDiff = l.prefs?.outdoor_difficulty ?? null;
      const savedShape = l.prefs?.outdoor_loop_shape ?? null;
      if (savedDiff) {
        setDifficulty(savedDiff);
      } else {
        setDifficulty("easy");
      }
      setShape(savedShape ?? "destination");
      if (!savedDiff || !savedShape) {
        try {
          await savePrefs({ data: { difficulty: savedDiff ?? "easy", shape: savedShape ?? "destination" } });
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingHikes(false);
    }
  }

  useEffect(() => {
    loadAll(origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, dogFilter, useLiveLocation, liveCoords?.lat, liveCoords?.lng]);

  async function toggleLiveLocation() {
    if (useLiveLocation) {
      setUseLiveLocation(false);
      setLiveCoords(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Live location isn't available on this device.");
      return;
    }
    setLocatingLive(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }),
      );
      setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setUseLiveLocation(true);
    } catch {
      toast.error("Couldn't get your location. Check browser permissions.");
    } finally {
      setLocatingLive(false);
    }
  }

  async function toggleUnit() {
    const next: Unit = unit === "imperial" ? "metric" : "imperial";
    setUnit(next);
    setBusyUnit(true);
    try {
      await saveUnit({ data: { unit: next } });
    } catch (e) {
      toast.error((e as Error).message);
      setUnit(unit);
    } finally {
      setBusyUnit(false);
    }
  }

  async function pickDistance(meters: number) {
    setBusyDist(true);
    try {
      await regen({ data: { targetMeters: meters, shape, origin } });
      const l = await fetchLoop({ data: { targetMeters: meters, shape, origin } });
      setLoop(l);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyDist(false);
    }
  }

  async function pickDifficulty(d: Difficulty) {
    setDifficulty(d);
    setBusyDist(true);
    try {
      await savePrefs({ data: { difficulty: d } });
      const meters = DIFFICULTY_METERS[d];
      await regen({ data: { targetMeters: meters, shape, origin } });
      const l = await fetchLoop({ data: { targetMeters: meters, shape, origin } });
      setLoop(l);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyDist(false);
    }
  }

  async function pickShape(s: Shape) {
    setShape(s);
    setBusyDist(true);
    try {
      await savePrefs({ data: { shape: s } });
      const meters = loop?.chosen?.distance_m ?? (difficulty ? DIFFICULTY_METERS[difficulty] : 1609);
      await regen({ data: { targetMeters: meters, shape: s, origin } });
      const l = await fetchLoop({ data: { targetMeters: meters, shape: s, origin } });
      setLoop(l);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyDist(false);
    }
  }

  async function toggleSave(h: NearbyHike) {
    try {
      if (h.saved) {
        await unsave({ data: { place_id: h.place_id } });
      } else {
        await save({
          data: {
            place_id: h.place_id,
            name: h.name,
            snapshot: { lat: h.lat, lng: h.lng, rating: h.rating },
          },
        });
      }
      setHikes((prev) =>
        prev?.map((x) => (x.place_id === h.place_id ? { ...x, saved: !h.saved } : x)) ?? prev,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const distanceSteps =
    unit === "imperial"
      ? IMPERIAL_STEPS_MI.map((mi) => ({ label: `${mi} mi`, meters: Math.round(mi * 1609.34) }))
      : METRIC_STEPS_KM.map((km) => ({ label: `${km} km`, meters: km * 1000 }));

  const prefs = loop?.prefs;
  const cardioPref = prefs?.cardio_preference ?? "outdoor";
  const naturePref = prefs?.nature_preference ?? "neutral";
  const hasDog = !!prefs?.has_dog;

  const cardioPlan = useMemo(
    () =>
      prefs
        ? getCardioPrescription(prefs, sessionMinutes)
        : null,
    [prefs, sessionMinutes],
  );

  const showTreadmillCard =
    cardioPref !== "outdoor" && cardioPref !== "none" && showTreadmill && !!cardioPlan;

  // Section ordering by nature preference
  const order: ("treadmill" | "loop" | "hikes")[] = (() => {
    if (cardioPref === "none") return ["hikes"];
    if (cardioPref === "treadmill") return ["treadmill", "loop", "hikes"];
    if (naturePref === "loves_nature") return ["hikes", "loop", "treadmill"];
    if (naturePref === "prefers_urban") return ["treadmill", "loop", "hikes"];
    return ["loop", "treadmill", "hikes"];
  })();

  return (
    <div className="min-h-dvh pt-safe pb-32">
      <header className="px-6 pt-6 pb-3 flex items-center justify-between">
        <Link to="/app" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button
          onClick={toggleUnit}
          disabled={busyUnit}
          className="text-xs label-mono px-3 h-8 rounded-full border border-border hover:border-gold transition-colors"
        >
          {unit === "imperial" ? "mi" : "km"} · switch
        </button>
      </header>
      <div className="px-6 mb-4">
        <p className="label-mono text-gold">Outdoor</p>
        <h1 className="font-display text-3xl">Step outside</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A daily loop from your door. Hikes for the weekend warrior in you.
        </p>
      </div>

      <div className="px-4 space-y-6 max-w-md mx-auto">

        {/* Cardio-off banner */}
        {cardioPref === "none" && (
          <div className="card-elevated p-4 text-sm text-muted-foreground">
            Outdoor cardio is optional — your plan covers everything you need without it.
            Browse hikes below if you ever want to step out.
          </div>
        )}

        {/* Start-from toggle */}
        {cardioPref !== "none" && (loop?.hasHome || loop?.hasWork) && (
          <div className="card-elevated p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="label-mono text-gold text-xs">Start from</p>
              <button
                onClick={() => {
                  setEditingAddress((v) => !v);
                  setShowAddWork(false);
                }}
                className="text-xs text-muted-foreground hover:text-gold"
              >
                {editingAddress ? "Close" : `Change ${origin === "work" ? "workplace" : "home"} address`}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setOrigin("home")}
                className={`h-11 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                  origin === "home" ? "border-gold text-gold bg-gold/10" : "border-border hover:border-gold/60"
                }`}
              >
                <Home className="h-4 w-4" /> Home
              </button>
              {loop?.hasWork ? (
                <button
                  onClick={() => setOrigin("work")}
                  className={`h-11 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                    origin === "work" ? "border-gold text-gold bg-gold/10" : "border-border hover:border-gold/60"
                  }`}
                >
                  <Briefcase className="h-4 w-4" /> Work
                </button>
              ) : (
                <button
                  onClick={() => setShowAddWork((s) => !s)}
                  className="h-11 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-gold hover:text-gold flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Add workplace
                </button>
              )}
            </div>
            {editingAddress && (
              <div className="mt-3">
                <SetAnchorLocation
                  kind={origin}
                  compact
                  onDone={() => {
                    setEditingAddress(false);
                    toast.success("Address updated.");
                    loadAll(origin);
                  }}
                />
              </div>
            )}
            {showAddWork && !editingAddress && (
              <div className="mt-3">
                <SetAnchorLocation
                  kind="work"
                  compact
                  onDone={() => {
                    setShowAddWork(false);
                    setOrigin("work");
                    loadAll("work");
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Sections in priority order */}
        {order.map((section) => {
          if (section === "treadmill") {
            if (!showTreadmillCard || !cardioPlan) return null;
            return (
              <TreadmillCard
                key="treadmill"
                plan={cardioPlan}
                onSwitchOutside={cardioPref === "treadmill" ? undefined : () => setShowTreadmill(false)}
              />
            );
          }

          if (section === "loop") {
            if (cardioPref === "none") return null;
            return (
              <div key="loop" className="space-y-6">
                {/* Difficulty picker */}
                {((origin === "home" && loop?.hasHome) || (origin === "work" && loop?.hasWork)) && (
                  <div className="card-elevated p-4">
                    <p className="label-mono text-gold mb-2">
                      {difficulty ? "Difficulty" : "How hard do you want it?"}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DIFFICULTIES.map((d) => {
                        const active = difficulty === d.key;
                        return (
                          <button
                            key={d.key}
                            onClick={() => pickDifficulty(d.key)}
                            disabled={busyDist}
                            className={`h-14 rounded-xl border text-sm transition-colors flex flex-col items-center justify-center ${
                              active
                                ? "border-gold text-gold bg-gold/10"
                                : "border-border hover:border-gold/60"
                            }`}
                          >
                            <span className="font-display">{d.label}</span>
                            <span className="text-xs text-muted-foreground label-mono">{d.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Shape + distance picker */}
                {((origin === "home" && loop?.hasHome) || (origin === "work" && loop?.hasWork)) && (
                  <div className="card-elevated p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label-mono text-gold">Route shape</p>
                      {busyDist && <Loader2 className="h-3 w-3 animate-spin text-gold" />}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {([
                        { key: "destination", label: "Walk to a place", sub: "there & back to a spot" },
                        { key: "out_back", label: "There & back", sub: "straight out, turn around" },
                        { key: "loop", label: "Triangle loop", sub: "three legs, one door" },
                      ] as const).map((s) => {
                        const active = shape === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => pickShape(s.key)}
                            disabled={busyDist}
                            className={`relative h-16 rounded-xl border text-xs transition-colors flex flex-col items-center justify-center px-1 ${
                              active
                                ? "border-gold text-gold bg-gold/10"
                                : "border-border hover:border-gold/60"
                            }`}
                          >
                            {s.key === "destination" && (
                              <span className="absolute -top-1.5 right-1 text-[8px] px-1.5 py-0.5 rounded-full bg-gold text-gold-foreground label-mono leading-none">
                                Easiest
                              </span>
                            )}
                            <span className="font-display leading-tight text-center">{s.label}</span>
                            <span className="text-[11px] text-muted-foreground label-mono mt-0.5 text-center leading-tight">{s.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="label-mono text-gold mb-2">Distance</p>
                    <div className="flex flex-wrap gap-1.5">
                      {distanceSteps.map((s) => {
                        const active =
                          loop?.chosen && Math.abs(loop.chosen.distance_m - s.meters) < 500;
                        return (
                          <button
                            key={s.label}
                            onClick={() => pickDistance(s.meters)}
                            disabled={busyDist}
                            className={`px-3 h-8 rounded-full text-xs label-mono border transition-colors ${
                              active
                                ? "border-gold text-gold bg-gold/10"
                                : "border-border hover:border-gold/60"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <DailyLoopCard variant="full" origin={origin} />

                {/* Live tracking */}
                {loop?.origin && loop.chosen && (
                  <LiveTracker
                    routeId={loop.chosen.id.startsWith("cand-") ? null : loop.chosen.id}
                    unit={unit}
                    origin={loop.origin}
                    loopDistanceM={loop.chosen.distance_m}
                    plannedPolyline={loop.chosen.polyline}
                  />
                )}
              </div>
            );
          }

          // section === "hikes"
          return (
            <section key="hikes">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-gold" />
                  <h2 className="label-mono text-gold">Hikes near you</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleLiveLocation}
                    disabled={locatingLive}
                    className={`text-xs label-mono px-2 h-6 rounded-full border flex items-center gap-1 transition-colors ${
                      useLiveLocation
                        ? "border-gold text-gold bg-gold/10"
                        : "border-border text-muted-foreground hover:border-gold/60"
                    }`}
                    title="Sort hikes by distance from where you are right now"
                  >
                    {locatingLive ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MapPin className="h-3 w-3" />
                    )}
                    {useLiveLocation ? "Live location" : "Use live location"}
                  </button>
                  {hasDog && (
                    <button
                      onClick={() => setDogFilter((v) => (v === true ? null : true))}
                      className={`text-xs label-mono px-2 h-6 rounded-full border flex items-center gap-1 transition-colors ${
                        dogFilter === true
                          ? "border-gold text-gold bg-gold/10"
                          : "border-border text-muted-foreground hover:border-gold/60"
                      }`}
                    >
                      <Dog className="h-3 w-3" /> Dog-friendly
                    </button>
                  )}
                </div>
              </div>
              {loadingHikes && (
                <div className="card-elevated p-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching trails…
                </div>
              )}
              {!loadingHikes && hikes && hikes.length === 0 && (
                <div className="card-elevated p-5 text-sm text-muted-foreground space-y-3">
                  <p>No trails found nearby. Try a different address or widen the search.</p>
                  <button
                    onClick={() => {
                      setEditingAddress(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-xs label-mono text-gold hover:underline"
                  >
                    Change {origin === "work" ? "workplace" : "home"} address →
                  </button>
                </div>
              )}
              {!loadingHikes && hikes && hikes.length > 0 && (
                <div className="space-y-2">
                  {hikes.map((h) => (
                    <div key={h.place_id} className="card-elevated p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base leading-tight truncate">{h.name}</p>
                          {h.formatted_address && (
                            <p className="text-xs text-muted-foreground truncate">{h.formatted_address}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {h.rating != null && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-gold text-gold" />
                                {h.rating.toFixed(1)}
                                {h.user_ratings_total ? ` (${h.user_ratings_total})` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleSave(h)}
                          className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:border-gold transition-colors shrink-0"
                          aria-label={h.saved ? "Unsave hike" : "Save hike"}
                        >
                          {h.saved ? (
                            <BookmarkCheck className="h-4 w-4 text-gold" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}&query_place_id=${h.place_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-gold hover:underline"
                      >
                        Open in Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        <AskCoachFooter prompt="Wrong route? Bad knees? Tell P." />
      </div>
    </div>
  );
}
