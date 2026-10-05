import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Copy, Check, Lock, ExternalLink, Sparkles } from "lucide-react";
import { getMemberDiscounts, type MemberDiscount } from "@/lib/member-discount.functions";

export function MemberDiscountCard({ compact = false }: { compact?: boolean }) {
  const q = useQuery({
    queryKey: ["member-discounts"],
    queryFn: () => getMemberDiscounts(),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="card-elevated p-4 animate-pulse">
        <div className="h-3 w-24 bg-foreground/10 rounded mb-3" />
        <div className="h-4 w-40 bg-foreground/10 rounded mb-2" />
        <div className="h-3 w-full bg-foreground/10 rounded" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="card-elevated p-4 text-sm text-muted-foreground">
        Couldn't load member perks.{" "}
        <button onClick={() => q.refetch()} className="text-gold underline">
          Retry
        </button>
      </div>
    );
  }

  const items = q.data?.discounts.filter((d) => d.visible) ?? [];
  if (items.length === 0) {
    return (
      <div className="card-elevated p-4 text-sm text-muted-foreground">
        No member perks available right now.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Gift className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg leading-none">Member Perks</h2>
        </div>
        <p className="text-[11px] label-mono text-muted-foreground">
          Loyalty benefit
        </p>
      </header>
      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        {items.map((d) => (
          <DiscountRow key={d.partner} d={d} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        These are loyalty discount codes. Products are sold by partners under
        their own terms. 21+ · Research use only · Not medical advice.
      </p>
    </section>
  );
}

function DiscountRow({ d }: { d: MemberDiscount }) {
  const [copied, setCopied] = useState(false);
  const isYouthful = d.partner === "youthfullab";

  async function copy() {
    if (!d.code) return;
    try {
      await navigator.clipboard.writeText(d.code);
      setCopied(true);
      toast.success(`${d.partnerLabel} code copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <article className="card-elevated p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-gold">{d.tierLabel}</p>
          <h3 className="font-display text-base mt-0.5">{d.partnerLabel}</h3>
          {isYouthful && (
            <span className="mt-1 inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] label-mono text-muted-foreground">
              21+ · Research use only
            </span>
          )}
        </div>
        {d.comingSoon ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] label-mono text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Soon
          </span>
        ) : !d.unlocked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] label-mono text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </span>
        ) : null}
      </div>
      <p className="text-sm text-foreground/90">{d.headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {d.description}
      </p>

      {d.unlocked && d.code && (
        <div className="flex items-center gap-2 rounded-md border border-foreground/15 bg-foreground/[0.03] px-3 py-2">
          <code className="font-mono text-sm tracking-wider flex-1 truncate">
            {d.code}
          </code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 text-xs label-mono text-gold hover:opacity-80"
            aria-label={`Copy ${d.partnerLabel} code`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {d.unlocked && !d.code && (
        <p className="text-[11px] text-muted-foreground">
          Code will appear here once it's set.
        </p>
      )}

      {!d.unlocked && !d.comingSoon && (
        <p className="text-[11px] text-muted-foreground">
          Active members see their code here.
        </p>
      )}

      {d.checkoutUrl && (
        <a
          href={d.checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md border border-foreground/15 text-xs label-mono text-foreground/90 hover:border-gold hover:text-gold transition"
        >
          {isYouthful ? "Open YouthfulLab site" : `Go to ${d.partnerLabel}`} <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {isYouthful && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Membership benefit only. Age gate and full disclaimers live on the YouthfulLab site.
        </p>
      )}
    </article>
  );
}

