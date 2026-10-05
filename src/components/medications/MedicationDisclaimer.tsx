import { ShieldAlert } from "lucide-react";

export function MedicationDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
        <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0 text-gold" />
        Reminders only. Follow your prescriber's instructions. Not medical advice. REBUILT is not affiliated with CandyRx or any pharmacy.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-gold/30 bg-gold/5 p-3 space-y-1">
      <p className="label-mono text-gold flex items-center gap-1.5 text-xs">
        <ShieldAlert className="h-3 w-3" /> Reminders only
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        REBUILT helps you remember what your prescriber told you to take.
        We don't recommend doses, interpret labs, or change protocols.
        Always follow your clinician's instructions. Not medical advice.
        REBUILT is not affiliated with CandyRx or any pharmacy.
      </p>
    </div>
  );
}
