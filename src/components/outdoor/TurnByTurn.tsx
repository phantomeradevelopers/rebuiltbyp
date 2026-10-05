import { useState } from "react";
import { ChevronDown, ChevronUp, Navigation, ExternalLink } from "lucide-react";
import type { RouteStep } from "@/lib/outdoor.functions";
import { formatDistance } from "@/lib/outdoor-format";

type Props = {
  steps: RouteStep[] | null | undefined;
  unit: "imperial" | "metric";
  origin: { lat: number; lng: number };
  destination?: { lat: number; lng: number } | null;
};

export function TurnByTurn({ steps, unit, origin, destination }: Props) {
  const [open, setOpen] = useState(false);
  const hasSteps = !!steps && steps.length > 0;

  const dest = destination ?? origin;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=walking`;

  return (
    <div className="rounded-lg border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 h-11 flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm">
          <Navigation className="h-4 w-4 text-gold" />
          <span className="label-mono text-gold">Turn-by-turn</span>
          {hasSteps && (
            <span className="text-[11px] text-muted-foreground">
              {steps!.length} step{steps!.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {hasSteps ? (
            <ol className="space-y-2">
              {steps!.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-full bg-gold/10 text-gold text-[11px] font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="leading-snug">{s.instruction}</span>
                    {s.distance_m > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {formatDistance(s.distance_m, unit)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              No step list for this route — open it in Google Maps for live nav.
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-gold text-gold-foreground text-xs font-semibold hover:opacity-90"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
