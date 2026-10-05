/**
 * Distance / pace helpers shared by outdoor UI.
 */

export type Unit = "imperial" | "metric";

export function formatDistance(meters: number, unit: Unit): string {
  if (unit === "imperial") {
    const mi = meters / 1609.34;
    if (mi < 0.1) return `${Math.round(meters * 3.28084)} ft`;
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Easy walking ETA at ~5 km/h. */
export function walkETA(meters: number): number {
  return Math.round((meters / 5000) * 3600);
}

/** Easy jog ETA at ~9 km/h. */
export function jogETA(meters: number): number {
  return Math.round((meters / 9000) * 3600);
}

/** Driving ETA estimate at ~60 km/h. Used as a fallback for hike cards. */
export function approxDrive(meters: number): number {
  return Math.round((meters / 60000) * 3600);
}

/** Haversine distance in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Snap a meter value to a clean unit-aware slider step. */
export function snapDistance(meters: number, unit: Unit): number {
  if (unit === "imperial") {
    const mi = meters / 1609.34;
    const snapped = Math.round(mi * 2) / 2; // 0.5 mi steps
    return Math.max(0.5, snapped) * 1609.34;
  }
  const km = Math.round((meters / 1000) * 2) / 2;
  return Math.max(0.5, km) * 1000;
}
