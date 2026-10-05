import signatureDark from "@/assets/signature-dark.png.asset.json";
import signatureLight from "@/assets/signature-light.png.asset.json";

/**
 * Founder signature credit block. Handwritten mark on cleaned transparent
 * paper — black ink on light, white ink on dark.
 */
export function FounderSignature() {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-6">
      <p className="label-mono text-[10px] tracking-[0.32em] text-foreground/45">
        Designed by
      </p>
      <img
        src={signatureDark.url}
        alt="Founder signature"
        className="block dark:hidden h-8 sm:h-10 w-auto opacity-80 select-none"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      <img
        src={signatureLight.url}
        alt="Founder signature"
        className="hidden dark:block h-8 sm:h-10 w-auto opacity-85 select-none"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      <p className="text-[11px] text-foreground/55">
        Made in San Diego by{" "}
        <a
          href="https://phantomera.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground hover:decoration-foreground/60 transition"
        >
          phantomera.dev
        </a>
      </p>
    </div>
  );
}
