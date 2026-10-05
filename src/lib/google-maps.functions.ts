import { createServerFn } from "@tanstack/react-start";

export const getGoogleMapsBrowserConfig = createServerFn({ method: "GET" }).handler(async () => {
  const browserKey =
    process.env.GOOGLE_MAPS_BROWSER_KEY_1 ??
    process.env.GOOGLE_MAPS_BROWSER_KEY ??
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1 ??
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ??
    null;

  const tracking =
    process.env.GOOGLE_MAPS_TRACKING_ID_1 ??
    process.env.GOOGLE_MAPS_TRACKING_ID ??
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1 ??
    process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ??
    null;

  return { browserKey, tracking };
});