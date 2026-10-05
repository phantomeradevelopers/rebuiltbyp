import { useEffect, useState } from "react";
import { getStripePublishableKey } from "@/lib/checkout.functions";

/** Shows only while the app is pointed at Stripe test keys. */
export function PaymentTestModeBanner() {
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { testMode: tm } = await getStripePublishableKey();
        setTestMode(!!tm);
      } catch {
        setTestMode(false);
      }
    })();
  }, []);

  if (!testMode) return null;

  return (
    <div className="w-full bg-orange-500/15 border-b border-orange-500/30 px-4 py-2 text-center text-xs sm:text-sm text-orange-200">
      Payments are in <strong>test mode</strong>. Use test cards — no real charges.
    </div>
  );
}
