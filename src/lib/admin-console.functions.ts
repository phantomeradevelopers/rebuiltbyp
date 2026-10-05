import { createServerFn } from "@tanstack/react-start";

/** Every function here is gated server-side by the admin PIN session cookie. */
async function gate() {
  const { requireAdminPin } = await import("./admin-pin.server");
  await requireAdminPin();
}

export const consoleOverview = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { overview } = await import("./admin-console.server");
  return overview();
});

export const consoleFeatureUsage = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { featureUsage } = await import("./admin-console.server");
  return featureUsage();
});

export const consoleUsers = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { usersList } = await import("./admin-console.server");
  return usersList();
});

export const consoleMoney = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { money } = await import("./admin-console.server");
  return money();
});

export const consoleContent = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { contentStats } = await import("./admin-console.server");
  return contentStats();
});
