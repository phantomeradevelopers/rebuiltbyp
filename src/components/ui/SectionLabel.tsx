import { cn } from "@/lib/utils";

export function SectionLabel({ children, className, tone = "default" }: { children: React.ReactNode; className?: string; tone?: "default" | "primary" | "gold" }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "gold" ? "text-gold" : "text-foreground/80";
  return (
    <p className={cn("label-mono text-xs uppercase tracking-wide font-semibold", toneClass, className)}>
      {children}
    </p>
  );
}
