import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY event when arriving from a reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also handle case where session is already present
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated.");
    navigate({ to: "/app" as never, replace: true });
  }

  return (
    <main className="min-h-screen bg-background flex flex-col px-6">
      <header className="pt-safe pt-6"><Logo /></header>
      <section className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <p className="label-mono text-gold">New password</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl text-foreground">Set a new password.</h1>
        <p className="mt-3 text-sm text-muted-foreground">Minimum 8 characters.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-md border border-border bg-input px-4 text-foreground focus:border-gold focus:outline-none"
          />
          <button disabled={busy || !ready} className="h-12 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Saving…" : ready ? "Update password" : "Waiting for reset link…"}
          </button>
        </form>
      </section>
    </main>
  );
}
