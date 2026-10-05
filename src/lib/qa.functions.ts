import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

/** Is QA preview mode switched on? No secrets leave the server here. */
export const qaStatus = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  setResponseHeader("Pragma", "no-cache");
  const { qaModeEnabled } = await import("@/lib/qa.server");
  return { enabled: qaModeEnabled() };
});

/** Verifies the 6-digit code server-side and returns one-time demo credentials. */
export const qaLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ({ pin: String((input as { pin?: string })?.pin ?? "") }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    const { qaSignIn, clientIpFrom } = await import("@/lib/qa.server");
    const ip = clientIpFrom(getRequest());
    return qaSignIn(data.pin, ip);
  });
