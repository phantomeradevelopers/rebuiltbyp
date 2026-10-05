import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Stethoscope, Handshake } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/landing/PublicFooter";


export const Route = createFileRoute("/legal")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "Legal — REBUILT" },
      {
        name: "description",
        content:
          "REBUILT medical disclaimer, affiliate disclosure, and terms of use.",
      },
    ],
  }),
});

type Tab = "medical" | "affiliate";

function LegalPage() {
  const [tab, setTab] = useState<Tab>("medical");

  return (
    <main className="min-h-screen bg-background px-6 pt-safe pb-16">
      <header className="max-w-2xl mx-auto pt-6 flex items-center justify-between">
        <Logo />
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to app
        </Link>
      </header>

      <div className="max-w-2xl mx-auto mt-8">
        <p className="label-mono text-gold">Legal</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">The fine print, in plain English.</h1>

        <div className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-md border border-border bg-card">
          <TabBtn active={tab === "medical"} onClick={() => setTab("medical")}>
            <Stethoscope className="h-3.5 w-3.5" /> Medical
          </TabBtn>
          <TabBtn active={tab === "affiliate"} onClick={() => setTab("affiliate")}>
            <Handshake className="h-3.5 w-3.5" /> Affiliate
          </TabBtn>
        </div>

        <article className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
          {tab === "medical" && <MedicalDisclaimer />}
          {tab === "affiliate" && <AffiliateDisclosure />}
        </article>

        <div className="mt-8 flex flex-wrap gap-3 text-xs">
          <Link to="/privacy" className="px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 transition">Privacy Notice</Link>
          <Link to="/terms" className="px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 transition">Terms & Conditions</Link>
          <Link to="/refunds" className="px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 transition">Refund Policy</Link>
        </div>

        <p className="mt-10 text-[11px] text-center text-muted-foreground">
          REBUILT is operated by <strong className="text-foreground">EEE International LLC</strong>, 888 Prospect St,
          Suite 200, La Jolla, CA 92037, United States.
        </p>
        <p className="mt-3 text-[10px] text-center text-muted-foreground">
          Our Terms &amp; Conditions, Privacy Notice, and Refund Policy live on the pages linked above. Questions?{" "}
          <a href="mailto:support@e2v.ai" className="underline">support@e2v.ai</a> ·{" "}
          <a href="mailto:legal@rebuiltbyp.com" className="underline">legal@rebuiltbyp.com</a>
        </p>


        <PublicFooter />
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-10 inline-flex items-center justify-center gap-1.5 rounded text-xs label-mono transition-colors ${
        active ? "bg-background text-gold" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mt-6 first:mt-0">{children}</h2>;
}

function MedicalDisclaimer() {
  return (
    <>
      <H>Medical disclaimer</H>
      <p>
        REBUILT, Playboy P, and any content delivered through this app
        (training plans, nutrition plans, AI coach replies, daily messages,
        peptide education, and product references) is provided for
        general wellness, education, and motivational purposes only. It is
        <strong className="text-foreground"> not medical advice</strong>,
        not a diagnosis, and not a substitute for evaluation, treatment,
        or care by a licensed physician, registered dietitian, mental-health
        professional, or other qualified provider.
      </p>
      <p>
        Always consult a licensed clinician before starting, stopping,
        or changing any diet, exercise routine, supplement, peptide,
        hormone, or prescription medication — especially if you have a
        medical condition, take other medications, are pregnant or
        nursing, or are under 18.
      </p>
      <p>
        Statements about peptides, supplements, hormones, or "wellness"
        products in this app have <strong className="text-foreground">not
        been evaluated by the U.S. Food and Drug Administration</strong>.
        Nothing in this app is intended to diagnose, treat, cure, or
        prevent any disease.
      </p>
      <p>
        If you experience chest pain, suicidal thoughts, an active eating
        disorder, severe injury, or any other medical emergency, stop
        using the app and call your local emergency services. In the
        United States you can also call or text 988 for the Suicide and
        Crisis Lifeline.
      </p>
      <p>
        You must be <strong className="text-foreground">18 years or older</strong> to use REBUILT.
      </p>
    </>
  );
}

function AffiliateDisclosure() {
  return (
    <>
      <H>Affiliate disclosure</H>
      <p>
        REBUILT has commercial relationships with the following partners,
        and we may earn a referral fee when you use codes or links from
        the app to make a purchase. This does not change the price you pay.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-foreground">CandyRx</strong> —
          a licensed telehealth and pharmacy partner. Prescriptions are
          written by their clinicians, not by Playboy P or REBUILT.
          Discount code <span className="font-mono text-gold">PLAYBOYP15</span>.
        </li>
        <li>
          <strong className="text-foreground">YouthfulLab USA</strong> —
          a peptide supplier featured in our Peptide Education hub.
          REBUILT does not test, manufacture, or distribute their products
          and makes no representation about purity, efficacy, or
          appropriateness for any individual.
        </li>
      </ul>
      <p>
        These relationships do not influence the safety guardrails inside
        the app. Anything that requires a prescription is routed to
        licensed clinicians, never directly to a research supplier.
      </p>
      <p>
        Outbound affiliate links are tagged with{" "}
        <code className="text-foreground">rel="sponsored"</code> in accordance
        with FTC guidance and search-engine best practices.
      </p>
    </>
  );
}
