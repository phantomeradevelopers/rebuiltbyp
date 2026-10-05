import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAppleIapContext, purchaseWithApple, restoreApplePurchases } from "@/lib/iap";
import { getAccessStatus } from "@/lib/access.functions";
import { useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, Crown } from "lucide-react";
import type { Plan } from "@/lib/tier";
import { SignatureSeal } from "@/components/brand/SignatureSeal";
import { useAdminFlag } from "@/lib/admin-flags";
import { useMogulBundleCheckout } from "@/hooks/useMogulBundleCheckout";
import { trackEvent } from "@/lib/web-track";

type Cadence = "monthly" | "annual";
type Metal = "steel" | "gold" | "platinum";

// Maps an app plan onto a checkout item key in the Stripe catalog.
const CHECKOUT_ITEMS: Record<Exclude<Plan, "free" | "lifetime_pro">, string> = {
  pro_monthly: "pro_monthly",
  pro_annual: "pro_annual",
  elite_monthly: "elite_monthly",
  elite_annual: "elite_annual",
  course_full: "course_full",
  course_installment: "course_full",
};

export function PricingTiers({
  defaultPlan = "pro_annual",
  user,
  onRestore,
  busy: busyProp = false,
  loadingPlan: loadingPlanProp = null,
}: {
  defaultPlan?: Plan;
  user?: { id: string; email?: string } | null;
  onRestore: () => void;
  busy?: boolean;
  loadingPlan?: Plan | null;
}) {
  const [cadence, setCadence] = useState<Cadence>(
    defaultPlan.endsWith("_monthly") ? "monthly" : "annual",
  );
  const bnplEnabled = useAdminFlag("bnpl_enabled");
  const navigate = useNavigate();
  const { buyBundle, loading: bundleLoading } = useMogulBundleCheckout("/pricing");

  const busy = busyProp;
  const queryClient = useQueryClient();
  const [appleIap, setAppleIap] = useState(false);
  const [iapBusy, setIapBusy] = useState<Plan | "restore" | null>(null);
  useEffect(() => {
    setAppleIap(isAppleIapContext());
  }, []);

  // Only a signed-in FREE user sees "Current plan" on the free card.
  const { data: access } = useQuery({
    queryKey: ["access-status"],
    queryFn: () => getAccessStatus(),
    staleTime: 60_000,
    enabled: !!user,
  });
  const onFreePlan = !!user && (access?.tier ?? "free") === "free";

  const proPlan: Plan = cadence === "annual" ? "pro_annual" : "pro_monthly";
  const elitePlan: Plan = cadence === "annual" ? "elite_annual" : "elite_monthly";

  const proPrice = cadence === "annual" ? "$129" : "$14.99";
  const proCadence = cadence === "annual" ? "/yr" : "/mo";
  const proStrike = cadence === "annual" ? "$179.88/yr" : null;
  const proSub = cadence === "annual" ? "Save $50.88 a year — 28% off" : null;

  const elitePrice = cadence === "annual" ? "$219" : "$24.99";
  const eliteCadence = cadence === "annual" ? "/yr" : "/mo";
  const eliteStrike = cadence === "annual" ? "$299.88/yr" : null;
  const eliteSub = cadence === "annual" ? "Save $80.88 a year — 27% off" : null;

  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const trialEndLabel = trialEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function goToCheckout(plan: Plan) {
    if (!user?.id) {
      // Parent should ensure session; if somehow missing, delegate to restore path
      // so the user isn't left without feedback.
      onRestore();
      return;
    }
    const item = CHECKOUT_ITEMS[plan as keyof typeof CHECKOUT_ITEMS];
    if (!item) return;
    trackEvent("buy_clicked");
    navigate({ to: "/checkout" as never, search: { item } as never });
  }

  async function handleChoosePlan(plan: Plan) {
    if (appleIap) {
      setIapBusy(plan);
      try {
        const tier = await purchaseWithApple(plan);
        await queryClient.invalidateQueries();
        if (tier !== "free") toast.success("You're in. Welcome to REBUILT " + (tier === "elite" ? "Elite" : "Pro") + ".");
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? "Purchase failed.";
        if (!/cancel/i.test(msg)) toast.error(msg);
      } finally {
        setIapBusy(null);
      }
      return;
    }
    goToCheckout(plan);
  }

  async function onAppleRestore() {
    setIapBusy("restore");
    try {
      const tier = await restoreApplePurchases();
      await queryClient.invalidateQueries();
      toast.success(tier === "free" ? "No active App Store subscription found." : "Purchases restored.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIapBusy(null);
    }
  }

  async function handleCourse(plan: "course_full" | "course_installment") {
    goToCheckout(plan);
  }


  return (
    <div className="space-y-6">
      {/* Cadence toggle — premium treatment */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-full bg-muted p-1 text-xs shadow-inner">
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            className={`px-4 h-8 rounded-full transition ${cadence === "monthly" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCadence("annual")}
            className={`px-4 h-8 rounded-full transition inline-flex items-center gap-1.5 ${cadence === "annual" ? "bg-background text-foreground shadow-sm ring-1 ring-gold/40" : "text-muted-foreground"}`}
          >
            Annual
            <span
              className="rounded-full text-[10px] font-semibold px-1.5 py-0.5 text-gold-metal ring-1 ring-gold/40"
              aria-label="Save up to 28 percent"
            >
              Save up to 28%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards — Pro slightly elevated */}
      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        {/* FREE — steel */}
        <article className="tier-card-steel p-5 flex flex-col md:mt-3">
          <p className="label-mono text-steel">Free</p>
          <p className="font-display text-3xl mt-2 text-foreground">$0</p>
          <p className="text-xs text-muted-foreground">Forever · no card</p>
          <ul className="mt-4 space-y-2 text-sm text-foreground/85 flex-1">
            <Feat metal="steel">Daily check-in & streak</Feat>
            <Feat metal="steel">1 daily mission</Feat>
            <Feat metal="steel">Coach P — 5 messages/day</Feat>
            <Feat metal="steel">Plate snap preview (1/day)</Feat>
            <Feat metal="steel" muted>Trophies (view only)</Feat>
          </ul>
          {onFreePlan ? (
            <div className="h-10 mt-4 inline-flex items-center justify-center text-xs text-muted-foreground">
              Current plan
            </div>
          ) : user ? (
            <div className="h-10 mt-4" aria-hidden="true" />
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/login" as never, search: { redirect: "/app" } as never })}
              className="h-10 mt-4 w-full rounded-md border border-steel/50 text-sm font-medium text-foreground hover:bg-foreground/5 transition"
            >
              Start free
            </button>
          )}
        </article>

        {/* PRO — gold, hero card */}
        <article className="tier-card-gold p-5 flex flex-col md:-mt-2 md:mb-2 md:scale-[1.02]">
          {/* Most popular pill integrated into the gold border */}
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full text-[10px] font-semibold px-3 py-1 label-mono"
            style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
          >
            Most popular
          </div>
          <p className="label-mono inline-flex items-center gap-1 text-gold-metal">
            <Sparkles className="h-3 w-3 text-gold" /> Pro
          </p>
          {proStrike && <p className="mt-2 text-xs text-muted-foreground line-through">{proStrike}</p>}
          <div className="mt-1 flex items-baseline gap-1">
            <p className="font-display text-4xl text-foreground">{proPrice}</p>
            <p className="text-xs text-muted-foreground">{proCadence}</p>
          </div>
          {proSub && <p className="text-[11px] text-muted-foreground">{proSub}</p>}
          <ul className="mt-4 space-y-2 text-sm text-foreground/90 flex-1">
            <Feat metal="gold">Unlimited Coach P + voice</Feat>
            <Feat metal="gold">Full daily mission list</Feat>
            <Feat metal="gold">All trophies unlock</Feat>
            <Feat metal="gold">Full nutrition tracking</Feat>
            <Feat metal="gold">Voice journal & progress photos</Feat>
            <Feat metal="gold">All four traditions</Feat>
          </ul>
          <button
            onClick={() => handleChoosePlan(proPlan)}
            disabled={busy}
            className="btn-gold mt-4 min-h-11 w-full rounded-md text-sm disabled:opacity-50 px-3 py-2 leading-tight"
          >
            {loadingPlanProp === proPlan
              ? "Opening checkout…"
              : `Start your free month — then ${proPrice}${proCadence}, cancel anytime.`}
          </button>
          <p className="mt-2 text-[11px] text-center text-muted-foreground leading-snug">
            Your free month starts today. On {trialEndLabel} you'll be charged automatically unless you cancel. Cancel anytime in Settings.
          </p>
        </article>

        {/* ELITE — platinum on obsidian */}
        <article className="tier-card-platinum p-5 flex flex-col md:mt-3">
          <p className="label-mono inline-flex items-center gap-1 text-platinum">
            <Crown className="h-3 w-3" style={{ color: "var(--platinum)" }} /> Elite
          </p>
          {eliteStrike && <p className="mt-2 text-xs text-muted-foreground line-through">{eliteStrike}</p>}
          <div className="mt-1 flex items-baseline gap-1">
            <p className="font-display text-4xl text-foreground">{elitePrice}</p>
            <p className="text-xs text-muted-foreground">{eliteCadence}</p>
          </div>
          {eliteSub && <p className="text-[11px] text-muted-foreground">{eliteSub}</p>}
          <ul className="mt-4 space-y-2 text-sm text-foreground/90 flex-1">
            <Feat metal="platinum">Everything in Pro</Feat>
            <Feat metal="platinum">Advanced analytics & exports</Feat>
            <Feat metal="platinum">Priority Coach P routing</Feat>
            <Feat metal="platinum">Early access to new modules</Feat>
          </ul>
          <button
            onClick={() => handleChoosePlan(elitePlan)}
            disabled={busy}
            className="btn-platinum mt-4 h-11 w-full rounded-md text-sm disabled:opacity-50"
          >
            {loadingPlanProp === elitePlan
              ? "Opening checkout…"
              : `Start your free month — then ${elitePrice}${eliteCadence}, cancel anytime.`}
          </button>
          <p className="mt-2 text-[11px] text-center text-muted-foreground leading-snug">
            Your free month starts today. On {trialEndLabel} you'll be charged automatically unless you cancel. Cancel anytime in Settings.
          </p>
        </article>
      </div>

      {/* Course + bundle are web-only (not sold inside the iOS app). */}
      {!appleIap && <>
      {/* Course — separate, keeps gold identity */}
      <article className="tier-card-gold relative p-6 sm:p-7 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-stretch md:justify-between gap-6">
          <div className="max-w-xl flex-1">
            <p className="label-mono text-gold-metal">GO ALL IN</p>
            <h3 className="font-display text-2xl sm:text-3xl mt-1 text-foreground">
              The REBUILT Course
            </h3>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold label-mono"
              style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
            >
              Lifetime Pro included
            </div>
            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              <Feat metal="gold">Full REBUILT curriculum — every module, yours to keep</Feat>
              <Feat metal="gold">Lifetime Pro access inside the app (all future updates)</Feat>
              <Feat metal="gold">Members-only community + program drops</Feat>
              <Feat metal="gold">7-day refund guarantee</Feat>
            </ul>
            <a
              href="/course"
              className="mt-3 inline-block text-xs text-gold-metal underline hover:text-foreground"
            >
              See everything inside the course →
            </a>
          </div>

          <div className="flex flex-col gap-2 md:w-72 shrink-0">
            <div className="text-center">
              <p className="font-display text-4xl text-foreground">$497</p>
              <p className="text-[11px] text-muted-foreground">One-time · full access</p>
            </div>
            <button
              onClick={() => handleCourse("course_full")}
              disabled={busy}
              className="btn-gold h-12 w-full rounded-md text-sm font-semibold disabled:opacity-50"
            >
              {loadingPlanProp === "course_full" ? "Opening checkout…" : "Get the Course — $497"}
            </button>
            <p className="text-[10px] text-center text-gold-metal font-medium">
              Save $100 paying once
            </p>
            {bnplEnabled && (
              <p className="text-[10px] text-center text-muted-foreground leading-snug">
                Prefer payments? Affirm and Klarna available at checkout.
              </p>
            )}
            <button
              onClick={() => handleCourse("course_installment")}
              disabled={busy}
              className="h-10 w-full rounded-md border border-gold/40 text-xs font-medium text-gold hover:bg-gold/10 disabled:opacity-50 transition"
            >
              {loadingPlanProp === "course_installment" ? "Opening checkout…" : "3 × $199 ($597 total)"}
            </button>
          </div>
        </div>

        {/* Founder seal, bottom-right */}
        <div className="mt-4 flex justify-end">
          <SignatureSeal size="xs" prefix="—" opacity={0.65} />
        </div>
      </article>

      {/* Mogul Bundle — one-time, guides only */}
      <article
        id="mogul-bundle"
        className="scroll-mt-24 rounded-2xl border border-gold/30 bg-gradient-to-br from-background to-gold/[0.04] p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="max-w-md">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-gold">
              One-time
            </p>
            <h3 className="mt-2 font-display text-2xl">REBUILT Mogul Bundle</h3>
            <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
              The four Coach P playbooks on their own — no subscription, no course.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-foreground/85">
              {[
                "The Comeback Income Playbook",
                "AI Unfair Advantage 2026",
                "Build Your Brand 2026",
                "The 30-Day Launch Sprint",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-gold" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              PDFs, yours to keep. Included free with the $497 course — don't buy both.
            </p>
          </div>
          <div className="sm:w-56 shrink-0 space-y-2">
            <p className="font-display text-4xl text-center">$99</p>
            <button
              type="button"
              onClick={buyBundle}
              disabled={bundleLoading}
              className="h-11 w-full rounded-md bg-gold text-gold-foreground text-sm font-medium hover:bg-gold/90 disabled:opacity-50 transition"
            >
              {bundleLoading ? "Opening checkout…" : "Get the Bundle"}
            </button>
            <p className="text-[10px] text-center text-muted-foreground">
              One-time payment · 7-day refund
            </p>
          </div>
        </div>
      </article>
      </>}


      {/* Restore purchase */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={appleIap ? onAppleRestore : onRestore}
          disabled={busy || iapBusy !== null}
          className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
        >
          {iapBusy === "restore" ? "Restoring…" : "Restore purchases"}
        </button>
        {appleIap && (
          <p className="text-[11px] text-muted-foreground text-center max-w-sm">
            Subscriptions are billed through your Apple ID and renew automatically unless canceled at least 24 hours before the period ends. Manage or cancel in iPhone Settings › Apple ID › Subscriptions.{" "}
            <a href="/terms" className="underline">Terms</a> · <a href="/privacy" className="underline">Privacy</a>
          </p>
        )}
      </div>
    </div>
  );
}

function Feat({
  children,
  metal,
  muted = false,
}: {
  children: React.ReactNode;
  metal: Metal;
  muted?: boolean;
}) {
  const bulletColor =
    metal === "gold"
      ? "bg-gold"
      : metal === "platinum"
        ? "bg-platinum"
        : "bg-steel";
  return (
    <li className={`flex items-start gap-2 ${muted ? "text-foreground/50" : ""}`}>
      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${bulletColor}`} />
      <span>{children}</span>
    </li>
  );
}
