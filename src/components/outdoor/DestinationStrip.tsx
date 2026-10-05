import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  getWalkableDestinations,
  setLoopDestination,
  type WalkDestination,
  type OriginKind,
} from "@/lib/outdoor.functions";
import { formatDistance } from "@/lib/outdoor-format";

type Props = {
  origin: OriginKind;
  unit: "imperial" | "metric";
  onPicked?: () => void;
};

export function DestinationStrip({ origin, unit, onPicked }: Props) {
  const [dests, setDests] = useState<WalkDestination[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const fetchDests = useServerFn(getWalkableDestinations);
  const pickDest = useServerFn(setLoopDestination);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDests({ data: { origin } })
      .then((r) => {
        if (alive) setDests(r.destinations);
      })
      .catch(() => {
        if (alive) setDests([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  async function choose(d: WalkDestination) {
    setPicking(d.place_id);
    try {
      await pickDest({
        data: {
          destLat: d.lat,
          destLng: d.lng,
          destName: d.name,
          origin,
        },
      });
      toast.success(`Walking to ${d.name}.`);
      onPicked?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPicking(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Finding fun spots nearby…
      </div>
    );
  }

  if (!dests || dests.length === 0) return null;

  return (
    <div>
      <p className="label-mono text-gold text-xs mb-2">Where to today?</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1 snap-x">
        {dests.map((d) => {
          const busy = picking === d.place_id;
          return (
            <button
              key={d.place_id}
              type="button"
              onClick={() => choose(d)}
              disabled={!!picking}
              className="snap-start shrink-0 min-w-[140px] max-w-[180px] rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{d.emoji}</span>
                <span className="label-mono text-xs text-gold">{d.category}</span>
              </div>
              <p className="mt-1 text-[13px] font-medium leading-tight line-clamp-2">{d.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {busy ? "Routing…" : `${formatDistance(d.round_trip_m, unit)} round trip`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
