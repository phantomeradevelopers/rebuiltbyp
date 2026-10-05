import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Delete, LogOut } from "lucide-react";
import { adminPinStatus, adminPinLogin, adminPinSetup, adminPinLogout } from "@/lib/admin-pin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { title: "REBUILT — Admin console" },
      { name: "description", content: "Private operator console for REBUILT." },
    ],
  }),
  component: AdminShell,
});

const TABS: { to: string; label: string; help: string }[] = [
  { to: "/admin", label: "Analytics", help: "Traffic, funnel, clicks, money" },
  { to: "/admin/members", label: "Members", help: "Everyone who signed up" },
  { to: "/admin/course", label: "Course", help: "Buyers, progress, drop-off" },
  { to: "/admin/money", label: "Money", help: "Revenue, churn, lifetime value" },
  { to: "/admin/features", label: "Features", help: "What people actually use" },
  { to: "/admin/coaching", label: "Coaching", help: "The 1-on-1 program" },
  { to: "/admin/support", label: "Support", help: "Messages and feedback" },
  { to: "/admin/content", label: "Content", help: "Publish and edit" },
  { to: "/admin/pin", label: "PIN", help: "Change the entry code" },
];


function AdminShell() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["admin-pin-status"],
    queryFn: () => adminPinStatus(),
    staleTime: 0,
    // Keep the previous answer while re-checking. Without this the gate
    // unmounts on every refetch and a half-finished PIN setup is thrown away.
    placeholderData: (prev) => prev,
  });


  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!status.data) {
    return <div className="min-h-screen bg-background grid place-items-center text-sm text-muted-foreground">Checking…</div>;
  }


  if (!status.data?.authed) {
    return (
      <PinGate
        configured={Boolean(status.data?.configured)}
        lockedUntil={status.data?.lockedUntil ?? null}
        attemptsLeft={status.data?.attemptsLeft ?? 10}
        permanentlyLocked={Boolean(status.data?.permanentlyLocked)}
        onDone={() => {
          // Read the server state directly and seed the cache: the lock screen
          // must never render a stale attempt count.
          void adminPinStatus().then((s) => qc.setQueryData(["admin-pin-status"], s));
        }}



      />
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="label-mono text-gold text-[10px]">REBUILT</p>
            <h1 className="font-display text-xl leading-none">Admin console</h1>
          </div>
          <div className="flex items-center gap-2">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </a>
          <button
            onClick={async () => {
              await adminPinLogout();
              qc.clear();
              // Reload rather than invalidate: the cleared cache leaves the
              // status observer holding its last "authed" answer, which kept
              // the console on screen after locking it.
              window.location.assign("/admin");
            }}

            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Lock
          </button>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = t.to === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to as never}
                className={`shrink-0 h-11 px-4 rounded-md text-sm flex items-center transition-colors ${
                  active ? "bg-gold/15 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
                title={t.help}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}

function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return null;
  const ms = until - now;
  if (ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function PinGate({
  configured,
  lockedUntil,
  attemptsLeft,
  permanentlyLocked,
  onDone,
}: {
  configured: boolean;
  lockedUntil: number | null;
  attemptsLeft: number;
  permanentlyLocked: boolean;
  onDone: () => void;
}) {
  // The digits are plain state. The keypad's updater ONLY appends and returns —
  // it never submits and never touches other state. React may run an updater
  // twice in development, so any side effect placed inside it fires twice and
  // any state set from inside it is silently dropped.
  const [pin, setPin] = useState("");
  // The first entry of a new code lives in a ref, not in state: a ref survives
  // every re-render and cannot be captured stale by an async closure. It is a
  // plain 6-character string, compared raw against the confirm entry.
  const firstRef = useRef<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Guard so a full 6-digit code can only ever be submitted once.
  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(lockedUntil);
  const locked = permanentlyLocked || Boolean(countdown);

  // Re-check the server the moment a timed lock expires.
  useEffect(() => {
    if (!lockedUntil || permanentlyLocked) return;
    const ms = lockedUntil - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(onDone, ms + 500);
    return () => clearTimeout(id);
  }, [lockedUntil, permanentlyLocked, onDone]);

  function restartSetup() {
    firstRef.current = null;
    setConfirming(false);
    setPin("");
  }

  // Submission is driven by an effect watching the digit count, never by the
  // keypad handler and never from inside a state updater.
  useEffect(() => {
    if (pin.length !== 6) return;
    if (submittingRef.current) return;
    submittingRef.current = true;

    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        if (!configured) {
          const first = firstRef.current;
          if (first === null || !/^\d{6}$/.test(first)) {
            // Store the first code and move to the confirm step. Both of these
            // run in a normal effect, so they are real state updates.
            firstRef.current = pin;
            if (!cancelled) {
              setConfirming(true);
              setPin("");
            }
            return;
          }
          // Raw string comparison, before anything is hashed.
          if (first !== pin) {
            toast.error("The two codes did not match. Start again.");
            if (!cancelled) restartSetup();
            return;
          }
          await adminPinSetup({ data: { pin } });
          firstRef.current = null;
          toast.success("PIN set. You're in.");
        } else {
          await adminPinLogin({ data: { pin } });
        }
        if (!cancelled) setPin("");
        // Hard reload: the session cookie is fresh, so the console renders from
        // a clean server-rendered state instead of a half-invalidated cache.
        window.location.assign("/admin");
      } catch (e) {
        toast.error((e as Error).message);
        if (!cancelled) {
          if (!configured) restartSetup();
          else setPin("");
        }
        onDone();
      } finally {
        if (!cancelled) setBusy(false);
        submittingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, configured]);

  function press(k: string) {
    if (locked || submittingRef.current || busy) return;
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    // Pure updater: append and return. Nothing else happens in here.
    setPin((p) => (p.length >= 6 ? p : p + k));
  }



  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10 relative">
      <a
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to site
      </a>
      <p className="label-mono text-gold text-[10px]">REBUILT</p>
      <h1 className="font-display text-2xl mt-1">Admin console</h1>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-xs">
        {permanentlyLocked
          ? "This console is permanently locked after 10 wrong codes. Only the owner can restore access from the backend."
          : countdown
            ? "Locked after 5 wrong codes."
            : !configured
              ? !confirming
                ? "First time here. Choose a 6-digit code."
                : "Enter the same code again to confirm."

              : "Enter your 6-digit code."}
      </p>

      {countdown && !permanentlyLocked && (
        <p className="mt-3 font-display text-3xl tabular-nums text-gold" role="timer" aria-live="polite">
          {countdown}
        </p>
      )}

      <div className="flex gap-3 mt-7 mb-8" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border transition-colors ${
              pin.length > i ? "bg-gold border-gold" : "border-muted-foreground/40"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {keys.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={locked || busy}
              aria-label={k === "del" ? "Delete" : k}
              onClick={() => press(k)}
              className="h-16 rounded-2xl border border-border bg-card text-2xl font-display grid place-items-center active:scale-95 transition disabled:opacity-40"
            >
              {k === "del" ? <Delete className="h-5 w-5" /> : k}
            </button>
          ),
        )}
      </div>

      <p className="mt-8 text-[11px] text-muted-foreground text-center max-w-xs">
        {permanentlyLocked
          ? "Access is closed until the entry code is reset from the database."
          : configured
            ? `Five wrong codes locks this door for 15 minutes. Ten in total locks it for good. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`
            : "Choose a code you will remember. Five wrong codes locks this door for 15 minutes; ten locks it for good."}
      </p>
    </div>
  );
}

