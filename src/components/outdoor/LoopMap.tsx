import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  origin: { lat: number; lng: number };
  polyline?: string;
  className?: string;
  interactive?: boolean;
};

export function LoopMap({ origin, polyline, className, interactive = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g: any) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(containerRef.current, {
            center: origin,
            zoom: 15,
            disableDefaultUI: !interactive,
            gestureHandling: interactive ? "greedy" : "none",
            clickableIcons: false,
            // Lighter style so users can actually read street names.
            styles: [
              { elementType: "geometry", stylers: [{ color: "#2a2d33" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#1a1c20" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#d4d4d8" }] },
              { featureType: "road", elementType: "geometry", stylers: [{ color: "#3d4148" }] },
              { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#e4e4e7" }] },
              { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#4a4f57" }] },
              { featureType: "water", elementType: "geometry", stylers: [{ color: "#11151c" }] },
              { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1b2a1f" }] },
              { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            ],
          });
          // Big green "START" marker at origin.
          new g.maps.Marker({
            position: origin,
            map: mapRef.current,
            title: "Start here",
            label: { text: "START", color: "#0a0a0a", fontSize: "10px", fontWeight: "700" },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: "#22c55e",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
        } else {
          mapRef.current.setCenter(origin);
        }

        if (polyline && mapRef.current) {
          lineRef.current?.setMap(null);
          const path = g.maps.geometry.encoding.decodePath(polyline);
          // Directional arrow at the start of the path so users know which way.
          const arrow = {
            path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: "#d4af37",
            fillColor: "#d4af37",
            fillOpacity: 1,
          };
          lineRef.current = new g.maps.Polyline({
            path,
            strokeColor: "#d4af37",
            strokeOpacity: 0.95,
            strokeWeight: 5,
            map: mapRef.current,
            icons: [
              { icon: arrow, offset: "8%" },
              { icon: arrow, offset: "50%" },
            ],
          });
          const bounds = new g.maps.LatLngBounds();
          path.forEach((p: any) => bounds.extend(p));
          // Small padding + maxZoom cap so short loops don't zoom in
          // absurdly and long ones stay readable in the compact card.
          const pad = interactive ? 40 : 20;
          mapRef.current.fitBounds(bounds, { top: pad, right: pad, bottom: pad, left: pad });
          const listener = g.maps.event.addListenerOnce(mapRef.current, "idle", () => {
            const z = mapRef.current.getZoom?.() ?? 15;
            if (z > 17) mapRef.current.setZoom(17);
            if (z < 13) mapRef.current.setZoom(13);
          });
          // avoid unused var lint
          void listener;
        }
      })
      .catch((e: unknown) => console.error("Maps load failed", e));
    return () => {
      cancelled = true;
    };
  }, [origin, polyline, interactive]);

  return <div ref={containerRef} className={className ?? "w-full h-48 rounded-xl bg-muted"} />;
}
