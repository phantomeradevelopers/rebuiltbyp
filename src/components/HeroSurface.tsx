import { useEffect, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import heroDawn from "@/assets/hero-dawn.jpg";
import heroIron from "@/assets/hero-iron.jpg";
import heroEmber from "@/assets/hero-ember.jpg";

type TimeOfDay = "dawn" | "iron" | "ember";

function timeBucket(hour: number): TimeOfDay {
  if (hour < 11) return "dawn";
  if (hour < 18) return "iron";
  return "ember";
}

const IMG: Record<TimeOfDay, string> = {
  dawn: heroDawn,
  iron: heroIron,
  ember: heroEmber,
};

const SALUTATION: Record<TimeOfDay, string> = {
  dawn: "Let's go",
  iron: "Hold the line",
  ember: "Back at it",
};

export function HeroSurface({
  children,
  variant,
  height = "60vh",
}: {
  children?: ReactNode;
  variant?: TimeOfDay;
  height?: string;
}) {
  // Default to dawn during SSR so initial paint matches client; client effect refines it.
  const [tod, setTod] = useState<TimeOfDay>(variant ?? "dawn");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (variant) return;
    setTod(timeBucket(new Date().getHours()));
  }, [variant]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height }}
      data-tod={tod}
    >
      {mounted ? (
        <ParallaxImage src={IMG[tod]} todKey={tod} />
      ) : (
        <img
          src={IMG["dawn"]}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
      )}
      {/* Cinematic dark gradient — keeps text legible without washing the image */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0.25) 30%, rgba(10,10,10,0.55) 70%, var(--background) 100%)",
        }}
      />
      {/* Subtle grain via SVG (no extra asset) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Content overlay */}
      <div className="relative h-full max-w-md mx-auto px-6 pt-safe pb-6 flex flex-col justify-end">
        {children}
      </div>
    </div>
  );
}

function ParallaxImage({ src, todKey }: { src: string; todKey: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const scale = useTransform(scrollY, [0, 600], [1.02, 1.12]);
  return (
    <motion.img
      key={todKey}
      src={src}
      alt=""
      aria-hidden
      style={{ y, scale }}
      className="absolute inset-0 w-full h-full object-cover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      loading="eager"
      fetchPriority="high"
    />
  );

}

export function heroSalutation(): string {
  if (typeof window === "undefined") return SALUTATION.dawn;
  return SALUTATION[timeBucket(new Date().getHours())];
}
