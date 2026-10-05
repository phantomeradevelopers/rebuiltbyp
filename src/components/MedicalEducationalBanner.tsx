import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

const KEY = "rebuilt.med-banner.dismissed";

/**
 * Persistent "Educational only" banner shown at the top of medical screens
 * (Peptides, Protocol, Dose History). Dismissible per browser session —
 * reappears on next session/open. Legal-risk fix: REBUILT does not prescribe,
 * diagnose, or recommend dosing.
 */
export function MedicalEducationalBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className="rounded-lg border border-gold/40 bg-gold/5 p-3 flex items-start gap-2"
    >
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
      <p className="text-xs leading-relaxed text-foreground/90 flex-1">
        <span className="text-gold font-medium">Educational only. Not medical advice.</span>{" "}
        REBUILT does not prescribe, diagnose, or recommend dosing. Talk to a
        licensed clinician before starting or changing anything.
      </p>
      <button
        type="button"
        aria-label="Dismiss for this session"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="shrink-0 h-6 w-6 -mr-1 -mt-1 rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5 mx-auto" />
      </button>
    </div>
  );
}
