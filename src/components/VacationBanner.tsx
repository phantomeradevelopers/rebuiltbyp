import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Palmtree, ArrowRight } from "lucide-react";
import { getVacationStatus, type VacationStatus } from "@/lib/vacation.functions";

/**
 * Compact banner shown on /app and /app/coach while vacation mode is active.
 * Tap → /app/account to end the vacation.
 */
export function VacationBanner() {
  const fetchStatus = useServerFn(getVacationStatus);
  const [status, setStatus] = useState<VacationStatus | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStatus(await fetchStatus());
      } catch {
        /* silent */
      }
    })();
  }, [fetchStatus]);

  if (!status?.active) return null;

  const daysLeft = status.vacationUntil
    ? Math.max(
        0,
        Math.ceil(
          (new Date(`${status.vacationUntil}T23:59:59Z`).getTime() - Date.now()) /
            86_400_000,
        ),
      )
    : null;

  return (
    <Link
      to="/app/account"
      className="block rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 to-transparent p-4 hover:border-gold/70 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gold/15 flex items-center justify-center text-gold">
          <Palmtree className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-gold text-xs">VACATION MODE · ACTIVE</p>
          <p className="text-sm text-foreground">
            {daysLeft !== null && daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left · until ${status.vacationUntil}`
              : `Through ${status.vacationUntil}`}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-gold" />
      </div>
    </Link>
  );
}
