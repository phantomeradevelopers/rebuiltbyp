import type { ReactNode } from "react";

export function SectionHero({
  image,
  eyebrow,
  title,
  subtitle,
  height = "26vh",
  children,
  align = "end",
}: {
  image: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  height?: string;
  children?: ReactNode;
  align?: "end" | "center";
}) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, minHeight: 200 }}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark gradient that fades into the page background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--background) 35%, transparent) 0%, color-mix(in oklab, var(--background) 10%, transparent) 35%, color-mix(in oklab, var(--background) 55%, transparent) 75%, var(--background) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div
        className={`relative h-full max-w-md mx-auto px-6 pt-safe pb-5 flex flex-col ${
          align === "center" ? "justify-center text-center" : "justify-end"
        }`}
      >
        {eyebrow && (
          <p className="label-mono text-gold/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl sm:text-4xl leading-[1.05] tracking-tight text-foreground drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-foreground/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
