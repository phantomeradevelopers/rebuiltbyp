import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/haptics";
import { springConfig } from "@/lib/motion-rebuilt";

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

/**
 * +/– numeric stepper with a large display readout.
 * Used by the sleep step in the check-in.
 */
export function Stepper({ value, onChange, min = 0, max = 24, step = 0.5, suffix = "h" }: StepperProps) {
  const dec = () => {
    if (value <= min) return;
    haptic("selection");
    onChange(Math.max(min, +(value - step).toFixed(1)));
  };
  const inc = () => {
    if (value >= max) return;
    haptic("selection");
    onChange(Math.min(max, +(value + step).toFixed(1)));
  };
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[color:var(--bg-raised)] border border-[color:var(--rebuilt-gold)]/30 p-3">
      <StepperBtn label="decrement" onClick={dec} disabled={value <= min}>
        <Minus className="h-5 w-5" />
      </StepperBtn>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span
          className="font-display font-semibold tracking-tight text-[color:var(--rebuilt-gold-bright)]"
          style={{ fontSize: 56, lineHeight: 1 }}
        >
          {value}
        </span>
        <span className="text-sm text-[color:var(--text-secondary)] uppercase tracking-[0.12em]">
          {suffix}
        </span>
      </div>
      <StepperBtn label="increment" onClick={inc} disabled={value >= max}>
        <Plus className="h-5 w-5" />
      </StepperBtn>
    </div>
  );
}

function StepperBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={springConfig}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "h-14 w-14 rounded-xl grid place-items-center border transition-colors",
        disabled
          ? "border-[color:var(--border-strong,rgba(255,255,255,0.06))] text-[color:var(--text-tertiary)]"
          : "border-[color:var(--rebuilt-gold)]/50 text-[color:var(--rebuilt-gold)] hover:bg-[color:var(--rebuilt-gold-dim)]",
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
