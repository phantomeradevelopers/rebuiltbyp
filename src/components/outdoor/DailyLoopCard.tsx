import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Footprints, RefreshCw, Loader2, MapPin, Activity, Navigation, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getDailyLoop,
  regenerateLoop,
  setOutdoorActivity,
  type DailyLoopResult,
  type OriginKind,
} from "@/lib/outdoor.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, formatDuration, walkETA, jogETA } from "@/lib/outdoor-format";
import { LoopMap } from "./LoopMap";
import { SetAnchorLocation } from "./SetAnchorLocation";
import { TurnByTurn } from "./TurnByTurn";
import { DestinationStrip } from "./DestinationStrip";

type Props = { variant?: "compact" | "full"; origin?: OriginKind };
type Activity = "walk" | "jog";

export function DailyLoopCard({ variant = "compact", origin = "home" }: Props) {
  const [data, setData] = useState<DailyLoopResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<Activity>("walk");
  const fetchLoop = useServerFn(getDailyLoop);
  const reset = useServerFn(regenerateLoop);
  const saveActivity = useServerFn(setOutdoorActivity);

  async function load() {
    setLoading(true);
    try {
      const r = await fetchLoop({ data: { origin } });
      setData(r);
      // Hydrate activity from profile.
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { data: p } = await supabase
            .from("user_profile")
            .select("outdoor_activity")
            .eq("user_id", u.user.id)
            .maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (p as any)?.outdoor_activity;
          if (a === "walk" || a === "jog") setActivity(a);
        }
      } catch { /* noop */ }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  // Hooks below MUST run on every render — keep above all early returns.
  const isApple = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  }, []);
  const navUrl = useMemo(() => {
    const o = data?.origin;
    if (!o) return "#";
    const wps = data?.chosen?.waypoints ?? [];
    // Loop back to origin so the route returns home, not strands them at a midpoint.
    const stops: { lat: number; lng: number }[] = wps.length > 0 ? [...wps, o] : [o];
    const dest = stops[stops.length - 1];
    const middle = stops.slice(0, -1);
    if (isApple) {
      const daddr = middle.length > 0
        ? `${middle.map((w) => `${w.lat},${w.lng}`).join(" to:")} to:${dest.lat},${dest.lng}`
        : `${dest.lat},${dest.lng}`;
      return `https://maps.apple.com/?saddr=${o.lat},${o.lng}&daddr=${encodeURIComponent(daddr)}&dirflg=w`;
    }
    const wpParam = middle.length > 0
      ? `&waypoints=${encodeURIComponent(middle.map((w) => `${w.lat},${w.lng}`).join("|"))}`
      : "";
    return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${dest.lat},${dest.lng}${wpParam}&travelmode=walking`;
  }, [data?.origin, data?.chosen?.waypoints, isApple]);
  const navLabel = isApple ? "Open in Apple Maps" : "Open in Google Maps";

  async function swap() {
    if (!data?.chosen) return;
    setBusy(true);
    try {
      await reset({
        data: {
          targetMeters: data.chosen.distance_m + Math.round((Math.random() - 0.5) * 800),
          origin,
        },
      });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tryShorter() {
    if (!data?.chosen) return;
    setBusy(true);
    try {
      const shorter = Math.max(800, Math.round(data.chosen.distance_m * 0.7));
      await reset({ data: { targetMeters: shorter, origin } });
      await load();
      toast.success("Easier loop ready.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pickActivity(a: Activity) {
    if (a === activity) return;
    setActivity(a);
    try {
      await saveActivity({ data: { activity: a } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="card-elevated p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Mapping your loop…
      </div>
    );
  }

  if (origin === "home" && !data?.hasHome) {
    return <SetAnchorLocation kind="home" onDone={load} />;
  }
  if (origin === "work" && !data?.hasWork) {
    return <SetAnchorLocation kind="work" onDone={load} />;
  }

  if (!data?.chosen || !data.origin) {
    return (
      <div className="card-elevated p-5 text-sm text-muted-foreground">
        Couldn't build a loop today.{" "}
        <button onClick={load} className="text-gold underline">Try again</button>
      </div>
    );
  }

  const loop = data.chosen;
  const distance = formatDistance(loop.distance_m, data.unit);
  const walk = formatDuration(walkETA(loop.distance_m));
  const jog = formatDuration(jogETA(loop.distance_m));
  const fromLabel = origin === "work" ? (data.workLabel ?? "work") : "your door";

  if (variant === "compact") {
    return (
      <Link
        to="/app/outdoor"
        className="card-elevated p-4 block hover:border-gold transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <Footprints className="h-4 w-4 text-gold" />
          <p className="label-mono text-gold">Step outside</p>
        </div>
        <p className="font-display text-lg leading-tight">
          {distance} loop. Right out your door.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Same loop, same door — repeat it 'til it's automatic.
        </p>
        <p className="text-xs text-muted-foreground/80 mt-0.5">
          ~{walk} walk · ~{jog} jog
        </p>
        <div className="mt-3 -mx-1 overflow-hidden rounded-lg">
          <LoopMap
            origin={data.origin}
            polyline={loop.polyline}
            className="w-full h-28"
            interactive={false}
          />
        </div>
      </Link>
    );
  }

  const destName = loop.destination_name;
  const destPoint = loop.waypoints?.[0] ?? null;
  const eta = activity === "jog" ? jog : walk;
  const hasShorter = (data.alternates ?? []).some((a) => a.distance_m < loop.distance_m * 0.9);
  const firstStep = loop.steps?.[0] ?? null;

  // navUrl / navLabel are computed above the early returns to keep hook order stable.

  return (
    <div className="card-elevated p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-gold" />
          <p className="label-mono text-gold">Today's loop {origin === "work" ? "· from work" : ""}</p>
        </div>
        <button
          onClick={swap}
          disabled={busy}
          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-gold transition-colors"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Swap loop
        </button>
      </div>

      {/* Walk / Jog toggle */}
      <div className="inline-flex rounded-full border border-border p-0.5">
        {(["walk", "jog"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => pickActivity(a)}
            className={`h-8 px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              activity === a ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a === "walk" ? <Footprints className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
            {a === "walk" ? "Walk" : "Jog"}
          </button>
        ))}
      </div>

      <div>
        <p className="font-display text-2xl leading-tight">
          {destName ? `${distance} ${activity} to ${destName}` : `${distance} ${activity} from ${fromLabel}`}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          ~{eta} {activity === "jog" ? "jogging" : "walking"} · starts and ends at {fromLabel}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl">
        <LoopMap origin={data.origin} polyline={loop.polyline} className="w-full h-64" />
      </div>

      {/* First step — answers "which way do I go?" without expanding anything */}
      {firstStep && (
        <div className="rounded-lg border border-gold/40 bg-gold/5 p-3 flex items-start gap-3">
          <span className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-full bg-gold text-gold-foreground text-xs font-bold">
            1
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] label-mono text-gold tracking-wide">START HERE</p>
            <p className="text-sm leading-snug mt-0.5">{firstStep.instruction}</p>
          </div>
        </div>
      )}

      {/* Primary CTA: hand off to native maps for live nav */}
      <a
        href={navUrl}
        target="_blank"
        rel="noreferrer"
        className="w-full h-12 rounded-md bg-gold text-gold-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Navigation className="h-4 w-4" /> {navLabel}
        <ArrowUpRight className="h-4 w-4" />
      </a>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />{" "}
        {destName ? `Walks to ${destName} and back to ${fromLabel}.` : `Familiar route — repeat it 'til it's automatic.`}
      </div>

      <TurnByTurn
        steps={loop.steps}
        unit={data.unit}
        origin={data.origin}
        destination={destPoint}
      />


      {hasShorter && (
        <button
          type="button"
          onClick={tryShorter}
          disabled={busy}
          className="w-full text-left text-xs text-gold hover:underline"
        >
          Know an easier one? Tap to try a shorter loop →
        </button>
      )}

      <DestinationStrip origin={origin} unit={data.unit} onPicked={load} />
    </div>
  );
}
