import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

// POST, not GET: a GET response can be served from the browser's HTTP cache or
// a CDN edge, which would render the "set your code" screen while the database
// already holds a PIN. The no-store header is a second belt on the same braces.
export const adminPinStatus = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  setResponseHeader("Pragma", "no-cache");
  const { pinStatus } = await import("./admin-pin.server");
  return pinStatus();
});


export const adminPinSetup = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data }) => {
    const { setupPin } = await import("./admin-pin.server");
    return setupPin(data.pin);
  });

export const adminPinLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data }) => {
    const { loginWithPin } = await import("./admin-pin.server");
    return loginWithPin(data.pin);
  });

export const adminPinLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearSession } = await import("./admin-pin.server");
  clearSession();
  return { ok: true as const };
});

export const adminPinChange = createServerFn({ method: "POST" })
  .inputValidator((d: { currentPin: string; newPin: string }) => d)
  .handler(async ({ data }) => {
    const { changePin } = await import("./admin-pin.server");
    return changePin(data.currentPin, data.newPin);
  });
