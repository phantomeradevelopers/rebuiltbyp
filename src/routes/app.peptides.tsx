import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { ChevronLeft, FlaskConical, ShieldAlert, Stethoscope } from "lucide-react";
import { CandyRxCard } from "@/components/CandyRxCard";
import { YouthfulLabCard } from "@/components/YouthfulLabCard";
import { MedicalEducationalBanner } from "@/components/MedicalEducationalBanner";
import { PEPTIDE_CATEGORIES, YOUTHFULLAB_URL } from "@/lib/peptide-library";
import { candyRxUrl } from "@/lib/candyrx";


export const Route = createFileRoute("/app/peptides")({
  component: PeptideHub,
  head: () => ({
    meta: [
      { title: "Peptide Education — REBUILT" },
      {
        name: "description",
        content:
          "Plain-English education on peptide categories used for recovery, longevity, and metabolic health. Not medical advice.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function PeptideHub() {
  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto pb-32 space-y-6">
      <MedicalEducationalBanner />
      <header>
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> More
        </Link>
        <p className="label-mono text-gold flex items-center gap-1.5">
          <FlaskConical className="h-3 w-3" /> Education
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">Peptides 101.</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          A neutral overview of what peptides are and the categories people ask P about most.
          This page does not give doses, cycles, or protocols. Anything you put in your
          body is a conversation with a licensed clinician.
        </p>
      </header>

      {/* What peptides are */}
      <section className="card-elevated p-5 space-y-2">
        <p className="label-mono text-gold">What is a peptide?</p>
        <p className="text-sm leading-relaxed">
          A peptide is a short chain of amino acids — a small protein fragment. Your body
          already makes thousands of them. Some are signaling molecules: they tell cells
          to heal, release hormones, regulate appetite, or repair tissue. Synthesized
          versions of those signals are what people mean when they say "peptides" in a
          wellness context. They are not steroids and they are not the same as hormones.
        </p>
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <p className="label-mono text-gold">Categories</p>
        {PEPTIDE_CATEGORIES.map((cat) => (
          <article
            key={cat.id}
            className="card-elevated p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg leading-tight">{cat.title}</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {cat.blurb}
                </p>
              </div>
              <span
                className={`label-mono text-xs shrink-0 px-2 py-1 rounded border ${
                  cat.access === "prescription_only"
                    ? "border-gold/50 text-gold bg-gold/5"
                    : "border-sky-500/40 text-sky-300 bg-sky-500/5"
                }`}
              >
                {cat.access === "prescription_only"
                  ? "Prescription — through licensed providers"
                  : "Research use"}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cat.examples.map((e) => (
                <span
                  key={e}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background/40 text-muted-foreground"
                >
                  {e}
                </span>
              ))}
            </div>

            {cat.note && (
              <p className="text-[11px] text-foreground/70">{cat.note}</p>
            )}

            <div className="pt-1 space-y-2">
              {cat.access === "prescription_only" ? (
                <>
                  <p className="text-[11px] flex items-start gap-1.5 text-gold">
                    <Stethoscope className="h-3 w-3 mt-0.5 shrink-0" />
                    Prescription only. Requires labs and a licensed prescriber.
                  </p>
                  <a
                    href={candyRxUrl("/products", `peptide_hub_${cat.id}`)}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="block rounded-md border border-gold/40 bg-gold/5 p-2.5 hover:bg-gold/10 transition"
                  >
                    <p className="text-[11px] flex items-start gap-1.5 text-gold font-medium">
                      <Stethoscope className="h-3 w-3 mt-0.5 shrink-0" />
                      Ask a licensed provider at CandyRx →
                    </p>
                    {cat.candyrx && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {cat.candyrx.examples.join(" · ")}
                      </p>
                    )}
                  </a>
                </>
              ) : (
                <>
                  <p className="text-[11px] flex items-start gap-1.5 text-sky-300">
                    <FlaskConical className="h-3 w-3 mt-0.5 shrink-0" />
                    Research use only. Sold by research suppliers — not FDA-approved for human use. Talk to a clinician before anything.
                  </p>
                  <a
                    href={YOUTHFULLAB_URL}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="block rounded-md border border-sky-500/40 bg-sky-500/5 p-2.5 hover:bg-sky-500/10 transition"
                  >
                    <p className="text-[11px] flex items-start gap-1.5 text-sky-300 font-medium">
                      <FlaskConical className="h-3 w-3 mt-0.5 shrink-0" />
                      Shop research material at YouthfulLab USA →
                    </p>
                  </a>

                  {cat.candyrx && (
                    <a
                      href={candyRxUrl("/products", `peptide_hub_${cat.id}_rx`)}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className="block rounded-md border border-gold/40 bg-gold/5 p-2.5 hover:bg-gold/10 transition"
                    >
                      <p className="text-[11px] flex items-start gap-1.5 text-gold font-medium">
                        <Stethoscope className="h-3 w-3 mt-0.5 shrink-0" />
                        Prescription versions at CandyRx →
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {cat.candyrx.examples.join(" · ")}
                      </p>
                    </a>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* How to think about quality */}
      <section className="card-elevated p-5 space-y-2">
        <p className="label-mono text-gold">How to think about quality</p>
        <ul className="text-sm space-y-2 leading-relaxed list-disc pl-5 text-muted-foreground">
          <li>Look for third-party purity testing (HPLC, mass spec) and a public Certificate of Analysis.</li>
          <li>"Research use only" is not marketing fluff — it's a regulatory category.</li>
          <li>Compounded prescription versions are made in licensed 503A/503B pharmacies and shipped by clinicians.</li>
          <li>Cheap = a red flag. Real peptides are expensive to synthesize correctly.</li>
        </ul>
      </section>

      {/* What this page is NOT */}
      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
        <p className="label-mono text-destructive flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3" /> What this page is not
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Not a prescription. Not dosing guidance. Not a recommendation to self-administer
          anything. REBUILT and Playboy P are coaching, not medical care. If you want to
          learn more about any of these compounds, a licensed clinician is the right
          starting point — especially if you are on other medications or have a medical
          condition.
        </p>
      </section>

      {/* CTAs — clearly separated */}
      <div className="space-y-3">
        <p className="label-mono text-gold">Where to go next</p>
        <CandyRxCard />
        <YouthfulLabCard />
      </div>

      <p className="text-xs text-center text-muted-foreground">
        <Link to="/legal" className="underline hover:text-foreground">
          Medical disclaimer · Affiliate disclosure · Terms
        </Link>
      </p>
    </div>
  );
}
