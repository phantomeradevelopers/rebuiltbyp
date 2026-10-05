import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/landing/PublicFooter";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — REBUILT" },
      { name: "description", content: "REBUILT terms and conditions of use." },
    ],
  }),
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 pt-safe pb-16">
      <header className="max-w-2xl mx-auto pt-6 flex items-center justify-between">
        <Logo />
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Home
        </Link>
      </header>

      <article className="max-w-2xl mx-auto mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p className="label-mono text-gold">Terms</p>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground">Terms & Conditions</h1>

        <H>Who you are contracting with</H>
        <p>
          REBUILT is operated by{" "}
          <strong className="text-foreground">Phantom Era LLC</strong>, 888 Prospect St, Suite 200,
          La Jolla, CA 92037, United States ("we", "us", "REBUILT"). These Terms &amp; Conditions are a legal
          agreement between you and Phantom Era LLC, the operator of REBUILT and the App Store seller of the REBUILT by P app. By creating an account, accessing, or using REBUILT, you agree
          to be bound by these terms. If you do not agree, do not use the app.
        </p>
        <p>
          Legal inquiries:{" "}
          <a href="mailto:legal@rebuiltbyp.com" className="text-foreground underline">legal@rebuiltbyp.com</a>.
          Support:{" "}
          <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a>.
        </p>

        <H>Eligibility</H>
        <p>
          You must be at least <strong className="text-foreground">18 years old</strong> and capable of forming a binding contract in your jurisdiction.
          You represent that all information you provide is accurate and complete.
        </p>

        <H>What REBUILT provides</H>
        <p>
          REBUILT is a coaching, education, fitness, nutrition, and accountability platform. It is not a medical service,
          healthcare provider, pharmacy, or substitute for professional advice. AI-generated plans and coach messages are starting points,
          not prescriptions.
        </p>

        <H>Acceptable use</H>
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use REBUILT for any unlawful, fraudulent, or abusive purpose.</li>
          <li>Resell, redistribute, reverse engineer, or attempt to extract our source code or prompts.</li>
          <li>Scrape, automate, or overload the platform.</li>
          <li>Use the app to seek unauthorized dosing, prescription, or medical guidance.</li>
          <li>Impersonate another person or misrepresent your identity.</li>
          <li>Upload content that infringes intellectual property or violates the rights of others.</li>
        </ul>

        <H>Accounts and security</H>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.
          Notify us immediately of any unauthorized use.
        </p>

        <H>Intellectual property</H>
        <p>
          REBUILT and all content, software, branding, and materials in the app are owned by us or our licensors and are protected by
          intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to use the app for personal,
          non-commercial purposes during your subscription.
        </p>

        <H>Payment, subscriptions, cancellation, and billing</H>
        <p>
          REBUILT is operated by <strong className="text-foreground">Phantom Era LLC</strong>. Purchases made inside
          the iOS app are billed by Apple through your Apple ID and managed in your iPhone settings. Purchases made on
          our website are processed by Stripe through our billing affiliate EEE International LLC; those charges appear
          on your statement as <strong className="text-foreground">EEE INTL* REBUILT</strong>. All prices are in US
          dollars, and applicable sales tax is calculated at checkout. We do not store your full card details.
        </p>
        <p>Current prices:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>REBUILT Pro — $14.99 per month or $129 per year, after a 30-day free trial.</li>
          <li>REBUILT Elite — $24.99 per month or $219 per year, after a 30-day free trial.</li>
          <li>REBUILT Course — $497 one-time (or 3 payments of $199), including lifetime Pro access.</li>
          <li>REBUILT Mogul Bundle — $99 one-time.</li>
        </ul>
        <p>
          Paid plans renew automatically at the interval you selected (monthly or annual) at the price shown at
          checkout, until cancelled. Where a free trial is offered, billing begins automatically at the end of the
          trial unless you cancel before it ends. Before your first charge and before each renewal we email you the
          exact amount and the exact date it will be charged. You affirmatively consent to these renewal terms at
          checkout, and we keep a record of that consent.
        </p>
        <p>
          <strong className="text-foreground">You can cancel at any time in one step</strong> — from Settings inside
          the app. No phone call, no retention call, and no email is required. You may also email{" "}
          <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a>. Cancellation stops
          all future charges; you keep access until the end of the billing period you already paid for. We do not
          refund periods already billed and we do not prorate.
        </p>

        <H>Refund policy</H>
        <p>
          One-time purchases — the $497 Course and the $99 Mogul Bundle — carry a 7-day money-back guarantee.
          Subscriptions can be cancelled at any time and are not refunded for periods already billed. See our{" "}
          <Link to="/refunds" className="text-foreground underline">Refund Policy</Link> for the exact steps.
        </p>



        <H>Third-party partners</H>
        <p>
          Links to CandyRx, YouthfulLab USA, and other partners are governed by their own terms and privacy practices.
          We may earn referral fees through affiliate relationships; this does not change the price you pay.
        </p>

        <H>Termination and suspension</H>
        <p>
          We may suspend or terminate your access for material breach, non-payment, fraud, security risk, or repeated or serious policy violations.
          You may cancel your subscription at any time through your billing portal.
        </p>

        <H>Disclaimer of warranties</H>
        <p>
          REBUILT is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability,
          fitness for a particular purpose, or non-infringement.
        </p>

        <H>Limitation of liability</H>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages,
          or any loss of profits, revenue, data, or goodwill arising from your use of the app. Our aggregate liability is capped at the fees
          you paid in the 12 months preceding the claim.
        </p>

        <H>Governing law and disputes</H>
        <p>
          These terms are governed by the laws of the State of Delaware, without regard to conflict-of-laws rules. Any dispute will be resolved
          by binding individual arbitration, and class actions and jury trials are waived to the extent permitted by law.
        </p>

        <H>Changes</H>
        <p>
          We may update these terms. Material changes will be surfaced in the app. Continued use after changes means you accept the updated terms.
        </p>

        <p className="pt-4 text-[10px] text-center">
          Last updated: {new Date().toISOString().slice(0, 10)}. Questions? Contact{" "}
          <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a>.
        </p>
      </article>

      <div className="max-w-2xl mx-auto">
        <PublicFooter />
      </div>
    </main>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mt-6 first:mt-0">{children}</h2>;
}
