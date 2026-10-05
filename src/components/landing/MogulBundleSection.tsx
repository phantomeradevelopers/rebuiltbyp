import { ArrowRight, Check, FileText, Sparkles } from "lucide-react";
import { useMogulBundleCheckout } from "@/hooks/useMogulBundleCheckout";


const BUNDLE_ITEMS = [
  "The Comeback Income Playbook",
  "AI Unfair Advantage 2026",
  "Build Your Brand 2026",
  "The 30-Day Launch Sprint",
];

export function MogulBundleSection() {
  const { buyBundle, loading } = useMogulBundleCheckout("/");
  return (

    <article className="mt-8 card-elevated rounded-2xl border-gold/40 bg-gradient-to-br from-background to-gold/[0.05] p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        <div className="max-w-xl">
          <p className="label-mono text-gold inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Mogul Bundle
          </p>
          <h3 className="mt-2 font-display text-3xl">$99 REBUILT Mogul Bundle</h3>
          <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
            Four playbooks. One price. Built for the comeback.
          </p>

          <ul className="mt-5 grid sm:grid-cols-2 gap-2.5">
            {BUNDLE_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground/85">
                <Check className="h-4 w-4 shrink-0 text-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-muted-foreground">
            4 digital guides by Coach P · instant delivery · yours to keep
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:w-80 shrink-0">
          <div className="flex items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-gold/10 border border-gold/30 text-gold grid place-items-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="font-display text-4xl text-foreground">$99</p>
              <p className="text-xs text-muted-foreground">one-time</p>
            </div>
          </div>
          <button
            type="button"
            onClick={buyBundle}
            disabled={loading}
            className="mt-1 h-12 w-full rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition shadow-[0_8px_30px_-6px_oklch(0.73_0.11_80/0.5)] disabled:opacity-50"
          >
            {loading ? "Opening checkout…" : (<>Get the Bundle <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            One-time payment · secure checkout · 7-day refund
          </p>

        </div>
      </div>
    </article>
  );
}
