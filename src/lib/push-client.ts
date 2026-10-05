import { getPushStatus, subscribeToPush, unsubscribeFromPush } from "./push.functions";

const PENDING_KEY = "rebuilt.push.pendingSubscription";
const PREPROMPT_DISMISSED_KEY = "rebuilt.push.prePromptDismissedAt";
const PREPROMPT_NAG_DAYS = 14;

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isPreviewIframe(): boolean {
  if (typeof window === "undefined") return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function shouldShowPrePrompt(): boolean {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "default") return false;
  const dismissedAt = Number(localStorage.getItem(PREPROMPT_DISMISSED_KEY) || "0");
  if (!dismissedAt) return true;
  return Date.now() - dismissedAt > PREPROMPT_NAG_DAYS * 86_400_000;
}

export function recordPrePromptDismissed(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREPROMPT_DISMISSED_KEY, String(Date.now()));
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

type PendingSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string;
};

async function saveSubscriptionWithRetry(sub: PendingSub): Promise<{ ok: boolean; error?: string }> {
  const delays = [0, 500, 1500];
  let lastErr: unknown = null;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      await subscribeToPush({ data: sub });
      try { localStorage.removeItem(PENDING_KEY); } catch {}
      return { ok: true };
    } catch (e) {
      lastErr = e;
    }
  }
  // Persist for next-load sync
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(sub)); } catch {}
  return { ok: false, error: (lastErr as Error)?.message || "Failed to save subscription." };
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Your browser doesn't support push notifications." };
  if (isPreviewIframe()) {
    return { ok: false, reason: "Push only works on the published app. Open rebuilt-pathway.lovable.app and add to home screen." };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    recordPrePromptDismissed();
    return { ok: false, reason: "Permission denied. Enable notifications in your phone's settings." };
  }

  const reg = await ensureRegistration();
  await navigator.serviceWorker.ready;

  const { publicKey } = await getPushStatus();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "Could not read subscription." };
  }
  const payload: PendingSub = {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    user_agent: navigator.userAgent.slice(0, 500),
  };
  const result = await saveSubscriptionWithRetry(payload);
  if (!result.ok) return { ok: false, reason: result.error || "Could not save subscription." };
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try { await unsubscribeFromPush({ data: { endpoint: sub.endpoint } }); } catch {}
    try { await sub.unsubscribe(); } catch {}
  }
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

/**
 * Background sync:
 * - Retry any subscription that failed to save last time (from localStorage).
 * - Check the SW cache for a rotated subscription (from pushsubscriptionchange).
 * Safe to call on app load. Silent on failure.
 */
export async function syncPendingSubscription(): Promise<void> {
  if (!isPushSupported() || isPreviewIframe()) return;

  // 1. Drain localStorage queue.
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const sub = JSON.parse(raw) as PendingSub;
      if (sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth) {
        await saveSubscriptionWithRetry(sub);
      } else {
        localStorage.removeItem(PENDING_KEY);
      }
    }
  } catch {}

  // 2. Drain SW cache (rotated subscription from pushsubscriptionchange).
  try {
    if (!("caches" in window)) return;
    const cache = await caches.open("rebuilt-push-pending");
    const res = await cache.match("/__pending-push-sub");
    if (!res) return;
    const body = (await res.json()) as {
      oldEndpoint?: string;
      newSubscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };
    const ns = body.newSubscription;
    if (ns?.endpoint && ns.keys?.p256dh && ns.keys?.auth) {
      if (body.oldEndpoint && body.oldEndpoint !== ns.endpoint) {
        try { await unsubscribeFromPush({ data: { endpoint: body.oldEndpoint } }); } catch {}
      }
      await saveSubscriptionWithRetry({
        endpoint: ns.endpoint,
        keys: { p256dh: ns.keys.p256dh, auth: ns.keys.auth },
        user_agent: navigator.userAgent.slice(0, 500),
      });
    }
    await cache.delete("/__pending-push-sub");
  } catch {}
}
