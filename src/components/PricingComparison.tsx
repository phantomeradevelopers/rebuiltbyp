import { Check, Minus, Sparkles, Quote, Calendar } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Row = { label: string; free: string | boolean; member: string | boolean };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Daily Practice",
    rows: [
      { label: "Daily anchor + verse", free: true, member: true },
      { label: "Daily check-in & streak", free: true, member: true },
      { label: "Weekly review", free: "Read-only", member: "Full insights" },
    ],
  },
  {
    title: "Coach P",
    rows: [
      { label: "Messages per day", free: "5", member: "Unlimited" },
      { label: "Memory continuity", free: false, member: true },
      { label: "Tradition-tuned prompt", free: "Basic", member: "Full depth" },
    ],
  },
  {
    title: "Faith & Tribe",
    rows: [
      { label: "Faith traditions", free: "1 only", member: "All 4 + switching" },
      { label: "Tribe / lineage personalization", free: true, member: true },
    ],
  },
  {
    title: "Growth Tools",
    rows: [
      { label: "Voice journal", free: false, member: true },
      { label: "Progress photos", free: false, member: true },
      { label: "Sponsor & accountability", free: false, member: true },
      { label: "Daily nudges & weekly themes", free: false, member: true },
    ],
  },
];

function Cell({ v, muted = false }: { v: string | boolean; muted?: boolean }) {
  if (v === true)
    return (
      <Check
        className={`h-4 w-4 ${muted ? "text-muted-foreground/60" : "text-gold"}`}
        aria-label="Included"
      />
    );
  if (v === false)
    return <Minus className="h-4 w-4 text-muted-foreground/30" aria-label="Not included" />;
  return (
    <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground/90"}`}>
      {v}
    </span>
  );
}

export function PricingComparison({
  onStartTrial,
  loadingPlan = null,
  busy = false,
  showFreeCard = true,
}: {
  onStartTrial?: (plan: "monthly" | "yearly") => void;
  loadingPlan?: "monthly" | "yearly" | null;
  busy?: boolean;
  showFreeCard?: boolean;
}) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  const isYearly = plan === "yearly";
  const price = isYearly ? "$99" : "$14.99";
  const cadence = isYearly ? "/year" : "/month";
  const perDay = isYearly ? "≈ $0.27/day" : "≈ $0.49/day";
  const microcopy = isYearly
    ? "No charge today. Auto-bills $99 on day 8. Cancel anytime."
    : "No charge today. Auto-bills $14.99 on day 8. Cancel anytime.";

  return (
    <div className="space-y-6">
      {/* Social proof (placeholder — TODO: replace with real numbers/quote) */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="label-mono text-muted-foreground">Join 1,200+ people in the rebuild</p>
        <figure className="card-elevated px-4 py-3 max-w-sm">
          <Quote className="h-3 w-3 text-gold mx-auto mb-1.5" />
          <blockquote className="text-sm italic text-foreground/90 leading-snug">
            "Coach P keeps me honest at 6am."
          </blockquote>
          <figcaption className="mt-1.5 text-[10px] label-mono text-muted-foreground">
            — M.R., 47 days in
          </figcaption>
        </figure>
      </div>

      {/* Plan cards */}
      <div className={`grid gap-3 ${showFreeCard ? "sm:grid-cols-[1fr_1.3fr]" : ""}`}>
        {showFreeCard && (
          <div className="card-elevated p-5 flex flex-col">
            <p className="label-mono text-muted-foreground">Free</p>
            <p className="font-display text-3xl mt-2">$0</p>
            <p className="text-xs text-muted-foreground">Forever · no card</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              <li className="flex gap-2"><Check className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" /> Daily anchor + verse</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" /> Daily check-in & streak</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" /> 5 Coach P messages/day</li>
            </ul>
          </div>
        )}

        {/* Member card */}
        <div className="relative card-elevated p-5 border-gold/50 ring-1 ring-gold/30 shadow-[0_0_40px_-12px_oklch(0.73_0.11_80/0.35)]">
          <div className="absolute -top-2.5 right-4 rounded-full bg-gold text-gold-foreground text-[10px] font-medium px-2.5 py-0.5 label-mono">
            Best value
          </div>
          <p className="label-mono text-gold inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Member
          </p>

          {isYearly && (
            <p className="mt-2 text-xs text-muted-foreground line-through">$179.88/yr</p>
          )}
          <div className="mt-1 flex items-baseline gap-1">
            <p className="font-display text-4xl">{price}</p>
            <p className="text-xs text-muted-foreground">{cadence}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{perDay}</p>

          {isYearly && (
            <div className="mt-3 inline-flex items-center rounded-md bg-gold/15 text-gold text-xs font-medium px-2 py-1">
              You save $80.88 — 2 months free
            </div>
          )}

          <button
            onClick={() => onStartTrial?.(plan)}
            disabled={busy || !onStartTrial}
            className="mt-4 h-12 w-full rounded-md bg-gradient-to-r from-gold/90 to-gold text-sm font-medium text-gold-foreground hover:from-gold hover:to-gold/90 disabled:opacity-50 transition"
          >
            {loadingPlan === plan ? "Opening checkout…" : "Start 7-day free trial"}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground text-center">{microcopy}</p>

          <button
            type="button"
            onClick={() => setPlan(isYearly ? "monthly" : "yearly")}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {isYearly ? "Prefer monthly? $14.99/mo →" : "← Switch to yearly (save $80.88)"}
          </button>
        </div>
      </div>

      {/* Value anchor strip */}
      <p className="text-center text-xs text-muted-foreground italic px-2 leading-relaxed">
        Less than one therapy session a year. A fraction of the $497 program.
        <br className="hidden sm:inline" /> Cancel any day of the trial — no charge.
      </p>

      {/* Grouped comparison table */}
      <div className="card-elevated p-4 sm:p-5">
        <p className="label-mono text-muted-foreground mb-3 text-center">Compare every feature</p>
        <div className="grid grid-cols-[1.5fr_0.8fr_1fr] gap-2 text-xs">
          <div />
          <div className="text-center label-mono text-muted-foreground pb-1">Free</div>
          <div className="text-center label-mono text-gold pb-1">Member</div>

          {GROUPS.map((group) => (
            <div key={group.title} className="contents">
              <div className="col-span-3 mt-3 pt-2 border-t border-border/60 label-mono text-[10px] text-foreground/60">
                {group.title}
              </div>
              {group.rows.map((row) => (
                <div key={row.label} className="contents">
                  <div className="text-foreground/90 py-2">{row.label}</div>
                  <div className="flex items-center justify-center py-2">
                    <Cell v={row.free} muted />
                  </div>
                  <div className="flex items-center justify-center py-2 bg-gold/[0.04] rounded">
                    <Cell v={row.member} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Trial timeline */}
      <div className="card-elevated p-5">
        <p className="label-mono text-muted-foreground mb-4 text-center inline-flex items-center justify-center gap-1.5 w-full">
          <Calendar className="h-3 w-3" /> How the 7-day trial works
        </p>
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { day: "Today", text: "Start trial. Card saved, $0 charged." },
            { day: "Day 5", text: "Reminder email." },
            { day: "Day 7", text: "Final reminder. Cancel for free." },
            { day: "Day 8", text: `First charge: ${isYearly ? "$99" : "$14.99"}.` },
          ].map((step, i) => (
            <li key={step.day} className="text-center">
              <div className={`mx-auto h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium ${i === 3 ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <p className="mt-2 label-mono text-[10px] text-foreground/80">{step.day}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-1">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] text-muted-foreground text-center">
          Cancel anytime in Account → Manage billing. One click.
        </p>
      </div>

      {/* Mini FAQ */}
      <div className="card-elevated p-2 sm:p-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="q1">
            <AccordionTrigger className="text-sm">What happens after the 7-day trial?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Your card is charged automatically on day 8 for the plan you picked ($99/yr or $14.99/mo).
              We email you reminders on day 5 and day 7 so you're never surprised. Cancel any time before
              day 8 and you'll never be charged.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger className="text-sm">Does the free plan really stay free?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Yes. Forever. No card required. Free includes the daily anchor, daily check-in, your streak,
              and 5 Coach P messages a day.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger className="text-sm">Can I cancel or get a refund?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Cancel during the trial = $0 charged. After that, cancel anytime from your Account page —
              you keep Member access through the period you already paid for, then drop back to free.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q4">
            <AccordionTrigger className="text-sm">What happens to my data if I cancel?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Your check-ins, journal entries, anchors, and streak stay yours. Member-only features (voice
              journal, photos, all traditions) lock until you resubscribe — they unlock instantly when you do.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
