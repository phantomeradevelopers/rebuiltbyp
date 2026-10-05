import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function RoomTile({
  to,
  search,
  icon: Icon,
  eyebrow,
  title,
  meta,
  accent = "gold",
  delay = 0,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  meta?: string;
  accent?: "gold" | "ember" | "iron" | "dawn";
  delay?: number;
  children?: ReactNode;
}) {
  const accentGlow: Record<typeof accent, string> = {
    gold: "from-gold/25 via-gold/5",
    ember: "from-orange-500/25 via-orange-500/5",
    iron: "from-slate-300/15 via-slate-300/5",
    dawn: "from-amber-300/20 via-amber-300/5",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group"
    >
      <Link
        to={to as never}
        search={search as never}
        className="relative block overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 h-full min-h-[140px] transition-colors hover:border-gold/40"
        style={{
          boxShadow:
            "0 1px 0 0 oklch(0.35 0.02 70 / 0.25) inset, 0 12px 32px -16px oklch(0 0 0 / 0.7)",
        }}
      >
        {/* Accent corner glow */}
        <div
          aria-hidden
          className={`absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl bg-gradient-radial ${accentGlow[accent]} to-transparent opacity-70 group-hover:opacity-100 transition-opacity`}
          style={{
            background: `radial-gradient(circle, var(--gold) 0%, transparent 65%)`,
            opacity: 0.18,
          }}
        />
        {/* Grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="relative flex flex-col h-full">
          <div className="flex items-start justify-between">
            <div className="h-10 w-10 rounded-xl border border-gold/30 bg-gold/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-gold" strokeWidth={1.75} />
            </div>
            {meta && (
              <span className="label-mono text-[11px] text-gold/80">{meta}</span>
            )}
          </div>
          <div className="mt-auto pt-6">
            <p className="label-mono text-[11px] text-muted-foreground">{eyebrow}</p>
            <p className="mt-1 font-display text-xl leading-tight text-foreground">
              {title}
            </p>
            {children}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
