import { Link } from "@tanstack/react-router";
import { useTrack } from "@/lib/track";
import mark from "@/assets/rebuilt-mark.png.asset.json";

/**
 * REBUILT logo — R mark tile + clean wordmark + "BY P" tagline in gold.
 * On the Angels track the "BY P" line becomes "ANGELS BY P".
 */
export function Logo({ size = "md", showTagline = true }: { size?: "sm" | "md" | "lg"; showTagline?: boolean }) {
  const wordClass =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : size === "sm"
        ? "text-xs"
        : "text-lg sm:text-xl";
  const tagClass =
    size === "lg"
      ? "text-[11px] tracking-[0.4em]"
      : size === "sm"
        ? "text-[8px] tracking-[0.3em]"
        : "text-[9px] sm:text-[10px] tracking-[0.36em]";
  const markSize =
    size === "lg" ? "h-11 w-11" : size === "sm" ? "h-5 w-5" : "h-8 w-8 sm:h-9 sm:w-9";

  let track: "men" | "angels" = "men";
  try {
    track = useTrack().track;
  } catch {
    track = "men";
  }
  const isAngels = track === "angels";

  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2.5 select-none"
      aria-label={isAngels ? "REBUILT Angels by P" : "REBUILT by P"}
    >
      <img
        src={mark.url}
        alt=""
        width={64}
        height={64}
        className={`${markSize} rounded-[22%] shrink-0`}
        draggable={false}
        decoding="async"
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-wordmark font-bold uppercase tracking-[0.28em] ${wordClass}`}
          style={{ color: "#ffffff" }}
        >
          REBUILT
        </span>
        {showTagline && (
          <span
            className={`mt-1 uppercase font-medium ${tagClass}`}
            style={{ color: "var(--rebuilt-gold)" }}
          >
            {isAngels ? "Angels · By P" : "By P"}
          </span>
        )}
      </span>
    </Link>
  );
}
