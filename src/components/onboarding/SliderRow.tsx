import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

type Props = {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  minLabel?: string;
  maxLabel?: string;
  format?: (v: number) => string;
};

export function SliderRow({
  label, value, onChange, min, max, step = 1,
  suffix, minLabel, maxLabel, format,
}: Props) {
  const isSet = value !== undefined;
  const initial = value ?? min;
  const display = format ? format(initial) : String(initial);

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="text-sm">{label}</label>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl text-gold leading-none tabular-nums">
            {isSet ? display : "—"}
          </span>
          {suffix && <span className="label-mono text-muted-foreground">{suffix}</span>}
        </div>
      </div>

      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center h-6"
        value={[initial]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      >
        <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden bg-border">
          {isSet && <SliderPrimitive.Range className="absolute h-full bg-gold" />}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={`block h-4 w-4 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            isSet ? "bg-gold border border-gold" : "bg-background border-2 border-gold/70"
          }`}
          style={
            isSet
              ? { boxShadow: "0 0 0 4px oklch(0.74 0.10 80 / 0.15), 0 0 12px oklch(0.74 0.10 80 / 0.4)" }
              : { boxShadow: "0 0 0 3px color-mix(in oklab, var(--gold) 18%, transparent)" }
          }
        />
      </SliderPrimitive.Root>

      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-2 label-mono text-xs text-muted-foreground">
          <span>{minLabel ?? min}</span>
          <span>{maxLabel ?? max}</span>
        </div>
      )}
    </div>
  );
}

