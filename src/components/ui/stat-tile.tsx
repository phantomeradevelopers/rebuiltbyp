export function StatTile({
  label,
  value,
  suffix,
  delta,
  icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card-elevated p-4 animate-count-up">
      <div className="flex items-center gap-1.5 text-gold">
        {icon}
        <p className="label-mono">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl leading-none">
        {value}
        {suffix && <span className="text-base text-muted-foreground ml-1">{suffix}</span>}
      </p>
      {delta && <p className="mt-1.5 text-[11px] text-muted-foreground">{delta}</p>}
    </div>
  );
}
