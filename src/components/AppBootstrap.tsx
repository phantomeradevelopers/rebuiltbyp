import { useEffect } from "react";

const REF_STORAGE_KEY = "rebuilt:ref_code";

function captureReferralCode() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ref") || params.get("REF");
    if (!raw) return;
    const code = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16);
    if (code.length < 4) return;
    // First-touch wins.
    if (!window.localStorage.getItem(REF_STORAGE_KEY)) {
      window.localStorage.setItem(REF_STORAGE_KEY, code);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Mounts once at the root. Installs:
 *  - global error → server telemetry pipeline
 *  - stale-chunk auto-reload guard
 *  - offline write queue auto-drain on online/visibility/interval
 *  - first-touch referral code capture from `?ref=` URL param
 */
export function AppBootstrap() {
  useEffect(() => {
    window.setTimeout(() => {
      void import("@/lib/client-telemetry").then(({ installClientTelemetry }) =>
        installClientTelemetry(),
      );
      void import("@/lib/offline-queue").then(({ installAutoDrain }) => installAutoDrain());
      // Idempotent, but only for signed-in users (the fn requires auth).
      void import("@/integrations/supabase/client").then(async ({ supabase }) => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const { checkAndClaimReferralReward } = await import(
          "@/lib/referral-rewards.functions"
        );
        await checkAndClaimReferralReward({ data: undefined as never }).catch(() => {});
      });
    }, 0);
    captureReferralCode();
    // Fade out and remove the inline boot splash once React has mounted.
    if (typeof document !== "undefined") {
      document.body.classList.add("app-ready");
      const splash = document.getElementById("boot-splash");
      if (splash) {
        window.setTimeout(() => splash.remove(), 500);
      }
    }
  }, []);
  return null;
}
