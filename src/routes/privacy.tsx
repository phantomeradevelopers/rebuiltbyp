import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/landing/PublicFooter";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Notice — REBUILT" },
      { name: "description", content: "REBUILT privacy notice and data practices." },
    ],
  }),
});

function PrivacyPage() {
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
        <p className="label-mono text-gold">Privacy</p>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground">Privacy Notice</h1>

        <H>Who we are</H>
        <p>
          This Privacy Notice is provided by <strong className="text-foreground">Phantom Era LLC</strong>, 888
          Prospect St, Suite 200, La Jolla, CA 92037, United States ("we", "us", "REBUILT"). We are the data
          controller for the personal data collected through the REBUILT app and website. Privacy and legal
          inquiries:{" "}
          <a href="mailto:legal@rebuiltbyp.com" className="text-foreground underline">legal@rebuiltbyp.com</a>.
        </p>

        <H>What we collect</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account information: name, email address, and authentication details.</li>
          <li>Profile and usage data: goals, check-ins, missions completed, streaks, and app preferences.</li>
          <li>Device and log data: IP address, device type, operating system, and crash logs.</li>
          <li>Communications: support messages and feedback you send us.</li>
          <li>Optional health and wellness data: progress photos, journal entries, nutrition notes, and lab values you choose to log.</li>
        </ul>

        <H>How we use it</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide, operate, and improve the REBUILT coaching experience.</li>
          <li>To personalize daily missions, coaching messages, and recommendations.</li>
          <li>To maintain account security and prevent fraud or abuse.</li>
          <li>To send service-related emails and, where permitted, product updates.</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <H>Legal basis</H>
        <p>
          We process data based on: performance of a contract (providing the service), legitimate interests
          (security and improvement), consent (optional features and marketing), and legal obligation.
        </p>

        <H>Processors we disclose data to</H>
        <p>
          We do not sell your personal data. We share it only with the processors we need to run the service, each
          under a contract that limits them to our instructions:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-foreground">Stripe</strong> — our payment processor. Stripe handles card
            payments, subscriptions, and tax on our behalf and receives your name, email, and payment details. We
            never see or store your full card number. Stripe's own privacy notice governs its processing.
          </li>
          <li>
            <strong className="text-foreground">Supabase</strong> — application database, authentication, and file
            storage.
          </li>
          <li>
            <strong className="text-foreground">Resend</strong> — transactional and lifecycle email delivery.
          </li>
          <li>
            <strong className="text-foreground">AI model providers</strong> — process coaching prompts to generate
            plans and Coach P replies. We do not send them your payment details.
          </li>
          <li>Professional advisers, and authorities where required by law or to protect our rights.</li>
        </ul>

        <H>International transfers</H>
        <p>
          Some processors may handle data outside your country. Where this applies, we rely on appropriate
          safeguards such as standard contractual clauses or adequacy decisions.
        </p>

        <H>Data retention</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account and profile data: kept while your account is active, then deleted within 30 days of deletion request or account closure.</li>
          <li>Coaching content you create (check-ins, journals, photos, nutrition logs): deleted with your account.</li>
          <li>Billing and transaction records: retained up to 7 years where tax and accounting law requires it.</li>
          <li>Support messages: up to 24 months.</li>
          <li>Device and log data: up to 12 months.</li>
        </ul>

        <H>Your rights</H>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, restrict, or port your data,
          to object to certain processing, and to withdraw consent. California residents may also request details of
          the categories of personal information collected and disclosed, and are protected from discrimination for
          exercising these rights.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-foreground">Access / export:</strong> Settings → Account → Export my data
            downloads a copy of your data immediately.
          </li>
          <li>
            <strong className="text-foreground">Deletion:</strong> Settings → Account → Delete account permanently
            removes your account and content. You can also email us and we will complete the deletion within 30
            days.
          </li>
          <li>
            Any other request: email{" "}
            <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a> and we respond
            within 30 days.
          </li>
        </ul>

        <H>Security</H>
        <p>
          We use encryption in transit and at rest, row-level access controls scoped to your account, and other
          technical and organizational measures to protect your data. No system is completely secure; please keep
          your credentials safe.
        </p>


        <H>Cookies</H>
        <p>
          We use essential cookies to keep you signed in and secure. We may use analytics cookies to understand
          how the app is used. You can manage cookie preferences through your browser settings.
        </p>

        <H>Children</H>
        <p>
          REBUILT is not intended for users under 18. We do not knowingly collect data from children.
        </p>

        <H>Changes to this notice</H>
        <p>
          We may update this Privacy Notice. Material changes will be posted in the app or sent by email.
          Continued use after changes means you accept the updated notice.
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
