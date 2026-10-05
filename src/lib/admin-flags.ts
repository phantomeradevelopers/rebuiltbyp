// Admin flag registry — feature toggles the owner flips on to expose UI that
// depends on Stripe/dashboard config outside the app. Simple, honest, stubbed:
// reads localStorage first (so owner can toggle without a deploy), then falls
// back to the compiled default. Add flags here as they're introduced.
//
// Usage:
//   const bnpl = useAdminFlag("bnpl_enabled");
//   {bnpl && <p>Affirm & Klarna available at checkout.</p>}

import { useEffect, useState } from "react";

const DEFAULTS = {
  // Owner toggles Affirm + Klarna eligibility inside the Stripe dashboard for
  // the one-time course price. When ON, we surface a small line at checkout
  // so buyers know payment plans exist. No client-side eligibility logic.
  bnpl_enabled: false,
} as const;

export type AdminFlag = keyof typeof DEFAULTS;

const STORAGE_PREFIX = "admin:flag:";

function readFlag(flag: AdminFlag): boolean {
  if (typeof window === "undefined") return DEFAULTS[flag];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + flag);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return DEFAULTS[flag];
}

export function useAdminFlag(flag: AdminFlag): boolean {
  // SSR-safe: start with compiled default; hydrate from localStorage on mount.
  const [on, setOn] = useState<boolean>(DEFAULTS[flag]);
  useEffect(() => {
    setOn(readFlag(flag));
  }, [flag]);
  return on;
}
