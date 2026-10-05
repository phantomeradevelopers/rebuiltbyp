import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useState } from "react";
import { ChevronLeft, KeyRound } from "lucide-react";
import { redeemCode } from "@/lib/entitlement.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/redeem")({ component: RedeemPage, errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />, notFoundComponent: () => <RouteNotFound /> });

function RedeemPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { entitlement } = await redeemCode({ data: { code } });
      toast.success(entitlement === "lifetime" ? "Lifetime access unlocked." : "Access unlocked.");
      navigate({ to: "/app" as never, replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh px-6 py-8 max-w-md mx-auto">
      <Link to={"/app/account" as never} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <div className="mt-6 flex items-center gap-2 text-gold">
        <KeyRound className="h-4 w-4" />
        <p className="label-mono">Redeem a code</p>
      </div>
      <h1 className="mt-2 font-display text-3xl">Got a code?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the code you received. Codes are case-insensitive.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="REBUILT-XXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          className="h-12 w-full rounded-md border border-border bg-input px-4 text-foreground tracking-widest uppercase focus:border-gold focus:outline-none"
        />
        <button
          disabled={busy || code.trim().length < 4}
          className="h-12 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Redeem"}
        </button>
      </form>
    </div>
  );
}
