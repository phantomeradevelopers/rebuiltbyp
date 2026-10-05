import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Download, Trash2, Shield, BadgeCheck, LogOut, KeyRound, Sparkles, Utensils, CreditCard } from "lucide-react";
import { exportMyData, deleteMyAccount } from "@/lib/account.functions";
import { getAccessStatus, type AccessStatus } from "@/lib/access.functions";
import { restoreMyPurchase } from "@/lib/entitlement.functions";
import { getBillingStatus, createBillingPortalSession, type BillingStatus } from "@/lib/billing.functions";
import { PLAN_LABEL, type Plan } from "@/lib/tier";
function planPriceLabel(plan: Plan): string {
  return PLAN_LABEL[plan] ?? plan;
}
import { getFaithSettings, setFaithSettings, type FaithSettings } from "@/lib/faith.functions";
import { getMyCuisines, updateMyCuisines, CUISINE_OPTIONS } from "@/lib/taste.functions";
import { supabase } from "@/integrations/supabase/client";
import { SectionHero } from "@/components/SectionHero";
import { QuickThemeToggle } from "@/components/QuickThemeToggle";
import { VacationCard } from "@/components/VacationCard";
import { ConnectedAppsCard } from "@/components/ConnectedAppsCard";
import { AppleHealthImport } from "@/components/AppleHealthImport";
import { MemberDiscountCard } from "@/components/MemberDiscountCard";
import heroAccount from "@/assets/hero-account.jpg";

export const Route = createFileRoute("/app/account")({
  component: AccountPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function AccountPage() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    getAccessStatus().then(setAccess).catch(() => {});
    getBillingStatus().then(setBilling).catch(() => {});
  }, []);

  // Coming back from checkout: the webhook grants access a moment after the
  // redirect, so poll briefly instead of showing a stale "Free" state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") !== "success") return;
    let tries = 0;
    let done = false;
    toast.success("Payment received — unlocking your access…");
    const timer = window.setInterval(async () => {
      tries += 1;
      try {
        const next = await getAccessStatus();
        setAccess(next);
        if (next.tier !== "free" || tries >= 8) done = true;
      } catch {
        if (tries >= 8) done = true;
      }
      if (done) {
        window.clearInterval(timer);
        getBillingStatus().then(setBilling).catch(() => {});
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  async function onOpenPortal() {
    setPortalLoading(true);
    try {
      const { url } = await createBillingPortalSession();
      if (url) window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPortalLoading(false);
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" as never, replace: true });
  }

  async function onRestore() {
    setRestoring(true);
    try {
      const { entitlement } = await restoreMyPurchase();
      if (entitlement === "lifetime" || entitlement === "subscriber") {
        toast.success("Access restored.");
        const s = await getAccessStatus();
        setAccess(s);
      } else {
        toast.error("No purchase found for your email.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRestoring(false);
    }
  }


  async function onExport() {
    setExporting(true);
    try {
      const { json } = await exportMyData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rebuilt-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (confirmText !== "DELETE") { toast.error('Type DELETE to confirm.'); return; }
    if (!confirm("This permanently deletes your account and all data. Continue?")) return;
    setDeleting(true);
    try {
      await deleteMyAccount({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      navigate({ to: "/" as never, replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <SectionHero
        image={heroAccount}
        eyebrow="ACCOUNT"
        title="Your data. Your call."
        subtitle="Export it. Delete it. Style it."
      />
      <div className="px-4 sm:px-6 max-w-md mx-auto space-y-6 pb-8 -mt-2">
        <div className="flex items-center justify-between gap-2">
          <Link to="/app/settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <QuickThemeToggle />
        </div>

      <section className="card-elevated p-5 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <BadgeCheck className="h-4 w-4" />
          <p className="label-mono">Membership</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="text-foreground">{access?.email ?? "…"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {access?.entitlement === "lifetime" && (
            <span className="inline-flex items-center rounded-full bg-gold/15 text-gold border border-gold/30 px-2.5 py-0.5 text-xs font-medium">Lifetime Member</span>
          )}
          {access?.entitlement === "subscriber" && (
            <span className="inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/30 px-2.5 py-0.5 text-xs font-medium">Subscriber</span>
          )}
          {(!access || access.entitlement === "free") && (
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium">Free</span>
          )}
        </div>
        {access?.entitlementSource && (
          <p className="text-[11px] text-muted-foreground">Source: {access.entitlementSource}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={onRestore}
            disabled={restoring}
            className="h-10 rounded-md border border-border bg-card text-sm hover:bg-accent disabled:opacity-60 flex-1"
          >
            {restoring ? "Checking…" : "Restore purchase"}
          </button>
          <Link
            to={"/app/redeem" as never}
            className="h-10 rounded-md border border-gold/40 bg-card text-sm text-gold hover:bg-gold/10 inline-flex items-center justify-center gap-1.5 flex-1"
          >
            <KeyRound className="h-3.5 w-3.5" /> Redeem code
          </Link>
        </div>
        <button
          onClick={onSignOut}
          className="mt-2 h-10 w-full rounded-md border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center justify-center gap-2"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </section>

      {/* Billing / trial section */}
      <section className="card-elevated p-5 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <CreditCard className="h-4 w-4" />
          <p className="label-mono">Billing</p>
        </div>
        {!billing ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : billing.entitlement === "lifetime" ? (
          <p className="text-sm text-muted-foreground">You have lifetime access. No billing on file.</p>
        ) : billing.isTrialing ? (
          <>
            <p className="text-sm">
              <span className="text-gold font-medium">Free trial active</span>
              {billing.trialEndsAt && (
                <> · ends {new Date(billing.trialEndsAt).toLocaleDateString()}</>
              )}
              {billing.subscriptionPlan && <> · {planPriceLabel(billing.subscriptionPlan)} after</>}
            </p>
            <p className="text-xs text-muted-foreground">Cancel anytime before the trial ends and you won't be charged.</p>
            <button onClick={onOpenPortal} disabled={portalLoading} className="h-10 w-full rounded-md border border-border bg-card text-sm hover:bg-accent disabled:opacity-60">
              {portalLoading ? "Opening…" : "Manage billing"}
            </button>
          </>
        ) : billing.entitlement === "subscriber" ? (
          <>
            <p className="text-sm">
              <span className="text-primary font-medium">Member</span>
              {billing.subscriptionPlan && <> · {planPriceLabel(billing.subscriptionPlan)}</>}
            </p>
            <button onClick={onOpenPortal} disabled={portalLoading} className="h-10 w-full rounded-md border border-border bg-card text-sm hover:bg-accent disabled:opacity-60">
              {portalLoading ? "Opening…" : "Manage billing"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Unlock unlimited Coach P, voice journal, all faith traditions, and the full daily/weekly motivation system.
            </p>
            <Link
              to={"/app/upgrade" as never}
              className="h-11 w-full rounded-md bg-gradient-to-r from-gold/90 to-gold text-sm font-medium text-gold-foreground inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition"
            >
              <Sparkles className="h-3.5 w-3.5" /> Start 7-day free trial
            </Link>
          </>
        )}
      </section>

      {/* Appearance lives in Settings (More > Settings > Appearance) — removed here to avoid duplicate theme pickers. */}

      <FaithModeCard />

      <ConnectedAppsCard />

      <AppleHealthImport />


      <CuisinesCard />

      <VacationCard />







      <MemberDiscountCard />


      <section className="card-elevated p-5 space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <Download className="h-4 w-4" />
          <p className="label-mono">Export your data</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Download every check-in, meal log, journal, message, and profile field
          as a single JSON file.
        </p>
        <button onClick={onExport} disabled={exporting} className="h-11 w-full rounded-md border border-gold/40 text-sm text-gold hover:bg-gold/5 disabled:opacity-60">
          {exporting ? "Preparing…" : "Download export"}
        </button>
      </section>

      <section id="delete-account" className="card-elevated p-5 space-y-3 border-destructive/40 scroll-mt-20">
        <div className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          <p className="label-mono">Delete account</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently removes your account, logs, photos, and voice journals.
          This cannot be undone. If you subscribed through the App Store, also cancel
          in iPhone Settings › Apple ID › Subscriptions so Apple stops billing.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type DELETE to confirm'
          className="w-full h-11 rounded-md border border-border bg-input px-3 text-sm focus:border-destructive focus:outline-none"
        />
        <button onClick={onDelete} disabled={deleting || confirmText !== "DELETE"} className="h-11 w-full rounded-md bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-40">
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground flex gap-2">
        <Shield className="h-4 w-4 text-gold shrink-0 mt-0.5" />
        <p>We comply with GDPR / CCPA. Export and deletion are available at any time, no questions asked.</p>
      </section>
      </div>
    </div>
  );
}

// Tradition options moved to /app/spirit (single source of truth).

function FaithModeCard() {
  const [settings, setSettings] = useState<FaithSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFaithSettings().then(setSettings).catch(() => {});
  }, []);

  async function update(patch: Partial<FaithSettings>) {
    setBusy(true);
    try {
      await setFaithSettings({ data: patch });
      setSettings((s) => (s ? { ...s, ...patch } : s));
      toast.success("Saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return null;

  return (
    <section className="card-elevated p-5 space-y-3">
      <div className="flex items-center gap-2 text-gold">
        <Sparkles className="h-4 w-4" />
        <p className="label-mono">Faith Mode</p>
      </div>
      <p className="text-sm text-muted-foreground">
        When on, your daily motivation, anchors, and coaching tone draw from your chosen tradition. When off, guidance stays secular.
      </p>
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-sm">Faith Mode</span>
        <button
          disabled={busy}
          onClick={() => update({ faith_mode_enabled: !settings.faith_mode_enabled })}
          className={`relative h-6 w-11 rounded-full transition ${settings.faith_mode_enabled ? "bg-gold" : "bg-muted"}`}
          aria-pressed={settings.faith_mode_enabled}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition ${settings.faith_mode_enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </label>
      {settings.faith_mode_enabled && (
        <div>
          <p className="label-mono text-xs text-muted-foreground mb-2">Tradition</p>
          <p className="text-xs text-muted-foreground">
            Current: <span className="text-foreground capitalize">{settings.tradition}</span>
          </p>
          <Link
            to={"/app/spirit" as never}
            className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline"
          >
            Change tradition in Spirit →
          </Link>
        </div>
      )}
    </section>
  );
}

function CuisinesCard() {
  const [cuisines, setCuisines] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyCuisines().then(({ cuisines }) => setCuisines(cuisines)).catch(() => setCuisines([]));
  }, []);

  function toggle(c: string) {
    if (!cuisines) return;
    setCuisines(cuisines.includes(c) ? cuisines.filter((x) => x !== c) : [...cuisines, c].slice(0, 20));
  }

  async function save() {
    if (!cuisines) return;
    setBusy(true);
    try {
      await updateMyCuisines({ data: { cuisines } });
      toast.success("Cuisines updated.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated p-5 space-y-3">
      <div className="flex items-center gap-2 text-gold">
        <Utensils className="h-4 w-4" />
        <p className="label-mono">Taste preferences</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Update the cuisines we plan your meals around.
      </p>
      {cuisines === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map((c) => {
              const on = cuisines.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  className={`h-9 px-3 rounded-full border text-xs font-medium transition ${on ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <button
            onClick={save}
            disabled={busy}
            className="h-11 w-full rounded-md border border-gold/40 text-sm text-gold hover:bg-gold/5 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save cuisines"}
          </button>
        </>
      )}
    </section>
  );
}

