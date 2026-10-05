import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Sparkles } from "lucide-react";
import { ConsultCard } from "@/components/ConsultCard";
import { CandyRxCard } from "@/components/CandyRxCard";

export function MoreForYouCard() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card-elevated p-5 animate-count-up" style={{ animationDelay: "320ms" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> More for you
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Consults, pharmacy, peptides, nutrition library.
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gold shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <ConsultCard variant="hero" />
          <CandyRxCard variant="compact" />
          <Link
            to="/app/peptides"
            className="flex items-center justify-between gap-3 rounded-md border border-sky-500/40 bg-sky-500/5 p-3 hover:bg-sky-500/10 transition"
          >
            <div className="min-w-0">
              <p className="label-mono text-sky-300 text-xs">Peptide education</p>
              <p className="text-sm mt-0.5 truncate">
                Learn what BPC-157, GLP-1s & co. actually do.
              </p>
            </div>
            <span className="text-sky-300 shrink-0 text-sm">→</span>
          </Link>
          <Link
            to="/app/nutrition"
            className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 hover:bg-emerald-500/10 transition"
          >
            <div className="min-w-0">
              <p className="label-mono text-emerald-300 text-xs">Nutrition Academy</p>
              <p className="text-sm mt-0.5 truncate">
                Browse foods, read short lessons, eat with intent.
              </p>
            </div>
            <span className="text-emerald-300 shrink-0 text-sm">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
