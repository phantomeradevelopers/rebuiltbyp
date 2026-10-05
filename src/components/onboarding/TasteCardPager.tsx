import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REBUILT_EASE } from "@/lib/motion";


export type TasteCard = {
  id: string;
  title?: string;
  sub?: string;
  content: ReactNode;
  /** Count of currently-selected items on this card. Drives auto-advance. */
  selectedCount?: number;
  /** When selectedCount reaches this threshold, auto-advance to the next card. */
  autoAdvanceAt?: number;
};

type Props = {
  cards: TasteCard[];
  onDone?: () => void;
  onIndexChange?: (i: number, isLast: boolean) => void;
};

export type TasteCardPagerHandle = {
  next: () => void;
  back: () => void;
  index: number;
  isFirst: boolean;
  isLast: boolean;
};

/**
 * iPhone-faithful, dot-paged taste micro-flow.
 * Navigation is driven externally by the standard onboarding chrome
 * (header back chevron + footer Next pill). No auto-advance.
 */
export const TasteCardPager = forwardRef<TasteCardPagerHandle, Props>(function TasteCardPager(
  { cards, onDone, onIndexChange },
  ref,
) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const card = cards[i];

  const go = (next: number) => {
    if (next < 0) return;
    if (next >= cards.length) {
      onDone?.();
      return;
    }
    setDir(next > i ? 1 : -1);
    setI(next);
  };

  useImperativeHandle(ref, () => ({
    next: () => go(i + 1),
    back: () => go(i - 1),
    index: i,
    isFirst: i === 0,
    isLast: i === cards.length - 1,
  }), [i, cards.length]);

  useEffect(() => {
    onIndexChange?.(i, i === cards.length - 1);
  }, [i, cards.length, onIndexChange]);

  // Auto-advance when this card's selectedCount crosses its threshold.
  const prevCountRef = useRef<number>(card?.selectedCount ?? 0);
  useEffect(() => {
    prevCountRef.current = card?.selectedCount ?? 0;
  }, [i, card?.id]);
  useEffect(() => {
    const threshold = card?.autoAdvanceAt;
    const count = card?.selectedCount ?? 0;
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (!threshold || count < threshold || prev >= threshold) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => go(i + 1), reduce ? 0 : 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.selectedCount, card?.autoAdvanceAt, i]);

  if (!card) return null;

  return (
    <div className="select-none">


      {/* Card */}
      <div className="relative min-h-[280px]">
        <AnimatePresence initial={false} mode="wait" custom={dir}>
          <motion.div
            key={card.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.35, ease: REBUILT_EASE }}
          >
            {card.title && <h3 className="font-display text-[1.5rem] sm:text-2xl leading-tight text-foreground text-center">{card.title}</h3>}
            {card.sub && (
              <p className="text-xs text-muted-foreground mt-1 mb-4 text-center">{card.sub}</p>
            )}
            {!card.sub && <div className="mb-4" />}
            {card.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});
