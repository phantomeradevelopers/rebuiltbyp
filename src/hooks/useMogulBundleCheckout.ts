import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/web-track";

/**
 * One-time $99 purchase of the four Mogul guides.
 *
 * Sign-in is required first so the purchase is attributed to an account —
 * the guides are delivered inside the app, not to an anonymous email.
 */
export function useMogulBundleCheckout(redirectBackTo = "/pricing") {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function buyBundle() {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.message("Create a free account first — the guides land in your library.");
        navigate({
          to: "/login" as never,
          search: { redirect: "/checkout?item=mogul_bundle" } as never,
        });
        return;
      }
      trackEvent("buy_clicked");
      navigate({
        to: "/checkout" as never,
        search: { item: "mogul_bundle", redirect: redirectBackTo } as never,
      });
    } finally {
      setLoading(false);
    }
  }

  return { buyBundle, loading };
}
