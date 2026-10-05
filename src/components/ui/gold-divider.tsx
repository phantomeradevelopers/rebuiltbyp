export function GoldDivider({ className = "" }: { className?: string }) {
  return <div className={`hairline ${className}`} aria-hidden />;
}

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="label-mono text-gold whitespace-nowrap">{children}</span>
      <div className="hairline flex-1" />
    </div>
  );
}
