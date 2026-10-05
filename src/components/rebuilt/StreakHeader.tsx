import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { getToday } from "@/lib/dashboard.functions";

/**
 * Persistent daily-streak chip shown on every /app page.
 * - Flame + day count
 * - Subtle pop animation when streak increments
 * - Amber "don't break it" glow if today's check-in isn't done
 * - Tap → today's check-in
 */
export function StreakHeader() {
  const { pathname } = useLocation();
  // Hide on onboarding/gender-required/welcome intake screens so nothing overlaps.
  const hide =
    pathname === "/app/welcome" ||
    pathname === "/app/gender-required" ||
    pathname === "/app/identity" ||
    pathname === "/app/readiness";

  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["streak-header", today],
    queryFn: () => getToday({ data: { date: today } }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const streak = data?.streak ?? 0;
  const doneToday = !!data?.checkinDoneToday;

  // Detect increments to fire a small celebrate pulse.
  const prevRef = useRef<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (prevRef.current !== null && streak > prevRef.current) {
      setPulseKey((k) => k + 1);
    }
    prevRef.current = streak;
  }, [streak]);

  if (hide || !data) return null;

  // Amber "don't break it" state: user has an active streak but hasn't
  // checked in yet today. Otherwise: calm gold when done, dim when zero.
  const atRisk = streak > 0 && !doneToday;
  const label = streak === 0 ? "Start today" : atRisk ? "Don't break it" : "Locked in";

  const color = atRisk
    ? "hsl(35 92% 60%)"
    : streak > 0
      ? "var(--rebuilt-gold, hsl(45 85% 62%))"
      : "var(--text-tertiary, hsl(0 0% 60%))";
  const glow = atRisk
    ? "0 0 14px hsl(35 92% 60% / 0.55)"
    : streak > 0
      ? "0 0 12px hsl(45 85% 62% / 0.45)"
      : "none";

  return (
    <div
      className="fixed top-0 left-0 z-30 pointer-events-none"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <Link
        to={"/app/checkin/today" as never}
        aria-label={`Streak ${streak} days — ${label}`}
        className="pointer-events-auto ml-3 mt-1 inline-flex items-center gap-2 rounded-full border pl-2.5 pr-3 h-9 active:scale-95 transition-transform"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          borderColor: atRisk ? "hsl(35 92% 60% / 0.55)" : "var(--border-subtle, rgba(255,255,255,0.12))",
          boxShadow: glow,
        }}
      >
        <motion.span
          key={pulseKey}
          initial={{ scale: 1 }}
          animate={{ scale: pulseKey ? [1, 1.35, 1] : 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center"
          style={{ color }}
        >
          <Flame
            className="h-4 w-4"
            strokeWidth={2.2}
            style={{ filter: streak > 0 ? "drop-shadow(0 0 6px currentColor)" : "none" }}
          />
        </motion.span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={streak}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="font-extrabold tabular-nums text-sm leading-none"
            style={{ color }}
          >
            {streak}
          </motion.span>
        </AnimatePresence>
        <span
          className="text-[10px] uppercase tracking-wider leading-none"
          style={{ color: "var(--text-secondary, rgba(255,255,255,0.7))", letterSpacing: "0.08em" }}
        >
          {streak === 1 ? "day" : "days"}
        </span>
      </Link>
    </div>
  );
}
