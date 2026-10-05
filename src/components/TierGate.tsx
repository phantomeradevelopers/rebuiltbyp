import { useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { hasTier, type Tier } from "@/lib/tier";

/**
 * Gates a region of UI behind a minimum tier. When the user has access,
 * renders children. Otherwise renders a locked card that opens the
 * UpgradeSheet on tap.
 *
 * Note: server-side enforcement (DB triggers, RLS, server fns) is the
 * source of truth. This is the visual gate.
 */
export function TierGate({
  currentTier,
  minTier = "pro",
  feature,
  title,
  description,
  children,
  mode = "card",
}: {
  currentTier: Tier | undefined | null;
  minTier?: Tier;
  feature: string;
  title: string;
  description: string;
  children: ReactNode;
  /** card: render upgrade card. overlay: render children blurred with a tap-to-upgrade overlay. */
  mode?: "card" | "overlay";
}) {
  const [open, setOpen] = useState(false);
  const unlocked = hasTier(currentTier, minTier);
  if (unlocked) return <>{children}</>;

  if (mode === "overlay") {
    return (
      <>
        <div className="relative">
          <div aria-hidden className="pointer-events-none blur-sm opacity-60 select-none">
            {children}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-[1px] hover:bg-background/55 transition"
          >
            <div className="rounded-full bg-gold/15 border border-gold/40 px-3 py-1 inline-flex items-center gap-1.5 text-gold">
              <Lock className="h-3.5 w-3.5" />
              <span className="label-mono text-[11px]">Unlock with Pro</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-[24ch] text-center">{title}</p>
          </button>
        </div>
        <UpgradeSheet open={open} onOpenChange={setOpen} feature={feature} title={title} description={description} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left card-elevated p-5 space-y-3 border-gold/30 hover:border-gold/60 transition"
      >
        <div className="flex items-center gap-2 text-gold">
          <Lock className="h-4 w-4" />
          <p className="label-mono">Pro feature</p>
        </div>
        <h3 className="font-display text-lg text-[color:var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[color:var(--text-secondary)]">{description}</p>
        <div className="h-11 w-full rounded-md bg-gradient-to-r from-gold/90 to-gold text-sm font-semibold text-[color:var(--gold-foreground)] inline-flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Unlock with Pro
        </div>
      </button>
      <UpgradeSheet open={open} onOpenChange={setOpen} feature={feature} title={title} description={description} />
    </>
  );
}
