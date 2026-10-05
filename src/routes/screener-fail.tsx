import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/screener-fail")({ component: ScreenerFail });

function ScreenerFail() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background flex flex-col px-6">
      <header className="pt-safe pt-6 flex items-center justify-between">
        <Logo />
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" as never, replace: true }))}
          className="label-mono hover:text-foreground"
        >Sign out</button>
      </header>
      <section className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <p className="label-mono text-gold">First, the body</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Let's get you cleared.</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Based on what you shared, P wants you talking to a clinician before we hand you a workout. This isn't a "no" — it's a "not yet." Our partner CandyRx can help.
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
          Use code <span className="text-gold font-mono">PLAYBOYP15</span> at checkout. Once you're cleared, come back and we'll build your plan together.
        </p>
        <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
          In the meantime: <strong>do not start any peptide, hormone, or new supplement without clinician clearance</strong> — including anything you may have read about in our peptide library.
        </p>
        <a
          href="https://www.shopcandyrx.com/?discount=PLAYBOYP15&utm_source=rebuilt&utm_medium=app&utm_campaign=screener_fail"
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Talk to CandyRx
        </a>
        <a href="/legal" className="mt-4 text-xs text-muted-foreground underline hover:text-foreground self-start">
          Medical disclaimer & terms
        </a>
      </section>
    </main>
  );
}
