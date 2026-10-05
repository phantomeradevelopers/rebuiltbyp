// Single source of truth for all CandyRx outbound links.
// shopcandyrx.com only exposes `/`, `/products`, and `/legal/*` as live paths —
// every `/collections/*` URL 404s, so we always route to `/products`.

export const CANDYRX_BASE = "https://www.shopcandyrx.com";
export const CANDYRX_CODE = "PLAYBOYP15";

export function candyRxUrl(
  path: "/" | "/products" = "/products",
  campaign = "playboyp15",
): string {
  const u = new URL(path, CANDYRX_BASE);
  u.searchParams.set("discount", CANDYRX_CODE);
  u.searchParams.set("utm_source", "rebuilt");
  u.searchParams.set("utm_medium", "app");
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}
