import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VAPID_PUBLIC_KEY } from "./vapid";

const SubSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  user_agent: z.string().max(500).optional(),
});

export const subscribeToPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        user_agent: data.user_agent ?? null,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error("Could not save subscription.");
    return { ok: true as const };
  });

export const unsubscribeFromPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("push_subscriptions").delete()
      .eq("user_id", userId).eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase.from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("enabled", true);
    return { activeDevices: count ?? 0, publicKey: VAPID_PUBLIC_KEY };
  });

/** Send a test push to all of the current user's active devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUser } = await import("@/lib/push.server");
    return sendPushToUser(context.userId, {
      title: "REBUILT",
      body: "You're wired in. P's got your back.",
      url: "/app",
      tag: "test",
    });
  });
