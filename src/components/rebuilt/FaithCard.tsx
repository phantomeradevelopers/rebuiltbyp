import { motion } from "motion/react";

interface FaithCardProps {
  /** The verse, quote, or devotional text. */
  text: string;
  /** Optional attribution / reference. */
  reference?: string;
  /** Optional eyebrow label. Defaults to "Today's word". */
  eyebrow?: string;
}

/**
 * Faith / scripture / daily-word card. Gold left-border motif used across
 * the app whenever a faith moment surfaces.
 */
export function FaithCard({ text, reference, eyebrow = "Today's word" }: FaithCardProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
      className="relative rounded-2xl px-5 py-4 overflow-hidden"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: "var(--rebuilt-gold)" }}
      />
      <p
        className="uppercase font-semibold"
        style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--rebuilt-gold)" }}
      >
        {eyebrow}
      </p>
      <p
        className="mt-2 italic"
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-sans)",
        }}
      >
        "{text}"
      </p>
      {reference && (
        <p
          className="mt-2 text-right"
          style={{ fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}
        >
          — {reference}
        </p>
      )}
    </motion.aside>
  );
}
