import { Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, Apple, Wind, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { haptic } from "@/lib/haptics";

type NavItem = {
  to: string;
  labelKey: string;
  fallback: string;
  Icon: typeof Home;
  exact?: boolean;
};

// 5-tab IA (accountability pass). Journal, Progress, Achievements, Protocol,
// Peptides, Labs, Readiness, Spirit, Outdoor, Consult, Redeem, Account and
// Settings all live under the You hub (/app/settings). Nothing removed —
// everything stays reachable.
const items: NavItem[] = [
  { to: "/app", labelKey: "nav.today", fallback: "Today", Icon: Home, exact: true },
  { to: "/app/plan", labelKey: "nav.train", fallback: "Train", Icon: Dumbbell },
  { to: "/app/nutrition", labelKey: "nav.fuel", fallback: "Fuel", Icon: Apple },
  { to: "/app/breathe", labelKey: "nav.breathe", fallback: "Breathe", Icon: Wind },
  { to: "/app/settings", labelKey: "nav.you", fallback: "You", Icon: User },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto max-w-md pointer-events-auto"
        style={{
          background: "var(--bg-raised)",
          borderTop: "1px solid var(--border-subtle)",
          boxShadow: "0 -8px 24px -8px var(--shadow-nav, rgba(0,0,0,0.6))",
        }}
      >
        <ul className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
          {items.map(({ to, labelKey, fallback, Icon, exact }) => {
            const active = exact
              ? pathname === to
              : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <li key={to} className="flex-1 min-w-0">
                <Link
                  to={to as never}
                  preload="intent"
                  aria-label={t(labelKey, fallback)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (!active) haptic("selection");
                  }}
                  className="relative flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5"
                  style={{
                    minHeight: 52,
                    // Inactive uses --text-secondary (AA ~4.9:1) not --text-tertiary
                    color: active ? "var(--rebuilt-gold)" : "var(--text-secondary)",
                    transition: "color 150ms var(--ease-spring)",
                  }}
                >
                  {active && (
                    <motion.span
                      aria-hidden
                      layoutId="rb-tab-indicator"
                      className="absolute -top-[1.5px] h-[2px] rounded-full"
                      style={{
                        width: 24,
                        background: "var(--rebuilt-gold)",
                        boxShadow: "0 0 12px var(--rebuilt-gold-glow)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.75} />
                  <span
                    className="font-semibold truncate w-full text-center"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.04em",
                      textTransform: "none",
                    }}
                  >
                    {t(labelKey, fallback)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
