import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CandyRxCard } from "@/components/CandyRxCard";
import { YouthfulLabCard } from "@/components/YouthfulLabCard";

/**
 * Demo-only inline preview of Coach P's three-way routing system.
 * Renders one Route A example (CandyRx · clinician door, gold) and
 * one Route B example (YouthfulLab · research/education door, sky-blue)
 * so new demo users can see the dual-door system at a glance.
 *
 * RULES enforced by the surrounding copy:
 * - Route A copy: clinician-conversation framing (CandyRx is gold).
 * - Route B copy: EDUCATIONAL ONLY ("research shows / studied for / learn").
 *   No "take / try / use / add to your protocol" language anywhere.
 * - Only renders for demo accounts (@rebuilt.test).
 */
export function DemoCoachRoutingPreview() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const email = data.user?.email ?? "";
      setIsDemo(email.endsWith("@rebuilt.test"));
    });
    return () => { cancelled = true; };
  }, []);

  if (!isDemo) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="label-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--rebuilt-gold)]">
          Demo · Coach P's two doors
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When your data shows a pattern, P routes you to the right door.
          Here's what each looks like. Both are real partners — gold goes
          to a clinician; sky-blue is research education.
        </p>
      </div>

      {/* ============ ROUTE A — CandyRx (gold, clinician door) ============ */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-gold/80">
          Route A · clinician conversation
        </p>
        <p className="text-xs text-muted-foreground italic leading-snug">
          P: "Energy and libido have been flat for two weeks. That's a labs
          conversation, not a programming change."
        </p>
        <CandyRxCard
          variant="compact"
          hint="Talk to a CandyRx clinician about TRT — labs, prescription, monitoring"
        />
      </div>

      {/* ============ ROUTE B — YouthfulLab (sky-blue, education door) ============ */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-sky-300/80">
          Route B · research education
        </p>
        <p className="text-xs text-muted-foreground italic leading-snug">
          P: "Soft-tissue recovery has been slow. Here's what the research
          says about BPC-157. YouthfulLab carries it as research material —
          not for personal use without a clinician's guidance."
        </p>
        <YouthfulLabCard
          variant="compact"
          hint="Read the research on BPC-157 and TB-500 — for laboratory study only"
        />
      </div>

      <p className="text-[10px] text-muted-foreground/70 leading-snug px-1">
        In your real account, these cards only surface after sustained
        patterns in your data — never on day 1, and never inside mindset,
        faith, or journal.
      </p>
    </section>
  );
}
