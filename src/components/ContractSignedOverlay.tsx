import { useEffect, useState } from "react";
import { celebrate } from "@/lib/celebrate";

type Props = {
  open: boolean;
  statement: string;
  signatureDataUrl?: string | null;
  signedAt?: string | null;
  onClose: () => void;
};

export function ContractSignedOverlay({ open, statement, signatureDataUrl, signedAt, onClose }: Props) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (!open) { setPhase(0); return; }
    celebrate("fireworks");
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => setPhase(3), 2000);
    const t4 = setTimeout(() => onClose(), 6000);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [open, onClose]);

  if (!open) return null;

  const dateStr = signedAt
    ? new Date(signedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }).toUpperCase()
    : new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

  return (
    <div
      role="dialog"
      aria-live="assertive"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 backdrop-blur-xl px-6 animate-in fade-in duration-500"
    >
      <div
        className="relative max-w-md w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className={`label-mono text-gold tracking-[0.3em] transition-all duration-700 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          CONTRACT · SIGNED
        </p>

        <p
          className={`mt-6 font-display text-2xl md:text-3xl leading-snug text-foreground transition-all duration-1000 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          "{statement}"
        </p>

        {signatureDataUrl && (
          <div
            className={`mt-6 mx-auto h-24 w-full max-w-xs transition-all duration-1000 ${
              phase >= 2 ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={signatureDataUrl}
              alt="Your signature"
              className="h-full w-full object-contain"
              style={{
                filter: "drop-shadow(0 0 12px rgba(201,168,76,0.5))",
              }}
            />
          </div>
        )}

        <div
          className={`mt-8 inline-block border-2 border-gold px-6 py-2 rotate-[-4deg] transition-all duration-700 ${
            phase >= 3 ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
        >
          <p className="label-mono text-gold text-sm tracking-widest">SIGNED · {dateStr}</p>
        </div>

        <button
          onClick={onClose}
          className={`btn-gold mt-10 h-12 px-8 rounded-md text-sm font-medium transition-opacity duration-500 ${
            phase >= 3 ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          Go become him.
        </button>
      </div>
    </div>
  );
}
