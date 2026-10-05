import { cn } from "@/lib/utils";

/**
 * Premium shimmer skeleton — uses the .rb-skeleton gradient sweep defined in
 * styles.css instead of a flat pulse. Respects prefers-reduced-motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rb-skeleton", className)} {...props} />;
}

export { Skeleton };
