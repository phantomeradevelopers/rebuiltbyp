import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Flame, Clock, LogOut } from "lucide-react";
import { getGymContext, enterGym, leaveGym } from "@/lib/gyms.functions";
import { onGymEntry } from "@/hooks/useGymGeofence";

export function GymStatusCard() {
  const fetchCtx = useServerFn(getGymContext);
  const enterFn = useServerFn(enterGym);
  const leaveFn = useServerFn(leaveGym);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["gym-context"],
    queryFn: () => fetchCtx(),
    staleTime: 30_000,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!data?.openVisit) return;
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, [data?.openVisit]);

  // Re-fetch on entry event (in case geofence fired)
  useEffect(() => onGymEntry(() => { qc.invalidateQueries({ queryKey: ["gym-context"] }); }), [qc]);

  if (isLoading || !data) return null;

  const primary = data.userGyms.find((g) => g.is_primary) ?? data.userGyms[0] ?? null;
  const open = data.openVisit;

  async function handleCheckIn() {
    if (!primary) {
      toast.error("Add a gym first in Settings → Gyms.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Location not available on this device.");
      return;
    }
    toast.loading("Checking in…", { id: "gym-checkin" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await enterFn({
            data: {
              gymId: primary.gym.id,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              source: "manual",
            },
          });
          toast.dismiss("gym-checkin");
          if (result.alreadyOpen) toast.success("Already checked in.");
          else toast.success(result.message?.title ?? "You're in.");
          qc.invalidateQueries({ queryKey: ["gym-context"] });
        } catch (e) {
          toast.dismiss("gym-checkin");
          toast.error((e as Error).message);
        }
      },
      async () => {
        // No location — check in without coords
        try {
          const result = await enterFn({
            data: { gymId: primary.gym.id, lat: primary.gym.lat, lng: primary.gym.lng, source: "manual" },
          });
          toast.dismiss("gym-checkin");
          if (result.alreadyOpen) toast.success("Already checked in.");
          else toast.success(result.message?.title ?? "You're in.");
          qc.invalidateQueries({ queryKey: ["gym-context"] });
        } catch (e) {
          toast.dismiss("gym-checkin");
          toast.error((e as Error).message);
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 },
    );
  }

  async function handleLeave() {
    if (!open) return;
    try {
      const r = await leaveFn({ data: { visitId: open.id } });
      toast.success(`Logged · ${r.minutesIn} min`);
      qc.invalidateQueries({ queryKey: ["gym-context"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  if (open) {
    const minsIn = Math.max(0, Math.floor((Date.now() - new Date(open.entered_at).getTime()) / 60000));
    void tick; // re-render trigger
    const nextTier = minsIn < 30 ? 30 : minsIn < 60 ? 60 : null;
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 label-mono text-xs text-gold">
              <Flame className="h-3 w-3" /> Checked in
            </div>
            <p className="font-display text-lg leading-tight mt-1 truncate">
              {open.gym?.name ?? "At the gym"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {minsIn} min in
              {nextTier && <span className="text-muted-foreground/70">· next milestone {nextTier}</span>}
            </p>
          </div>
          <button
            onClick={handleLeave}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs label-mono flex items-center gap-1 shrink-0"
          >
            <LogOut className="h-3 w-3" /> Leave
          </button>
        </div>
      </div>
    );
  }

  if (!primary) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 label-mono text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> Your gym
            {data.streakDays > 0 && <span className="text-gold">· {data.streakDays}-day streak</span>}
          </div>
          <p className="font-display text-lg leading-tight mt-1 truncate">{primary.gym.name}</p>
        </div>
        <button
          onClick={handleCheckIn}
          className="rounded-md bg-gold text-gold-foreground px-3 py-2 text-xs font-medium shrink-0"
        >
          I'm here
        </button>
      </div>
    </div>
  );
}
