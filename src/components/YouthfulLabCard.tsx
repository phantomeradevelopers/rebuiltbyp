import { ExternalLink, FlaskConical } from "lucide-react";
import { YOUTHFULLAB_URL } from "@/lib/peptide-library";
import { trackAffiliateClick } from "@/lib/affiliate-tracking";

/**
 * YouthfulLab USA — research / educational peptide resource.
 * Visually distinct from CandyRxCard (cool sky-blue tone) so users
 * do NOT confuse a research supplier with a licensed pharmacy.
 *
 * LANGUAGE RULE: all copy here is EDUCATIONAL only. Never imply
 * personal consumption — no "take/try/use/start/add to your protocol."
 */
export function YouthfulLabCard({
  variant = "full",
  hint,
}: {
  variant?: "full" | "compact";
  hint?: string;
}) {
  if (variant === "compact") {
    return (
      <div className="space-y-1">
        <a
          href={YOUTHFULLAB_URL}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={() => trackAffiliateClick("youthfullab", "compact_card", YOUTHFULLAB_URL)}
          className="flex items-center justify-between gap-3 rounded-md border border-sky-500/40 bg-sky-500/5 p-3 hover:bg-sky-500/10 transition"
        >
          <div className="min-w-0">
            <p className="label-mono text-sky-300 text-xs flex items-center gap-1">
              <FlaskConical className="h-3 w-3" /> Research peptides · YouthfulLab USA
            </p>
            <p className="text-sm mt-0.5 truncate">
              {hint ?? "Learn the research on BPC-157, TB-500, GHK-Cu and more"}
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-sky-300 shrink-0" />
        </a>
        <p className="text-[10px] text-sky-200/70 leading-tight px-1">
          Research use only · Not FDA-approved · REBUILT may earn a referral fee
        </p>
      </div>
    );
  }

  return (
    <section className="card-elevated p-5 space-y-4 border border-sky-500/30">
      <div>
        <p className="label-mono text-sky-300 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" /> YouthfulLab USA
        </p>
        <p className="mt-2 font-display text-xl leading-tight">
          Research the science. Source the material.
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          A curated catalog of peptides studied for healing, recovery, longevity,
          and skin health. Useful for learning what the research says.
        </p>
      </div>

      <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 space-y-1.5">
        <p className="text-[11px] text-sky-200/90 leading-snug">
          For laboratory research use only — not FDA-approved for human consumption.
        </p>
        <p className="text-[11px] text-sky-200/90 leading-snug">
          Talk to a licensed clinician before making any health decisions based on this research.
        </p>
        <p className="text-[11px] text-sky-200/90 leading-snug">
          REBUILT may earn a referral fee.
        </p>
      </div>

      <a
        href={YOUTHFULLAB_URL}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => trackAffiliateClick("youthfullab", "full_card_browse", YOUTHFULLAB_URL)}
        className="block text-center h-11 leading-[44px] rounded-md bg-sky-500 text-background text-sm font-medium hover:bg-sky-400"
      >
        Browse YouthfulLab USA →
      </a>
    </section>
  );
}
