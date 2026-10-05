import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Check, FileText, BookOpen, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { ALL_BONUSES } from "@/lib/mogul-bonuses";

export const Route = createFileRoute("/course")({
  component: CoursePage,
  head: () => ({
    meta: [
      { title: "The REBUILT Course — What's Inside | $497" },
      {
        name: "description",
        content:
          "Everything included in the $497 REBUILT Course: lifetime Pro access, the Nutrition Academy lessons, five downloadable guides, and a 7-day refund.",
      },
      { property: "og:title", content: "The REBUILT Course — What's Inside" },
      {
        property: "og:description",
        content:
          "Lifetime Pro access, the Nutrition Academy, five Coach P guides. $497 once, or 3 × $199 ($597 total). 7-day refund.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** The written lessons that ship in the app's Nutrition Academy today. */
const LESSONS = [
  {
    title: "Does protein timing actually matter?",
    summary: "Spoiler: total daily intake matters more than the 30-minute window.",
    minutes: 3,
  },
  {
    title: "What fiber actually does",
    summary:
      "It's not just for digestion — fiber controls hunger, blood sugar, and cholesterol.",
    minutes: 3,
  },
  {
    title: "Why calories aren't all equal",
    summary:
      "A calorie is a calorie thermodynamically. But the food it's in changes everything else.",
    minutes: 3,
  },
  {
    title: "How to read a nutrition label in 10 seconds",
    summary: "You don't need to read the whole thing. Three numbers matter.",
    minutes: 2,
  },
  {
    title: "Alcohol and recovery: the honest math",
    summary: "You can drink and still progress. But know the cost.",
    minutes: 3,
  },
  {
    title: "How much water you actually need",
    summary: "The 8 glasses a day rule is invented. Here's the real target.",
    minutes: 2,
  },
];

const TOTAL_MINUTES = LESSONS.reduce((n, l) => n + l.minutes, 0);

const PRO_ACCESS = [
  "Unlimited Coach P, including voice",
  "The full daily mission list, not just one",
  "Full nutrition tracking and unlimited plate snaps",
  "Voice journal and progress photos",
  "All four traditions and every trophy unlocked",
  "Every future update, at no extra cost",
];

function CoursePage() {
  return (
    <main className="min-h-screen bg-background px-6 pt-safe pb-16">
      <header className="max-w-3xl mx-auto pt-6 flex items-center justify-between">
        <Logo />
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Home
        </Link>
      </header>

      <div className="max-w-3xl mx-auto mt-10 space-y-12">
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-gold">
            The REBUILT Course · $497
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl leading-tight">
            Everything you get for $497
          </h1>
          <p className="mt-4 text-base text-foreground/80 leading-relaxed">
            One payment, no subscription. You get lifetime Pro access to the REBUILT
            app, the written Nutrition Academy, and all five Coach P guides as
            downloadable PDFs. It is self-paced and lives inside the app — there are
            no live calls and no scheduled cohort.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
              <BookOpen className="h-3.5 w-3.5 text-gold" /> {LESSONS.length} written
              lessons
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
              <FileText className="h-3.5 w-3.5 text-gold" /> {ALL_BONUSES.length}{" "}
              downloadable guides
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-gold" /> ~{TOTAL_MINUTES} min of
              reading, then daily practice
            </span>
          </div>
        </section>

        {/* Module 1 */}
        <section>
          <h2 className="font-display text-2xl">Module 1 — Lifetime Pro access</h2>
          <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
            The core of the course is the app itself, unlocked permanently. This is
            the same Pro tier that otherwise costs $14.99 a month.
          </p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
            {PRO_ACCESS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Module 2 */}
        <section>
          <h2 className="font-display text-2xl">Module 2 — The Nutrition Academy</h2>
          <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
            Short written lessons inside the app, each 2–3 minutes. Read them in one
            sitting or one a day. {LESSONS.length} lessons, about {TOTAL_MINUTES}{" "}
            minutes total.
          </p>
          <ol className="mt-4 space-y-3">
            {LESSONS.map((l, i) => (
              <li
                key={l.title}
                className="rounded-xl border border-border bg-card/40 p-4 flex gap-4"
              >
                <span className="font-mono text-xs text-gold pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{l.title}</p>
                  <p className="mt-1 text-sm text-foreground/70 leading-snug">
                    {l.summary}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {l.minutes} min read
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Module 3 */}
        <section>
          <h2 className="font-display text-2xl">Module 3 — The Mogul Bonuses</h2>
          <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
            Five PDFs written by Coach P, downloadable and yours to keep. Bought on
            their own the four Mogul guides are $99; they are included here.
          </p>
          <ul className="mt-4 space-y-2.5">
            {ALL_BONUSES.map((b) => (
              <li
                key={b.slug}
                className="rounded-xl border border-border bg-card/40 p-4 flex gap-4"
              >
                <span className="font-mono text-xs text-gold pt-0.5">{b.number}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="mt-1 text-sm text-foreground/70 leading-snug">
                    {b.subtitle}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Delivery */}
        <section>
          <h2 className="font-display text-2xl">How it's delivered</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground/80 leading-relaxed">
            <li>
              • Access is instant. Buy, and your account is upgraded to lifetime Pro.
            </li>
            <li>
              • Everything lives in the REBUILT web app — it works on your phone and
              can be added to your home screen. There is nothing to install.
            </li>
            <li>
              • Self-paced. No live sessions, no cohort dates, no expiry.
            </li>
            <li>
              • The guides download as PDFs from inside the app, so you keep them
              even if you stop using REBUILT.
            </li>
          </ul>
        </section>

        {/* Price + refund */}
        <section className="rounded-2xl border border-gold/30 bg-gradient-to-br from-background to-gold/[0.05] p-6">
          <h2 className="font-display text-2xl">Price and refund</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-4">
              <p className="font-display text-3xl">$497</p>
              <p className="text-xs text-muted-foreground mt-1">Paid once</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="font-display text-3xl">3 × $199</p>
              <p className="text-xs text-muted-foreground mt-1">
                $597 total — $100 more than paying once
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed">
            The payment plan costs more. If you can pay once, pay once. Either way
            you get the same access.
          </p>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            <strong className="text-foreground">7-day refund guarantee.</strong> If
            it isn't for you, request a refund within 7 days of purchase and you get
            your money back in full. Billing is by EEE International LLC through
            Stripe — email support@e2v.ai. Full details
            on the{" "}

            <Link to="/refunds" className="underline hover:text-foreground">
              refund policy
            </Link>{" "}
            page.
          </p>
          <Link
            to="/pricing"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gold px-8 text-sm font-semibold text-gold-foreground hover:bg-gold/90 transition"
          >
            Get the Course — $497
          </Link>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
