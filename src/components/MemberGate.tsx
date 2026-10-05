import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Wraps content that requires a paid Member subscription (or active trial).
 * If `isMember` is true, renders children. Otherwise renders an upgrade card.
 */
export function MemberGate({
  isMember,
  feature,
  title,
  description,
  children,
}: {
  isMember: boolean;
  feature: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (isMember) return <>{children}</>;
  return (
    <div className="card-elevated p-5 space-y-3 border-gold/30">
      <div className="flex items-center gap-2 text-gold">
        <Lock className="h-4 w-4" />
        <p className="label-mono">Member only</p>
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link
        to={"/app/upgrade" as never}
        search={{ feature } as never}
        className="h-11 w-full rounded-md bg-gradient-to-r from-gold/90 to-gold text-sm font-medium text-gold-foreground inline-flex items-center justify-center gap-1.5 hover:from-gold hover:to-gold/90 transition"
      >
        <Sparkles className="h-3.5 w-3.5" /> Unlock with 7-day free trial
      </Link>
    </div>
  );
}
