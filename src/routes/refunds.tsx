import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/landing/PublicFooter";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({
    meta: [
      { title: "Refund Policy — REBUILT" },
      { name: "description", content: "REBUILT refund policy and money-back guarantee." },
    ],
  }),
});

function RefundsPage() {
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
        <p className="label-mono text-gold">Refunds</p>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground">Refund Policy</h1>

        <p>
          REBUILT is operated by <strong className="text-foreground">EEE International LLC</strong>, 888 Prospect St,
          Suite 200, La Jolla, CA 92037, United States. This policy applies to every purchase made through REBUILT.
        </p>

        <H>7-day money-back guarantee on the Course</H>
        <p>
          If the <strong className="text-foreground">$497 REBUILT Course</strong> isn't the right fit, you may
          request a full refund within <strong className="text-foreground">7 days</strong> of your purchase date —
          no explanation required. The same 7-day window applies to the $99 REBUILT Mogul Bundle. Refunds are
          returned to the original payment method.
        </p>

        <H>How to request a refund — step by step</H>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Email{" "}
            <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a> within 7 days of
            your purchase.
          </li>
          <li>
            Use the subject line <strong className="text-foreground">Refund request</strong>.
          </li>
          <li>
            Include the email address you purchased with, the product name (Course or Mogul Bundle), and the
            purchase date.
          </li>
          <li>
            We reply within 1 business day and submit the refund to Stripe once approved. You do not need to call
            anyone, and you will not be put through a retention process.
          </li>
        </ol>
        <p>
          Payments are processed by our payment processor, Stripe, on behalf of EEE International LLC. Charges appear
          on your statement as <strong className="text-foreground">EEE INTL* REBUILT</strong>. Legal inquiries:{" "}
          <a href="mailto:legal@rebuiltbyp.com" className="text-foreground underline">legal@rebuiltbyp.com</a>.
        </p>

        <H>Pro and Elite subscriptions</H>
        <p>
          Pro ($14.99/month or $129/year) and Elite ($24.99/month or $219/year) start with a 30-day free trial. You
          are not charged during the trial, and we email you before the first charge and before every renewal with
          the exact amount and date.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-foreground">Cancel in one step</strong> from Settings inside the app — no phone
            call, no retention flow, no email required.
          </li>
          <li>Cancel during the trial and you are never charged.</li>
          <li>
            After a charge, cancelling stops all future charges and you keep full access through the end of the
            period you already paid for.
          </li>
          <li>We do not refund periods already billed and we do not prorate partial periods.</li>
          <li>
            If you were charged in error or by a duplicate transaction, email{" "}
            <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a> and we will
            refund it in full.
          </li>
        </ul>

        <H>What does not qualify</H>
        <ul className="list-disc pl-5 space-y-1">
          <li>One-time purchase refunds requested more than 7 days after purchase.</li>
          <li>Subscription periods that have already been billed and used.</li>
          <li>Accounts terminated for violations of our Terms &amp; Conditions.</li>
          <li>Gifted or transferred purchases, unless required by law.</li>
        </ul>

        <H>Processing time</H>
        <p>
          Approved refunds are submitted to Stripe immediately and typically appear on your statement within 5–10
          business days, depending on your bank.
        </p>


        <H>Questions</H>
        <p>
          If you have questions about refunds or billing, contact us at{" "}
          <a href="mailto:support@e2v.ai" className="text-foreground underline">support@e2v.ai</a>.
        </p>

        <p className="pt-4 text-[10px] text-center">
          Last updated: {new Date().toISOString().slice(0, 10)}.
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
