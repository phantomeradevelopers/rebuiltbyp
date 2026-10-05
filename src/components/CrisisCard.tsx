import { Phone, MessageCircle, X } from "lucide-react";
import { useState } from "react";

/**
 * Non-blocking crisis support card. Shown when client-side detection flags
 * concerning content. We surface professional help without taking over the UI.
 *
 * Numbers shown are US-default (988). For international users we point to
 * findahelpline.com which routes by country.
 */
export function CrisisCard({ severity, onDismiss }: { severity: "low" | "medium" | "high"; onDismiss?: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const headline = severity === "high"
    ? "I hear you. You don't have to do this alone."
    : severity === "medium"
    ? "What you wrote matters. Talking to a person helps."
    : "Heavy day. A real conversation can lighten this.";

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-destructive">Support</p>
          <p className="mt-2 font-display text-lg leading-tight text-foreground">{headline}</p>
        </div>
        <button
          aria-label="Dismiss"
          onClick={() => { setOpen(false); onDismiss?.(); }}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background"
        ><X className="h-4 w-4" /></button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Playboy P is your daily coach, not a clinician. For what you're carrying right now, a trained human is the right next step.
      </p>

      <div className="mt-4 grid gap-2">
        <a
          href="tel:988"
          className="h-11 inline-flex items-center justify-center gap-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium"
        ><Phone className="h-4 w-4" /> Call 988 (US Suicide &amp; Crisis Lifeline)</a>
        <a
          href="sms:741741?body=HOME"
          className="h-11 inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 text-destructive text-sm font-medium"
        ><MessageCircle className="h-4 w-4" /> Text HOME to 741741 (US Crisis Text Line)</a>
        <a
          href="https://findahelpline.com/"
          target="_blank" rel="noreferrer"
          className="h-11 inline-flex items-center justify-center rounded-md border border-border text-xs label-mono text-muted-foreground hover:text-foreground"
        >Outside the US → findahelpline.com</a>
      </div>
    </div>
  );
}
