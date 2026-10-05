import { Link } from "@tanstack/react-router";
import { MessageCircle, ArrowRight } from "lucide-react";

/**
 * Slim "Ask P" CTA. Mounted at the bottom of every primary section so users
 * always have one tap to the coach without burning a nav slot on it.
 *
 * Sits ABOVE the fixed bottom nav. Pages should still keep their existing
 * `pb-*` clearance — this just renders as the last element in the scroll area.
 */
export function AskCoachFooter({
  prompt = "Stuck? Tired? Off-track? Ask P.",
  className = "",
}: {
  prompt?: string;
  className?: string;
}) {
  return (
    <Link
      to="/app/coach"
      preload="intent"
      className={`group mt-8 flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/[0.04] p-4 min-h-16 transition-all hover:border-gold hover:bg-gold/10 active:scale-[0.99] ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid place-items-center h-10 w-10 rounded-full bg-gold/15 text-gold shrink-0">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="label-mono text-gold text-xs">Ask the coach</p>
          <p className="text-sm mt-0.5 truncate">{prompt}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-gold shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
