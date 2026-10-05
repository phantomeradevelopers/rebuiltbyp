import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";

type Props = {
  eyebrow?: string;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Center the dialog instead of bottom-sheet style (for short content like affirmations). */
  variant?: "sheet" | "dialog";
  className?: string;
  /** Disable swipe-down-to-dismiss (e.g. while a timer is running). */
  swipeDisabled?: boolean;
};

/**
 * Unified shell for Journal / Mindset / Affirmation overlays.
 * - Same eyebrow + title typography
 * - Same close affordance (X button + tap-backdrop + swipe-down on sheet variant)
 * - Same backdrop blur and entrance animation
 */
export function SheetShell({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  variant = "sheet",
  className = "",
  swipeDisabled = false,
}: Props) {
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [0, 360], [1, 0]);
  const startedRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onDragEnd(_: unknown, info: PanInfo) {
    startedRef.current = false;
    if (info.offset.y > 120 || info.velocity.y > 600) {
      haptic("medium");
      animate(y, 600, { duration: 0.18, ease: "easeIn" });
      setTimeout(onClose, 160);
    } else {
      animate(y, 0, { type: "spring", stiffness: 320, damping: 30 });
    }
  }

  const isSheet = variant === "sheet";

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background/85 backdrop-blur-xl flex flex-col"
      style={{ opacity: backdropOpacity }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`${
          isSheet
            ? "mt-auto w-full max-w-md mx-auto rounded-t-3xl bg-card border-t border-x border-border shadow-2xl"
            : "m-auto w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
        } flex flex-col max-h-[92dvh] ${className}`}
        onClick={(e) => e.stopPropagation()}
        initial={isSheet ? { y: 80, opacity: 0 } : { scale: 0.96, opacity: 0 }}
        animate={isSheet ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
        exit={isSheet ? { y: 80, opacity: 0 } : { scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        style={isSheet ? { y } : undefined}
        drag={isSheet && !swipeDisabled ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragStart={() => {
          if (!startedRef.current) {
            startedRef.current = true;
            haptic("light");
          }
        }}
        onDragEnd={onDragEnd}
      >
        {/* Header */}
        <div className="relative pt-3 px-5 pb-3 shrink-0">
          {isSheet && (
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="label-mono text-gold text-[11px] uppercase tracking-[0.18em]">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="mt-1 font-display text-2xl sm:text-3xl leading-tight text-gold-shimmer">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 h-9 w-9 -mr-1 inline-flex items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground active:scale-95 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="shrink-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 border-t border-border/60 bg-card"
          >
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
