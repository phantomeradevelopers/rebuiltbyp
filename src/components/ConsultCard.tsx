import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, ArrowRight, Check } from "lucide-react";
import { getConsultStatus } from "@/lib/consult.functions";
import { SignatureSeal } from "./brand/SignatureSeal";

// Real value bullets pulled from the actual consult offer (see src/lib/consult.functions.ts
// and src/routes/app.consult.tsx INCLUDED). No invented claims.
const VALUE_BULLETS = [
  "Private 1:1 call with P every single week",
  "Direct text line to P between calls",
  "Training, nutrition, mindset, recovery — dialed by P personally",
  "Everything in Pro included, no upgrade needed",
];

export function ConsultCard({ variant = "compact" }: { variant?: "compact" | "hero" }) {
  const fetchStatus = useServerFn(getConsultStatus);
  const { data } = useQuery({
    queryKey: ["consult-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });
  const seatsTotal = data?.seatsTotal ?? null;
  const seatsLeft = data ? Math.max(0, data.seatsTotal - data.seatsTaken) : null;
  const seatsFull = seatsLeft !== null && seatsLeft <= 0;
  const isActive = !!data?.active;
  const appStatus = data?.application?.status ?? null;

  // Route: active seat → seat page; otherwise consult overview (which routes to /apply).
  const linkTo = isActive ? "/app/consult/seat" : "/app/consult";
  const linkSearch = { ok: false, canceled: false } as const;

  // CTA label follows real state — never fabricated.
  const ctaLabel = isActive
    ? "Go to my seat"
    : appStatus === "approved"
      ? "Claim your seat"
      : appStatus === "pending"
        ? "Application in review"
        : appStatus === "waitlist" || seatsFull
          ? "Join the waitlist"
          : "Apply for a seat";

  if (variant === "hero") {
    return (
      <Link
        to={linkTo}
        search={linkSearch as any}
        className="tier-card-onyx block p-6 space-y-4 group"
        aria-label="Private 1:1 coaching with P"
      >
        {/* Kicker + seats */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <p className="label-mono text-platinum text-[10px] tracking-[0.22em]">
            PRIVATE 1:1 WITH P
          </p>
          {seatsTotal !== null && seatsLeft !== null && (
            <p className="label-mono text-[10px] text-gold">
              {seatsFull ? "SEATS FULL" : `${seatsLeft}/${seatsTotal} SEATS`}
            </p>
          )}
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-2">
          <h3 className="font-display text-2xl sm:text-[26px] leading-[1.1] text-foreground">
            You + P. Every week.<br />Until you're rebuilt.
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The most personal thing REBUILT offers. P reviews every application personally.
          </p>
        </div>

        {/* Value bullets */}
        <ul className="relative z-10 space-y-1.5 pt-1">
          {VALUE_BULLETS.map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13px] leading-snug">
              <Check className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
              <span className="text-foreground/90">{t}</span>
            </li>
          ))}
        </ul>

        {/* Price + billing terms — real terms only */}
        <div className="relative z-10 pt-2 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gold-metal">$3,000</span>
              <span className="text-[11px] text-muted-foreground">/ month</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              Billed monthly. Cancel anytime — access continues through the current month.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="relative z-10 pt-1">
          <span
            className={`w-full h-11 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 ${
              seatsFull && !isActive ? "btn-platinum" : "btn-gold"
            }`}
          >
            <Phone className="h-4 w-4" />
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition" />
          </span>
        </div>

        {/* Founder signature */}
        <div className="relative z-10 flex items-center justify-end pt-1">
          <SignatureSeal size="sm" prefix="—" opacity={0.7} />
        </div>
      </Link>
    );
  }

  // Compact — used in Settings; kept unchanged in spirit, just honest.
  return (
    <Link
      to={linkTo}
      search={linkSearch as any}
      className="flex items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/5 p-3 hover:bg-gold/10 transition"
    >
      <div className="min-w-0">
        <p className="label-mono text-gold text-xs">Private 1:1 with P</p>
        <p className="text-sm mt-0.5 truncate">
          {isActive
            ? "Active · go to my seat"
            : seatsFull
              ? "$3k/mo · seats full — waitlist open"
              : seatsLeft !== null
                ? `$3k/mo · ${seatsLeft}/${seatsTotal} seats open`
                : "$3k/mo · apply for a seat"}
        </p>
      </div>
      <Phone className="h-4 w-4 text-gold shrink-0" />
    </Link>
  );
}
