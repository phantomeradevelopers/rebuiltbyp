import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { enablePush, isPushSupported, isPreviewIframe, recordPrePromptDismissed } from "@/lib/push-client";

const SEEN_KEY = "rebuilt:first-win-push-asked";
const DISMISSED_KEY = "rebuilt:first-win-push-dismissed";

/**
 * Mount once at the app root. Listens for the very first "rebuilt:milestone"
 * event of a session and — only if:
 *   - push is supported
 *   - permission is still "default" (we've never asked)
 *   - user hasn't already dismissed this specific prompt
 * — surfaces an honest, dismissible ask for notifications AFTER their win.
 *
 * Never blocks the celebration. Never asks twice. Fully dismissible.
 */
export function FirstWinPushNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPushSupported()) return;
    if (isPreviewIframe()) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return;
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;

    let armed = true;
    function onMilestone() {
      if (!armed) return;
      armed = false;
      // Delay so the celebration is uninterrupted.
      setTimeout(() => {
        try { window.localStorage.setItem(SEEN_KEY, "1"); } catch {}
        setShow(true);
      }, 3500);
    }
    window.addEventListener("rebuilt:milestone", onMilestone);
    return () => window.removeEventListener("rebuilt:milestone", onMilestone);
  }, []);

  async function accept() {
    setShow(false);
    const res = await enablePush();
    if (res.ok) toast.success("Notifications on. Three drops a day.");
    else if (res.reason) toast.error(res.reason);
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
      recordPrePromptDismissed();
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-safe animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-gold/40 bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-gold" />
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-4 font-display text-2xl leading-tight">That was the first one.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Want a nudge from P so tomorrow's happens too? Three drops a day. Nothing else.
        </p>
        <div className="mt-5 space-y-2">
          <button onClick={accept} className="h-12 w-full btn-gold rounded-md text-sm font-medium">
            Turn on nudges
          </button>
          <button onClick={dismiss} className="h-10 w-full text-xs text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          You can change this any time in Settings.
        </p>
      </div>
    </div>
  );
}
