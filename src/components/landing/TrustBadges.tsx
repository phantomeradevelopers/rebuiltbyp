import { Cross, Dumbbell, Users, MessageCircle, Pill, Smartphone, LifeBuoy } from "lucide-react";

const BADGES = [
  { icon: Cross, label: "Faith · Fitness · Accountability" },
  { icon: MessageCircle, label: "Coach in your pocket" },
  { icon: Pill, label: "Med & protocol reminders" },
  { icon: Smartphone, label: "Works on iPhone & Android" },
  { icon: LifeBuoy, label: "Real human support" },
  { icon: Dumbbell, label: "Train · Fuel · Rest" },
  { icon: Users, label: "Men's & Angels tracks" },
];

/**
 * Factual trust badges under the hero. No numbers, no fake stats.
 * Mobile: horizontal snap-scroll. Desktop: centered wrap.
 */
export function TrustBadges() {
  return (
    <section aria-label="What REBUILT stands for" className="pt-2 pb-6 sm:pb-10">
      <div className="max-w-6xl mx-auto">
        <div
          className="flex gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar px-5 sm:px-8 sm:flex-wrap sm:justify-center snap-x snap-mandatory"
        >
          {BADGES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="snap-start shrink-0 inline-flex items-center gap-1.5 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3 py-1.5 text-[11px] sm:text-xs text-foreground/80 whitespace-nowrap"
            >
              <Icon className="h-3.5 w-3.5 text-gold" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
