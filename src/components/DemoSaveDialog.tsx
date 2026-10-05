import { useState } from "react";
import { toast } from "sonner";
import { Save, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { claimDemoAccount } from "@/lib/demo.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function DemoSaveDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function reset() {
    setBusy(false);
    setFirstName("");
    setEmail("");
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const e1 = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e1)) { toast.error("Enter a valid email."); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    setBusy(true);
    try {
      await claimDemoAccount({ data: { email: e1, password, firstName: firstName.trim() || undefined } });
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email: e1, password });
      if (error) throw error;
      toast.success("Account saved. Welcome back any time.");
      onOpenChange(false);
      navigate({ to: "/app" as never, replace: true });
      setTimeout(() => window.location.reload(), 50);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gold">
            <Save className="h-4 w-4" /> Save your progress
          </DialogTitle>
          <DialogDescription>
            Turn this demo into your real account. Your plan, check-ins, journals, photos, and coach history all stay with you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name (optional)"
            maxLength={80}
            className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
          />
          <input
            autoFocus
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={255}
            className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            minLength={8}
            maxLength={72}
            className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            minLength={8}
            maxLength={72}
            className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-md btn-gold flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {busy ? "Saving…" : "Save my account"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            You'll sign in with this email and password next time. The demo bar will disappear and your account becomes permanent.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
