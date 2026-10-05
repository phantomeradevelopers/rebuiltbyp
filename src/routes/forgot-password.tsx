import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col px-6">
      <header className="pt-safe pt-6"><Logo /></header>
      <section className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <p className="label-mono text-gold">Reset password</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl text-foreground">Lost the keys?</h1>
        {sent ? (
          <div className="mt-6 rounded-md border border-border bg-card p-6">
            <p className="font-display text-xl">Check your email.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a reset link to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-md border border-border bg-input px-4 text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
            />
            <button disabled={busy} className="h-12 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <Link to={"/login" as never} className="mt-6 text-[12px] text-muted-foreground hover:text-foreground">← Back to sign in</Link>
      </section>
    </main>
  );
}
