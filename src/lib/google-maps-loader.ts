import { getGoogleMapsBrowserConfig } from "./google-maps.functions";

/**
 * Lightweight Google Maps JS loader. Reuses a single promise so multiple
 * components don't inject duplicate <script> tags.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    google?: any;
    __outdoorMapsCb?: () => void;
  }
}

let loadPromise: Promise<any> | null = null;

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps can only load in the browser."));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  let browserKey = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY) as string | undefined;
  let tracking = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID) as
    | string
    | undefined;

  if (!browserKey) {
    const config = await getGoogleMapsBrowserConfig();
    browserKey = config.browserKey ?? undefined;
    tracking = config.tracking ?? tracking;
  }
  if (!browserKey) {
    return Promise.reject(new Error("Google Maps browser key is not configured."));
  }

  loadPromise = new Promise((resolve, reject) => {
    window.__outdoorMapsCb = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialize."));
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: browserKey,
      loading: "async",
      callback: "__outdoorMapsCb",
      libraries: "geometry,places",
    });
    if (tracking) params.set("channel", tracking);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Couldn't load Google Maps."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
