import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { qaLogin, qaStatus } from "@/lib/qa.functions";
import { RouteNotFound } from "@/components/RouteNotFound";

export const Route = createFileRoute("/qa")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "—" }] }),
  component: QaGate,
  notFoundComponent: () => <RouteNotFound />,
});

function QaGate() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    void qaStatus()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (pin.length !== 6 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const { email, password } = await qaLogin({ data: { pin } });
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error("Incorrect code.");
        // Skip the first-run welcome flow — QA lands straight on Today.
        try {
          localStorage.setItem("rebuilt_welcome_completed_v1", "1");
        } catch {
          /* ignore */
        }
        await navigate({ to: "/app", replace: true });
      } catch (e) {
        setError((e as Error).message || "Incorrect code.");
        setPin("");
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    })();
  }, [pin, navigate]);

  if (enabled === null) return <div className="min-h-screen bg-background" />;
  if (!enabled) throw notFound();

  const press = (d: string) => setPin((p) => (p.length >= 6 || busy ? p : p + d));
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <h1 className="sr-only">Enter code</h1>
      <div className="flex gap-3 mb-8" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border border-border ${i < pin.length ? "bg-foreground" : ""}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            disabled={busy}
            className="h-16 w-16 rounded-full border border-border text-xl text-foreground disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          disabled={busy}
          className="h-16 w-16 rounded-full border border-border text-xl text-foreground disabled:opacity-40"
        >
          0
        </button>
        <button
          onClick={back}
          disabled={busy}
          aria-label="Delete"
          className="h-16 w-16 rounded-full text-xl text-muted-foreground disabled:opacity-40"
        >
          ⌫
        </button>
      </div>
      <p className="mt-8 h-5 text-sm text-destructive" role="alert">
        {error ?? ""}
      </p>
    </main>
  );
}
