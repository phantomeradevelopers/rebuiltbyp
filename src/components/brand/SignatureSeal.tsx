import signatureDark from "@/assets/signature-dark.png.asset.json";

type Size = "xs" | "sm" | "md";

/**
 * Founder signature seal — the house mark at emotional peaks only.
 * Uses the existing signature PNG as a mask filled with the track accent
 * (gold in Men's, rose-gold in Angels — via `var(--gold)`), at low opacity.
 * Static by design: no draw-on animation, never watermark-like.
 * TODO(owner): drop /assets/signature-p.svg to swap for a vector mark.
 */
export function SignatureSeal({
  size = "sm",
  prefix = "—",
  className = "",
  opacity = 0.7,
}: {
  size?: Size;
  /** Small mark before the signature, e.g. "—". Set "" to hide. */
  prefix?: string;
  className?: string;
  opacity?: number;
}) {
  const h = size === "xs" ? 16 : size === "md" ? 32 : 22;
  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label="Signed, P."
      style={{ opacity }}
    >
      {prefix ? (
        <span
          className="label-mono text-[10px] tracking-[0.28em]"
          style={{ color: "var(--gold)" }}
          aria-hidden
        >
          {prefix}
        </span>
      ) : null}
      <span
        role="img"
        aria-hidden
        className="block"
        style={{
          height: h,
          width: h * 2.6,
          backgroundColor: "var(--gold)",
          WebkitMaskImage: `url(${signatureDark.url})`,
          maskImage: `url(${signatureDark.url})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </div>
  );
}
