import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Sticky "Back to Today" pill, shown only when the user arrived from the
 * dashboard via a `?from=today` query param. Gives a one-tap exit back to
 * the workflow they came from.
 */
export function BackToTodayPill() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShow(new URLSearchParams(window.location.search).get("from") === "today");
  }, []);
  if (!show) return null;
  return (
    <div className="sticky top-2 z-30 mb-2 flex justify-center pointer-events-none">
      <Link
        to="/app"
        className="pointer-events-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-gold/50 bg-background/90 backdrop-blur text-xs font-medium text-gold shadow hover:bg-gold/10 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Today
      </Link>
    </div>
  );
}

/** True when the current URL carries `?from=today`. Client-only. */
export function cameFromToday(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("from") === "today";
}
