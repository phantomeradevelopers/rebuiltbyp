import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Detects when a new service worker has installed and is waiting, and
 * surfaces a single, non-intrusive prompt so the user can refresh on demand.
 * Also handles the controllerchange event to reload after they accept.
 */
export function SwUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip inside iframes (Lovable preview)
    try { if (window.self !== window.top) return; } catch { return; }

    let reg: ServiceWorkerRegistration | undefined;
    let reloadOnControllerChange = false;

    const onControllerChange = () => {
      if (reloadOnControllerChange) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    (async () => {
      try {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        if (reg.waiting) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const sw = reg!.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(sw);
            }
          });
        });
      } catch { /* ignore */ }
    })();

    return () => {
      reloadOnControllerChange = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const t = toast("New version of REBUILT is ready", {
      description: "Tap to refresh and get the latest.",
      action: {
        label: "Refresh",
        onClick: () => {
          waiting.postMessage({ type: "SKIP_WAITING" });
          // After SW takes control, controllerchange fires → reload
          setTimeout(() => window.location.reload(), 600);
        },
      },
      duration: Infinity,
    });
    return () => { toast.dismiss(t); };
  }, [waiting]);

  return null;
}
