import { Link } from "@tanstack/react-router";
import { Sparkles, X, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Plan } from "@/lib/tier";
import { recordUpgradeDismissed } from "@/lib/upgrade-dismiss";

export { isUpgradeDismissed, recordUpgradeDismissed } from "@/lib/upgrade-dismiss";

export function UpgradeSheet({
  open,
  onOpenChange,
  feature,
  title,
  description,
  unlocks,
  defaultPlan = "pro_annual",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature: string;
  title: string;
  description: string;
  /** Optional list of what Pro unlocks — honest, real features only. */
  unlocks?: string[];
  defaultPlan?: Plan;
}) {
  function dismiss() {
    recordUpgradeDismissed(feature);
    onOpenChange(false);
  }
  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(v) : dismiss())}>
      <SheetContent side="bottom" className="bg-background border-t border-gold/30 rounded-t-2xl px-5 pt-5 pb-7">
        <SheetHeader>
          <div className="flex items-center gap-2 text-gold">
            <Sparkles className="h-4 w-4" />
            <p className="label-mono text-xs">PRO FEATURE</p>
          </div>
          <SheetTitle className="font-display text-xl mt-1 text-left">{title}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground text-left">
            {description}
          </SheetDescription>
        </SheetHeader>

        {unlocks && unlocks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {unlocks.map((u) => (
              <li key={u} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <span className="text-foreground/90">{u}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-2">
          <Link
            to={"/app/upgrade" as never}
            search={{ feature, plan: defaultPlan } as never}
            onClick={() => onOpenChange(false)}
            className="h-12 w-full rounded-md bg-gradient-to-r from-gold/90 to-gold text-sm font-medium text-gold-foreground inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition"
          >
            See plans — start with annual Pro
          </Link>
          <button
            onClick={dismiss}
            className="h-10 w-full rounded-md text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Not now — don't ask again this week
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
