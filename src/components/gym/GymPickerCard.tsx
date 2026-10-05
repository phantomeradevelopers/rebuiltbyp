import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Search, CheckCircle2, Loader2, Dumbbell } from "lucide-react";
import {
  getGymContext,
  findNearbyGyms,
  searchGymsByText,
  addUserGym,
  type Gym,
} from "@/lib/gyms.functions";
import { SetAnchorLocation } from "@/components/outdoor/SetAnchorLocation";

export function GymPickerCard() {
  const fetchCtx = useServerFn(getGymContext);
  const findNearby = useServerFn(findNearbyGyms);
  const searchText = useServerFn(searchGymsByText);
  const addGym = useServerFn(addUserGym);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["gym-context"],
    queryFn: () => fetchCtx(),
    staleTime: 30_000,
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Gym[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const autoRanRef = useRef(false);

  // Auto-discover gyms as soon as we have a home/work location and no gym picked.
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!data) return;
    if (data.userGyms.length > 0) return;
    if (!data.hasLocation || !data.location) return;
    autoRanRef.current = true;
    setAutoLoading(true);
    findNearby({ data: { lat: data.location.lat, lng: data.location.lng } })
      .then((r) => { setResults(r.gyms); })
      .catch((e) => { console.warn("auto gym search failed", (e as Error).message); })
      .finally(() => setAutoLoading(false));
  }, [data, findNearby]);

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-xs label-mono text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Already has a gym
  if (data.userGyms.length > 0) {
    const primary = data.userGyms.find((g) => g.is_primary) ?? data.userGyms[0];
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
        <div className="flex items-center gap-2 label-mono text-xs text-gold">
          <CheckCircle2 className="h-3 w-3" /> Your gym is locked in
        </div>
        <p className="font-display text-lg leading-tight mt-1">{primary.gym.name}</p>
        {primary.gym.formatted_address && (
          <p className="text-xs text-muted-foreground mt-0.5">{primary.gym.formatted_address}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          When you walk in, we'll celebrate. Manage in More → Gyms.
        </p>
      </div>
    );
  }

  // No location yet — collect it
  if (!data.hasLocation) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 label-mono text-xs text-gold">
            <MapPin className="h-3 w-3" /> Find your gym
          </div>
          <p className="font-display text-lg leading-tight mt-1">Set your home address first.</p>
          <p className="text-xs text-muted-foreground mt-1">
            We'll surface every gym near you and celebrate when you walk in.
          </p>
        </div>
        <SetAnchorLocation kind="home" compact onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ["gym-context"] }); }} />
      </div>
    );
  }

  async function loadNearby() {
    if (!data?.location) return;
    setBusy(true);
    try {
      const r = await findNearby({ data: { lat: data.location.lat, lng: data.location.lng } });
      setResults(r.gyms);
      if (r.gyms.length === 0) toast.info("No gyms found nearby. Try search.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }


  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await searchText({
        data: {
          query: query.trim(),
          lat: data?.location?.lat,
          lng: data?.location?.lng,
        },
      });
      setResults(r.gyms);
      if (r.gyms.length === 0) toast.info("No matches.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function pick(gym: Gym) {
    setBusy(true);
    try {
      await addGym({ data: { gymId: gym.id, isPrimary: true } });
      toast.success("Locked in.");
      qc.invalidateQueries({ queryKey: ["gym-context"] });
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="flex items-center gap-1.5 label-mono text-xs text-gold">
          <Dumbbell className="h-3 w-3" /> Lock in your gym
        </div>
        <p className="font-display text-lg leading-tight mt-1">
          {autoLoading ? "Finding gyms near you…" : results && results.length > 0 ? "Pick your gym" : "Where do you train?"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {results && results.length > 0
            ? "We pulled these from the address you set up. Tap one to lock it in."
            : "We'll know the moment you walk in — and make it count."}
        </p>
      </div>

      {autoLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
          Searching gyms within 1.5 km of your address…
        </div>
      )}

      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Gym name or area"
          className="flex-1 h-11 rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-md border border-border px-3 text-xs label-mono inline-flex items-center gap-1"
        >
          <Search className="h-3.5 w-3.5" /> Search
        </button>
      </form>
      <button
        type="button"
        onClick={loadNearby}
        disabled={busy}
        className="w-full h-10 rounded-md border border-gold/40 text-gold text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-gold/5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
        Refresh nearby gyms
      </button>

      {results && (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {results.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => pick(g)}
                disabled={busy}
                className="w-full text-left rounded-lg border border-border bg-background p-3 hover:border-gold/50 transition-colors"
              >
                <p className="font-medium text-sm truncate">{g.name}</p>
                {g.formatted_address && (
                  <p className="text-xs text-muted-foreground truncate">{g.formatted_address}</p>
                )}
                {typeof g.distance_meters === "number" && (
                  <p className="text-xs label-mono text-gold mt-0.5">
                    {(g.distance_meters / 1000).toFixed(1)} km away
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
