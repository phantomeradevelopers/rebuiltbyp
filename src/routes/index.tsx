import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ArrowRight, Sparkles, Shield, Flame, Crown } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { ChooseYourPath } from "@/components/landing/ChooseYourPath";
import { TrustBadges } from "@/components/landing/TrustBadges";

import { BreatheTeaser } from "@/components/landing/BreatheTeaser";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MogulBundleSection } from "@/components/landing/MogulBundleSection";

export const Route = createFileRoute("/")({
  // No auth redirect on '/'. The landing page must be freely browsable by
  // anon AND authenticated visitors — no auto-navigate on load, scroll, or
  // session-state changes. Navigation only happens on explicit user action
  // (e.g. clicking "Start free" / "Sign in").
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "REBUILT by Playboy P — From the wreck to the way back" },
      {
        name: "description",
        content:
          "The daily app for men rebuilding their body, mind, and identity. Coaching, training, nutrition, and accountability — all in one premium experience.",
      },
      { property: "og:title", content: "REBUILT — From the wreck to the way back" },
      {
        property: "og:description",
        content:
          "Coach P in your pocket. Daily missions, training, nutrition, and trophies. Start free.",
      },
      { property: "og:url", content: "https://rebuiltbyp.com/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://rebuiltbyp.com/og-image.png" },
    ],
    links: [
      { rel: "canonical", href: "https://rebuiltbyp.com/" },
      {
        rel: "preload",
        as: "image",
        href: "/__l5e/assets-v1/533e5956-98d5-4301-93ad-6e470c6a3287/app-today.png",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://rebuiltbyp.com/#org",
              name: "REBUILT by Playboy P",
              url: "https://rebuiltbyp.com",
              logo: "https://rebuiltbyp.com/icon-512.png",
              sameAs: ["https://rebuilt-pathway.lovable.app"],
            },
            {
              "@type": "WebSite",
              "@id": "https://rebuiltbyp.com/#website",
              url: "https://rebuiltbyp.com",
              name: "REBUILT",
              publisher: { "@id": "https://rebuiltbyp.com/#org" },
            },
            {
              "@type": "SoftwareApplication",
              name: "REBUILT",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web, iOS, Android",
              description: "Daily accountability app for men rebuilding body, mind, and identity.",
              offers: [
                { "@type": "Offer", name: "Pro Monthly", price: "14.99", priceCurrency: "USD" },
                { "@type": "Offer", name: "Pro Annual", price: "129.00", priceCurrency: "USD" },
                { "@type": "Offer", name: "Elite Monthly", price: "24.99", priceCurrency: "USD" },
                { "@type": "Offer", name: "Elite Annual", price: "219.00", priceCurrency: "USD" },
                { "@type": "Offer", name: "The REBUILT Course", price: "497.00", priceCurrency: "USD" },
              ],
            },
          ],
        }),
      },
    ],

  }),
});

const SHOTS = [
  { src: "/__l5e/assets-v1/533e5956-98d5-4301-93ad-6e470c6a3287/app-today.png", alt: "REBUILT Today screen — daily mission and streak", label: "Today" },
  { src: "/__l5e/assets-v1/102f9a62-bf9e-450e-81f0-378168a1fbbf/app-coach.png", alt: "Coach P chat", label: "Coach P" },
  { src: "/__l5e/assets-v1/1e1db610-f273-4f19-86f0-d5dd55e3acb5/app-plan.png", alt: "Training plan", label: "Plan" },
  { src: "/__l5e/assets-v1/24fcbfca-f3a0-47c6-9d3c-de433ff5df0f/app-nutrition.png", alt: "Nutrition tracking", label: "Fuel" },
  { src: "/__l5e/assets-v1/4d3379cc-3e0d-4369-82a3-266ca937a28b/app-trophies.png", alt: "Trophy gallery", label: "Trophies" },
];

function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-24 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3" aria-label="REBUILT home">
            <img src="/icon-512.png" alt="" width={512} height={512} decoding="async" fetchPriority="high" className="h-10 w-10 sm:h-11 sm:w-11 rounded-md" />
            <span className="font-wordmark text-2xl sm:text-3xl tracking-[0.32em] leading-none">REBUILT</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-xs text-foreground/70">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#screens" className="hover:text-foreground transition">App</a>
            <Link to={"/pricing" as never} className="hover:text-foreground transition">Pricing</Link>
            <Link to={"/legal" as never} className="hover:text-foreground transition">Legal</Link>
          </nav>
          <Link
            to={"/login" as never}
            className="text-xs px-3.5 h-9 inline-flex items-center rounded-full border border-foreground/15 hover:border-foreground/40 transition"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-28 sm:pt-32 pb-20 sm:pb-28">
        {/* Backdrop glow */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--rebuilt-gold) 14%, transparent), transparent 60%), linear-gradient(180deg, #0a0a0a 0%, var(--background) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.15] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <p className="label-mono text-gold inline-flex items-center gap-2 justify-center lg:justify-start">
              <Sparkles className="h-3 w-3" /> By Playboy P
            </p>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
              From the wreck<br />to the <span className="text-gold">way back.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-foreground/75 max-w-xl mx-auto lg:mx-0">
              A daily app for men getting their life back. Coaching, training,
              food, and daily wins — all in one place. Coach P walks with you.
            </p>


            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to={"/login" as never}
                className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-medium hover:from-gold hover:to-gold/90 transition shadow-[0_8px_30px_-6px_oklch(0.73_0.11_80/0.5)]"
              >
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={"/pricing" as never}
                className="h-12 px-6 inline-flex items-center justify-center rounded-full border border-foreground/20 text-sm font-medium hover:border-foreground/50 transition"
              >
                See pricing
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/55 justify-center lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> Free forever tier</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> No card to start</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> Cancel anytime</span>
            </div>
          </div>

          {/* Hero phone */}
          <div className="relative mx-auto w-full max-w-[340px] lg:max-w-[380px]">
            <div
              aria-hidden
              className="absolute -inset-10 -z-10 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--rebuilt-gold) 25%, transparent), transparent 70%)" }}
            />
            <div className="relative rounded-[2.5rem] border border-foreground/10 bg-foreground/[0.03] p-2 shadow-2xl">
              <img
                src={SHOTS[0].src}
                alt={SHOTS[0].alt}
                width={380}
                height={780}
                loading="eager"
                fetchPriority="high"
                className="rounded-[2rem] w-full h-auto block"
              />

            </div>
          </div>
        </div>
      </section>

      {/* Trust badge strip — factual, no numbers */}
      <TrustBadges />

      {/* Choose your path — Men's (Coach P) vs Angels (Coach Grace) */}
      <ChooseYourPath />

      {/* Feature row */}
      <section id="features" className="border-y border-foreground/10 bg-foreground/[0.02]">
        <Reveal className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Feature icon={<Flame className="h-5 w-5" />} title="Daily mission" body="One clear move a day. Streaks that mean something real." />
          <Feature icon={<Sparkles className="h-5 w-5" />} title="Coach P" body="A coach in your pocket. Text or talk. Built from the work that saved me." />
          <Feature icon={<Shield className="h-5 w-5" />} title="Built to last" body="Train, eat, think, and rest. One plan that fits your day." />
          <Feature icon={<Check className="h-5 w-5" />} title="Receipts" body="Trophies, before-and-after photos, proof of who you're becoming." />
        </Reveal>
      </section>

      {/* Interactive breathe teaser — free, no signup */}
      <BreatheTeaser />

      {/* App screens */}
      <section id="screens" className="py-20 sm:py-28">

        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <Reveal className="text-center max-w-2xl mx-auto">
            <p className="label-mono text-gold">Inside the app</p>
            <h2 className="mt-3 font-display text-3xl sm:text-5xl leading-[1.05]">A premium daily loop.</h2>
            <p className="mt-3 text-foreground/70">
              Made for your phone. Built to fade into your day so the work —
              not the app — shows up in the mirror.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 -mx-5 sm:mx-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-5 sm:gap-6 px-5 sm:px-0 sm:justify-center min-w-max sm:min-w-0">
              {SHOTS.map((s) => (
                <figure key={s.src} className="w-[230px] sm:w-[210px] shrink-0">
                  <div className="rounded-[1.75rem] border border-foreground/10 bg-foreground/[0.03] p-1.5 shadow-xl">
                    <img
                      src={s.src}
                      alt={s.alt}
                      width={210}
                      height={430}
                      loading="lazy"
                      decoding="async"
                      className="rounded-[1.4rem] w-full h-auto block"
                    />
                  </div>
                  <figcaption className="mt-3 text-center label-mono text-foreground/60">{s.label}</figcaption>
                </figure>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* Final CTA */}
      <section className="relative py-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, color-mix(in oklab, var(--rebuilt-gold) 12%, transparent), transparent 60%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="font-display text-4xl sm:text-6xl leading-[1.02]">
            Today is day one,<br />or day one again.
          </h2>
          <p className="mt-4 text-foreground/70">Either way — let's go.</p>
          <Link
            to={"/login" as never}
            className="mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition"
          >
            Create my account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter showSignature />

      {/* Sticky mobile CTA */}

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-background via-background/95 to-background/0 pointer-events-none">
        <Link
          to={"/login" as never}
          className="pointer-events-auto flex items-center justify-center gap-2 h-12 w-full rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-semibold shadow-[0_10px_30px_-8px_oklch(0.73_0.11_80/0.6)] active:scale-[0.98] transition"
        >
          Start free <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-full bg-gold/10 text-gold inline-flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-foreground/70 leading-relaxed">{body}</p>
    </div>
  );
}

function PricingSection() {
  const [cadence, setCadence] = useState<"monthly" | "annual">("annual");
  const annual = cadence === "annual";

  const proPrice = annual ? "$129" : "$14.99";
  const proCadence = annual ? "/yr" : "/mo";
  const proSub = annual ? "≈ $10.75/mo · save ~28%" : "Billed monthly";

  const elitePrice = annual ? "$219" : "$24.99";
  const eliteCadence = annual ? "/yr" : "/mo";
  const eliteSub = annual ? "≈ $18.25/mo · save ~27%" : "Billed monthly";

  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="label-mono text-gold">Pricing</p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl leading-[1.05]">
            Start the comeback. Stay rebuilt.
          </h2>
          <p className="mt-4 text-foreground/70">
            Faith-led daily walk. Fitness and nutrition built in.
          </p>

        </div>

        {/* Toggle */}
        <div className="mt-8 flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-foreground/15 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCadence("monthly")}
              className={`px-4 h-9 rounded-full transition ${cadence === "monthly" ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCadence("annual")}
              className={`px-4 h-9 rounded-full transition inline-flex items-center gap-2 ${cadence === "annual" ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"}`}
            >
              Annual
              <span className="rounded-full bg-gold/15 text-gold text-[10px] font-medium px-1.5 py-0.5 label-mono">
                Save ~28%
              </span>
            </button>
          </div>
        </div>

        {/* 3 tier grid */}
        <div className="mt-10 grid gap-5 md:grid-cols-3 items-start">
          {/* FREE */}
          <article className="card-elevated p-6 flex flex-col rounded-2xl">
            <p className="label-mono text-muted-foreground">Free</p>
            <h3 className="mt-1 font-display text-2xl">Start the comeback.</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <p className="font-display text-4xl">$0</p>
              <p className="text-xs text-muted-foreground">forever · no card</p>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-foreground/85 flex-1">
              <Bullet>Daily devotional + check-in & streak</Bullet>
              <Bullet>1 daily mission · Coach P 5 messages/day · plate snap 1/day</Bullet>
              <Bullet>Earn your first trophies</Bullet>
            </ul>
            <Link
              to={"/login" as never}
              className="mt-6 h-11 w-full rounded-full border border-foreground/20 inline-flex items-center justify-center text-sm font-medium hover:border-foreground/50 transition"
            >
              Start free
            </Link>
          </article>

          {/* PRO */}
          <article className="relative card-elevated p-6 flex flex-col rounded-2xl border-gold/50 ring-1 ring-gold/30 shadow-[0_0_60px_-18px_oklch(0.73_0.11_80/0.45)] md:-mt-3 bg-gradient-to-b from-gold/[0.04] to-transparent">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold text-gold-foreground text-[10px] font-medium px-3 py-1 label-mono tracking-wider">
              MOST POPULAR
            </div>
            <p className="label-mono text-gold inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Pro
            </p>
            <h3 className="mt-1 font-display text-2xl">The full daily walk.</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <p className="font-display text-4xl">{proPrice}</p>
              <p className="text-xs text-muted-foreground">{proCadence}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{proSub}</p>
            <ul className="mt-5 space-y-2.5 text-sm text-foreground/90 flex-1">
              <Bullet><span className="text-foreground/70">Everything in Free, plus:</span></Bullet>
              <Bullet>Unlimited Coach P + voice (faith-infused coaching)</Bullet>
              <Bullet>Full faith track: devotional plans, scripture, prayer & accountability, all four traditions</Bullet>
              <Bullet>Full fitness + nutrition suite (plate snap, fast-food sheet, swaps, macros)</Bullet>
              <Bullet>Voice journal, progress photos, full trophy/XP system, labs tracking</Bullet>
            </ul>
            <Link
              to={"/pricing" as never}
              className="mt-6 h-11 w-full rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition"
            >
              Start 30-day free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          {/* ELITE */}
          <article className="card-elevated p-6 flex flex-col rounded-2xl border-foreground/20">
            <p className="label-mono text-foreground/80 inline-flex items-center gap-1.5">
              <Crown className="h-3 w-3" /> Elite
            </p>
            <h3 className="mt-1 font-display text-2xl">Go all in.</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <p className="font-display text-4xl">{elitePrice}</p>
              <p className="text-xs text-muted-foreground">{eliteCadence}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{eliteSub}</p>
            <ul className="mt-5 space-y-2.5 text-sm text-foreground/90 flex-1">
              <Bullet><span className="text-foreground/70">Everything in Pro, plus:</span></Bullet>
              <Bullet>Priority Coach P, advanced progress analytics</Bullet>
              <Bullet>Exclusive programs & content drops, members-only community</Bullet>
            </ul>
            <Link
              to={"/pricing" as never}
              className="mt-6 h-11 w-full rounded-full border border-foreground/30 inline-flex items-center justify-center text-sm font-medium hover:border-foreground/60 transition"
            >
              Choose Elite
            </Link>
          </article>
        </div>

        {/* Course block */}
        <article className="mt-12 card-elevated rounded-2xl border-gold/40 bg-gradient-to-br from-background to-gold/[0.05] p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <p className="label-mono text-gold">GO ALL IN</p>
              <h3 className="mt-2 font-display text-3xl">THE REBUILT COURSE</h3>
              <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
                The full curriculum. Lifetime access — and lifetime Pro inside the app.
                One payment, or three.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">7-day refund guarantee.</p>
            </div>
            <div className="flex flex-col gap-2 md:w-72 shrink-0">
              <div className="text-center">
                <p className="font-display text-4xl">$497</p>
                <p className="text-xs text-muted-foreground">one-time · or 3 × $199</p>
              </div>
              <Link
                to={"/pricing" as never}
                className="mt-2 h-11 w-full rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition"
              >
                Get the Course <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </article>

        {/* Mogul Bundle — 4 PDF guides, one-time $99 */}
        <MogulBundleSection />

        {/* 1:1 callout */}
        <div className="mt-6 rounded-2xl border border-foreground/15 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="label-mono text-muted-foreground">1:1 Coaching</p>
            <p className="mt-1 text-sm text-foreground/85">
              Limited seats — applied for, not included in any plan.
            </p>
          </div>
          <Link
            to={"/app/consult/apply" as never}
            className="h-10 px-5 rounded-full border border-foreground/25 inline-flex items-center justify-center text-xs font-medium hover:border-foreground/60 transition"
          >
            Apply for a spot
          </Link>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check className="h-4 w-4 shrink-0 mt-0.5 text-gold" />
      <span>{children}</span>
    </li>
  );
}
