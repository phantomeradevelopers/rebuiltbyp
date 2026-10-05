import { createServerFn } from "@tanstack/react-start";

/** Every function here is gated server-side by the admin PIN session cookie. */
async function gate() {
  const { requireAdminPin } = await import("./admin-pin.server");
  await requireAdminPin();
}

export const adminAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d: { range: "today" | "7d" | "30d" | "90d" | "all" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { analyticsOverview } = await import("./admin-analytics-console.server");
    return analyticsOverview(data.range);
  });

export const adminMembers = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { members } = await import("./admin-app.server");
  return members();
});

export const adminMemberDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { memberDetail } = await import("./admin-app.server");
    return memberDetail(data.userId);
  });

export const adminCourse = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { courseStats } = await import("./admin-app.server");
  return courseStats();
});

export const adminMoney = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { moneyStats } = await import("./admin-app.server");
  return moneyStats();
});

export const adminFeatures = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { featureStats } = await import("./admin-app.server");
  return featureStats();
});

export const adminCoaching = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { coachingStats } = await import("./admin-app.server");
  return coachingStats();
});

export const adminSupport = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { supportList } = await import("./admin-app.server");
  return supportList();
});

export const adminSupportRead = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; read: boolean }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { markSupportRead } = await import("./admin-app.server");
    return markSupportRead(data.id, data.read);
  });

export const adminContent = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { contentList } = await import("./admin-app.server");
  return contentList();
});

export const adminSaveModule = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; slug: string; title: string; summary?: string; sort_order?: number; published?: boolean }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { saveModule } = await import("./admin-app.server");
    return saveModule(data);
  });

export const adminSetModulePublished = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; published: boolean }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { setModulePublished } = await import("./admin-app.server");
    return setModulePublished(data.id, data.published);
  });

export const adminDeleteModule = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const { deleteModule } = await import("./admin-app.server");
    return deleteModule(data.id);
  });
