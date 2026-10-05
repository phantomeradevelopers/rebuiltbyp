import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  /** Small gold mono eyebrow above the title. */
  eyebrow: string;
  /** Big display title. */
  title: string;
  /** Optional supporting copy. */
  subtitle?: string;
  /** Optional back-link target — renders the chevron arrow when set. */
  backTo?: string;
  /** Optional label for the back link. */
  backLabel?: string;
  /** Optional slot rendered to the right of the title (e.g. an icon button). */
  trailing?: React.ReactNode;
}

/**
 * REBUILT v2 page header. Consistent eyebrow + headline + subtitle.
 * Replaces the old SectionHero image hero across Train / Fuel / Coach / Course.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  trailing,
}: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {backTo && (
        <Link
          to={backTo as never}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.16em] text-[color:var(--text-tertiary)] hover:text-[color:var(--rebuilt-gold)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)] font-semibold">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[color:var(--text-primary)] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-[color:var(--text-secondary)] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </header>
  );
}
