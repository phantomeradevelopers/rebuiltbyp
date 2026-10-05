import { useState } from "react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Wallet-first payment block. ExpressCheckoutElement renders the real native
 * Apple Pay / Google Pay buttons; the card form sits below it. In `setup`
 * mode the wallet stores a reusable mandate, which is what makes the
 * subscription actually renew.
 */
export function CheckoutPaymentForm({
  mode,
  returnUrl,
  buttonLabel,
  onWalletsChange,
}: {
  mode: "setup" | "payment";
  returnUrl: string;
  buttonLabel: string;
  onWalletsChange?: (wallets: string[]) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [hasWallets, setHasWallets] = useState(false);

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error } = await elements.submit();
      if (error) {
        toast.error(error.message ?? "Check your payment details.");
        return;
      }
      // `redirect: "always"` is what actually hands Affirm / Klarna / Afterpay /
      // Cash App Pay off to the provider. Everything lands on /checkout/return.
      const result =
        mode === "setup"
          ? await stripe.confirmSetup({
              elements,
              confirmParams: { return_url: returnUrl },
              redirect: "always",
            })
          : await stripe.confirmPayment({
              elements,
              confirmParams: { return_url: returnUrl },
              redirect: "always",
            });
      if (result?.error) toast.error(result.error.message ?? "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className={hasWallets ? "block w-full" : "hidden"}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 48,
            layout: { maxColumns: 1, maxRows: 3 },
          }}
          onReady={(e) => {
            const available = Object.entries(e.availablePaymentMethods ?? {})
              .filter(([, on]) => !!on)
              .map(([name]) => name);
            setHasWallets(available.length > 0);
            onWalletsChange?.(available);
          }}
          onConfirm={async () => {
            if (!stripe || !elements) return;
            setBusy(true);
            try {
              const result =
                mode === "setup"
                  ? await stripe.confirmSetup({
                      elements,
                      confirmParams: { return_url: returnUrl },
                      redirect: "always",
                    })
                  : await stripe.confirmPayment({
                      elements,
                      confirmParams: { return_url: returnUrl },
                      redirect: "always",
                    });
              if (result?.error) toast.error(result.error.message ?? "Payment could not be completed.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or pay with card
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>

      <PaymentElement
        options={{
          // Accordion, not tabs: at 390px the tab strip collapses every method
          // past the second into an overflow menu, which hides Cash App Pay,
          // Klarna and Afterpay behind an extra tap. Accordion rows are always
          // visible and directly tappable.
          layout: { type: "accordion", defaultCollapsed: false },
        }}
      />

      <button
        type="button"
        onClick={confirm}
        disabled={!stripe || busy}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
      </button>
    </div>
  );
}
