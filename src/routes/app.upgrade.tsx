import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { PricingTiers } from "@/components/PricingTiers";
import { restoreMyPurchase } from "@/lib/entitlement.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/tier";

const FEATURE_COPY: Record<string, { title: string; sub: string }> = {
  coach_unlimited: { title: "You've hit today's free Coach P limit.", sub: "Pro unlocks unlimited messages, voice, and memory continuity." },
  coach_voice: { title: "Voice is a Pro feature.", sub: "Hear Coach P speak — and reply with your voice." },
  voice_journal: { title: "Voice journaling is a Pro feature.", sub: "Speak your truth — Coach P folds it into your motivation." },
  all_traditions: { title: "Switch between all four traditions.", sub: "Pro lets you flip traditions any day; Coach P speaks in that voice." },
  progress_photos: { title: "Progress photos are a Pro feature.", sub: "Track the rebuild visually — encrypted and yours alone." },
  full_missions: { title: "See your full daily mission list.", sub: "Free shows one mission a day. Pro shows the full ordered list." },
  trophies: { title: "Unlock all trophies.", sub: "Free lets you preview the trophy room. Pro unlocks real progress." },
  nutrition_full: { title: "Track every meal.", sub: "Free logs 1 meal/day. Pro logs unlimited plates with macros and coaching." },
  default: { title: "Unlock the full REBUILT effect.", sub: "Pro removes the daily limits and turns on every premium tool." },
};

export const Route = createFileRoute("/app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — REBUILT" },{ name: "description", content: "Unlock Pro or Elite for full access to your rebuild." },{ property: "og:title", content: "Upgrade — REBUILT" },{ property: "og:description", content: "Unlock Pro or Elite for full access to your rebuild." },] }),
  component: UpgradePage,
  validateSearch: (s: Record<string, unknown>) => ({
    feature: typeof s.feature === "string" ? s.feature : undefined,
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />,
});

function UpgradePage() {
  const navigate = useNavigate();
  const { feature, plan: defaultPlanParam } = useSearch({ from: "/app/upgrade" });
  const copy = FEATURE_COPY[feature ?? "default"] ?? FEATURE_COPY.default;
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

  const defaultPlan: Plan = (
    defaultPlanParam === "pro_monthly" ||
    defaultPlanParam === "pro_annual" ||
    defaultPlanParam === "elite_monthly" ||
    defaultPlanParam === "elite_annual"
      ? (defaultPlanParam as Plan)
      : "pro_annual"
  );

  async function onRestore() {
    try {
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
    <main className="min-h-dvh px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <button onClick={() => navigate({ to: "/app" as never })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>
      <header className="mb-6">
        <p className="label-mono text-gold">UPGRADE</p>
        <h1 className="font-display text-2xl sm:text-3xl mt-2">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.sub}</p>
      </header>

      <PricingTiers
        defaultPlan={defaultPlan}
        user={user}
        onRestore={onRestore}
        loadingPlan={loadingPlan}
        busy={loadingPlan !== null}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already a member? <Link to={"/app/account" as never} className="underline">Manage on your account page</Link>.
      </p>
    </main>
  );
}
