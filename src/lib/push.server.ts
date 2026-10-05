import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VAPID_PUBLIC_KEY } from "./vapid";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getVapid(): VapidKeys {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY not configured");
  return {
    subject: process.env.VAPID_SUBJECT || "mailto:support@e2v.ai",
    publicKey: VAPID_PUBLIC_KEY,
    privateKey,
  };
}

async function deliver(sub: PushSubscription, payload: PushPayload, ttl: number) {
  const vapid = getVapid();
  const built = await buildPushPayload(
    { data: payload, options: { ttl, urgency: "normal" } },
    sub,
    vapid,
  );
  const res = await fetch(sub.endpoint, {
    method: built.method,
    headers: built.headers,
    body: built.body as BodyInit,
  });
  return res;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    const sub: PushSubscription = {
      endpoint: s.endpoint as string,
      expirationTime: null,
      keys: { p256dh: s.p256dh as string, auth: s.auth as string },
    };
    try {
      const res = await deliver(sub, payload, 24 * 60 * 60);
      if (res.ok || res.status === 201 || res.status === 202) {
        sent++;
      } else if (res.status === 404 || res.status === 410) {
        // Subscription is gone — purge it.
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("id", s.id as string);
        failed++;
      } else {
        failed++;
        console.warn("[push] non-ok status", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      failed++;
      console.warn("[push] send failed", (e as Error).message);
    }
  }
  return { sent, failed };
}

// Backwards-compatible alias used by older call sites.
export async function sendTestToUser(userId: string) {
  return sendPushToUser(userId, {
    title: "REBUILT",
    body: "You're wired in. P's got your back.",
    url: "/app",
    tag: "test",
  });
}
