import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { PricingTiers } from "@/components/PricingTiers";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { restoreMyPurchase } from "@/lib/entitlement.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/tier";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — REBUILT" },
      { name: "description", content: "Free forever, or unlock the full REBUILT experience. Pro, Elite, or the lifetime Course bundle." },
    ],
  }),
});

function PricingPage() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setUser({ id: u.id, email: u.email });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function ensureSession(): Promise<boolean> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      navigate({ to: "/login" as never, search: { redirect: "/pricing" } as never });
      return false;
    }
    return true;
  }

  async function onRestore() {
    try {
      if (!(await ensureSession())) return;
      setLoadingPlan("course_full" as Plan);
      const { entitlement } = await restoreMyPurchase();
      if (entitlement && entitlement !== "free") {
        toast.success("Purchase restored.");
        navigate({ to: "/app/account" as never });
      } else {
        toast.message("No prior purchase found for this account.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-dvh px-4 sm:px-6 py-10 max-w-5xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-3.5 w-3.5" /> Home
      </Link>
      <header className="text-center mb-8">
        <p className="label-mono text-gold">REBUILT</p>
        <h1 className="font-display text-3xl sm:text-4xl mt-2">Start free. Rebuild for less than a coffee a day.</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Free forever for the daily loop. Pro unlocks the full system. Elite adds 1:1 access. The Course gives you everything for life.
        </p>
      </header>

      <PricingTiers
        defaultPlan="pro_annual"
        user={user}
        onRestore={onRestore}
        loadingPlan={loadingPlan}
        busy={loadingPlan !== null}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Bought the $497 program? <Link to={"/app/account" as never} className="underline">Sign in</Link> with that email — lifetime access unlocks automatically.
      </p>

      <PublicFooter />
    </main>
  );
}
