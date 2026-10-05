import { ensureReviewAccount, REVIEW_EMAIL } from "@/lib/review-account.functions";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { createDemoSession } from "@/lib/demo.functions";
import { Sparkles, Mail } from "lucide-react";
import { safeRedirect } from "@/lib/safe-redirect";


type LoginSearch = { redirect?: string };


export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: safeRedirect(search.redirect),
  }),
  component: Login,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const to = safeRedirect((search as LoginSearch).redirect);
      throw redirect({ to: to as never });
    }
  },
});

function Login() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const dest = safeRedirect(redirectTo);
  const emailRedirect = typeof window !== "undefined" ? `${window.location.origin}${dest}` : dest;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<null | "google" | "apple">(null);




  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && email.trim().toLowerCase() === REVIEW_EMAIL) {
          const r = await ensureReviewAccount({ data: { password } });
          if (r.ok) {
            ({ error } = await supabase.auth.signInWithPassword({ email, password }));
            try { localStorage.setItem("rebuilt_welcome_completed_v1", "1"); } catch { /* noop */ }
          }
        }
        if (error) throw error;
        navigate({ to: dest as never, replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirect },
        });
        if (error) throw error;
        setSignupSent(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDemo() {
    setDemoBusy(true);
    try {
      const { email, password } = await createDemoSession();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Demo accounts skip onboarding AND the welcome intake, landing on Today.
      try { localStorage.setItem("rebuilt_welcome_completed_v1", "1"); } catch { /* noop */ }
      navigate({ to: "/app" as never, replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setDemoBusy(false);
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    setOauthBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}${dest}`,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider === "apple" ? "Apple" : "Google"} sign-in failed`);
        setOauthBusy(null);
        return;
      }
      if (result.redirected) return;
      navigate({ to: dest as never, replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setOauthBusy(null);
    }
  }

  return (
    <main
      className="relative min-h-screen flex flex-col px-6"
      style={{ backgroundColor: "var(--bg-base, #08080C)" }}
    >
      {/* Subtle gold-glow halo behind the wordmark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 20%, var(--rebuilt-gold-glow) 0%, transparent 70%)",
          opacity: 0.55,
        }}
      />
      <section className="relative flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="flex justify-center mb-8">
          {/* B&W lockup — do not theme */}
          <img
            src="/icon-512.png"
            alt="REBUILT"
            width={512}
            height={512}
            decoding="async"
            className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-xl"
          />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-[color:var(--text-primary)] text-center leading-[1.05]">
          {mode === "signin" ? "Welcome back." : "From the wreck to the way back."}
        </h1>




        <div className="mt-8 space-y-3">
          {/* Apple — primary native-style button, white on dark */}
          <button
            type="button"
            onClick={() => onOAuth("apple")}
            disabled={oauthBusy !== null}
            className="inline-flex min-h-[52px] h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-[15px] font-medium text-black transition-all active:scale-[0.98] hover:bg-white/95 disabled:opacity-60 shadow-[0_4px_20px_-4px_rgba(255,255,255,0.18)]"
            aria-label="Continue with Apple"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] -mt-0.5" aria-hidden="true" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {oauthBusy === "apple" ? "Opening Apple…" : "Continue with Apple"}
          </button>

          {/* Google — secondary native-style button */}
          <button
            type="button"
            onClick={() => onOAuth("google")}
            disabled={oauthBusy !== null}
            className="inline-flex min-h-[52px] h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] text-[15px] font-medium text-[color:var(--text-primary)] transition-all active:scale-[0.98] hover:bg-[color:var(--bg-elevated)] disabled:opacity-60"
            aria-label="Continue with Google"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.605 4.605 0 0 1-1.996 3.018v2.51h3.232c1.891-1.741 2.982-4.305 2.982-7.351z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.896.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.596-4.122H3.064v2.59A9.996 9.996 0 0 0 12 22z"/>
              <path fill="#FBBC05" d="M6.404 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.064a9.996 9.996 0 0 0 0 8.98l3.34-2.59z"/>
              <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 3.077 14.696 2 12 2A9.996 9.996 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977z"/>
            </svg>
            {oauthBusy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          {/* Email — collapsed by default for cleaner mobile-first flow */}
          {!showEmail && !signupSent && (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="inline-flex min-h-[52px] h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-transparent text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              <Mail className="h-4 w-4" />
              Continue with email
            </button>
          )}
        </div>

        {(showEmail || signupSent) && (
          <>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-[color:var(--border-strong)]" />
              <span className="label-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">email</span>
              <span className="h-px flex-1 bg-[color:var(--border-strong)]" />
            </div>

            {signupSent ? (
              <div className="mt-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] p-6">
                <p className="font-display text-xl text-[color:var(--rebuilt-gold)]">Check your email.</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  We sent a confirmation link to <span className="text-[color:var(--text-primary)]">{email}</span>. Tap it to finish setting up your account.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-[52px] w-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 text-[15px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--rebuilt-gold)] focus:outline-none focus:shadow-[0_0_0_3px_var(--rebuilt-gold-dim)] transition"
                />
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[52px] w-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 text-[15px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--rebuilt-gold)] focus:outline-none focus:shadow-[0_0_0_3px_var(--rebuilt-gold-dim)] transition"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[52px] h-[52px] w-full items-center justify-center rounded-2xl bg-[color:var(--rebuilt-gold)] text-[15px] font-semibold text-black transition-all active:scale-[0.98] hover:bg-[color:var(--rebuilt-gold-light)] disabled:opacity-60 shadow-[0_8px_24px_-8px_var(--rebuilt-gold-glow)]"
                >
                  {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
                <div className="flex items-center justify-between pt-1 text-[12px] text-[color:var(--text-tertiary)]">
                  <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSignupSent(false); }} className="hover:text-[color:var(--text-primary)]">
                    {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                  {mode === "signin" && (
                    <Link to={"/forgot-password" as never} className="hover:text-[color:var(--text-primary)]">Forgot password?</Link>
                  )}
                </div>
              </form>
            )}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-[color:var(--border-strong)]">
          <p className="label-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Just looking?</p>
          <button
            onClick={onDemo}
            disabled={demoBusy}
            className="mt-3 inline-flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--rebuilt-gold-solid)] bg-[color:var(--rebuilt-gold-dim)] text-sm font-medium text-[color:var(--rebuilt-gold)] transition-colors hover:bg-[color:var(--rebuilt-gold-glow)] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {demoBusy ? "Spinning up demo…" : "Try the demo"}
          </button>
          <p className="mt-2 text-[11px] text-[color:var(--text-tertiary)]">
            Sandboxed demo account — no signup, no real data written.
          </p>
        </div>


        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to={"/legal" as never} className="underline hover:text-foreground">Terms & Privacy</Link>.
        </p>

        <footer className="mt-10 pb-safe text-center">
          <p className="font-display text-sm text-foreground">
            REBUILT is a movement. The program is the door.
          </p>
        </footer>
      </section>
    </main>
  );
}
