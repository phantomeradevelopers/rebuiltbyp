import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { acceptDocument, getMyAcceptances, MEDICAL_DISCLAIMER_VERSION } from "@/lib/legal.functions";

const LS_KEY = "rebuilt.medical-disclaimer.accepted";

export function MedicalDisclaimerGate() {
  const [needsAccept, setNeedsAccept] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LS_KEY) === MEDICAL_DISCLAIMER_VERSION) return;
    (async () => {
      try {
        const { acceptances } = await getMyAcceptances();
        const has = acceptances.some(
          (a) => a.document === "medical" && a.version === MEDICAL_DISCLAIMER_VERSION,
        );
        if (has) {
          localStorage.setItem(LS_KEY, MEDICAL_DISCLAIMER_VERSION);
        } else {
          setNeedsAccept(true);
        }
      } catch {
        // If we can't check, don't block the app.
      }
    })();
  }, []);

  async function accept() {
    setBusy(true);
    try {
      await acceptDocument({
        data: {
          document: "medical",
          version: MEDICAL_DISCLAIMER_VERSION,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      localStorage.setItem(LS_KEY, MEDICAL_DISCLAIMER_VERSION);
      setNeedsAccept(false);
    } finally {
      setBusy(false);
    }
  }

  if (!needsAccept) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-gold">
          <Stethoscope className="h-4 w-4" />
          <p className="label-mono">Before you begin</p>
        </div>
        <h2 className="mt-3 font-display text-2xl leading-tight">
          REBUILT is not medical care.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Training, nutrition, peptide education, and AI coach replies are for
          general wellness and motivation only — not medical advice, not a
          diagnosis, not a substitute for a licensed clinician. You must be
          18+. If you have any condition, take medications, or are unsure,
          consult a doctor before starting.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          In an emergency, call your local emergency line. In the US, call or
          text 988 for the Suicide and Crisis Lifeline.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={accept}
            disabled={busy}
            className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Saving…" : "I understand — continue"}
          </button>
          <Link
            to="/legal"
            className="h-10 inline-flex items-center justify-center text-xs label-mono text-muted-foreground hover:text-foreground"
          >
            Read the full disclaimer
          </Link>
        </div>
      </div>
    </div>
  );
}
