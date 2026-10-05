import { useEffect } from "react";
import { syncPendingSubscription } from "@/lib/push-client";

/**
 * Mounted once inside /app. Drains any pending push subscriptions saved by
 * the service worker (after a rotation) or by a previous failed save attempt.
 * Silent. No UI.
 */
export function PushSubscriptionSync() {
  useEffect(() => {
    // Defer to idle so it doesn't compete with first paint.
    const run = () => { syncPendingSubscription().catch(() => {}); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else setTimeout(run, 1500);
  }, []);
  return null;
}
