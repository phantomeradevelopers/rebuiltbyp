import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Smartphone, Sunrise, Sun, Moon, X } from "lucide-react";
import { enablePush, disablePush, isPushSupported, isPreviewIframe, recordPrePromptDismissed } from "@/lib/push-client";
import { getPushStatus, sendTestPush } from "@/lib/push.functions";

export function EnablePushCard() {
  const [supported, setSupported] = useState(true);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [devices, setDevices] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  async function refresh() {
    try {
      const s = await getPushStatus();
      setDevices(s.activeDevices);
    } catch {}
  }

  useEffect(() => {
    setSupported(isPushSupported());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    refresh();
  }, []);

  async function reallyEnable() {
    setBusy(true);
    try {
      const res = await enablePush();
      if (!res.ok) toast.error(res.reason ?? "Could not enable.");
      else {
        toast.success("Phone notifications on. 3 daily drops from P.");
        setPerm(Notification.permission);
        refresh();
      }
    } finally { setBusy(false); }
  }

  function onEnable() {
    if (isPreviewIframe()) {
      toast.info("Open the published app on your phone to enable notifications.");
      return;
    }
    // Soft pre-prompt before the OS dialog (single chance per browser).
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      setShowPrompt(true);
      return;
    }
    reallyEnable();
  }
  async function onDisable() {
    setBusy(true);
    try { await disablePush(); toast.success("Notifications off on this device."); refresh(); }
    finally { setBusy(false); }
  }
  async function onTest() {
    setBusy(true);
    try {
      const r = await sendTestPush();
      if (r.sent > 0) toast.success(`Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}.`);
      else toast.error("No active devices. Enable notifications first.");
    } finally { setBusy(false); }
  }

  const enabled = perm === "granted" && devices > 0;

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold flex items-center gap-1.5"><BellRing className="h-3 w-3" /> Phone notifications</p>
        <p className="text-sm mt-2">3 motivation drops daily — morning, midday, evening.</p>

        {!supported && (
          <p className="text-xs text-muted-foreground mt-2">Your browser doesn't support push. Try Chrome on Android or Safari on iOS 16.4+.</p>
        )}

        {supported && (
          <>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {enabled
                  ? `On — ${devices} device${devices === 1 ? "" : "s"}`
                  : perm === "denied"
                    ? "Blocked in browser settings"
                    : "Off"}
              </span>
            </div>

            {perm === "denied" && !enabled && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
                <p className="text-[11px] label-mono text-destructive">Permission blocked</p>
                <p className="text-xs text-muted-foreground">
                  Your browser is set to deny notifications for this site. Reset
                  it: tap the lock icon in the address bar → Site settings →
                  Notifications → <strong>Allow</strong>, then reload.
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {!enabled ? (
                <button
                  onClick={onEnable}
                  disabled={busy || perm === "denied"}
                  className="col-span-2 h-11 btn-gold rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {busy
                    ? "Enabling…"
                    : perm === "denied"
                      ? "Unblock in browser to enable"
                      : "Enable on this device"}
                </button>
              ) : (
                <>
                  <button onClick={onTest} disabled={busy}
                    className="h-10 rounded-md border border-gold/40 text-gold text-xs hover:bg-gold/5 disabled:opacity-60">
                    Send test
                  </button>
                  <button onClick={onDisable} disabled={busy}
                    className="h-10 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-60">
                    Turn off here
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 rounded-md border border-border bg-background p-3 space-y-1.5">
              <p className="text-[11px] label-mono text-muted-foreground">iPhone setup</p>
              <p className="text-xs">Open in Safari → Share → <strong>Add to Home Screen</strong> → open from icon → tap Enable.</p>
            </div>
          </>
        )}
      </section>

      {showPrompt && (
        <PushPrePromptDialog
          onAccept={() => { setShowPrompt(false); reallyEnable(); }}
          onDismiss={() => { setShowPrompt(false); recordPrePromptDismissed(); }}
        />
      )}
    </>
  );
}

function PushPrePromptDialog({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-safe">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-gold" />
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-4 font-display text-2xl leading-tight">Stay on the path.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Three nudges a day so the streak doesn't break. Quiet otherwise.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2.5"><Sunrise className="h-4 w-4 text-gold shrink-0" /> Morning intent</li>
          <li className="flex items-center gap-2.5"><Sun className="h-4 w-4 text-gold shrink-0" /> Midday check-in</li>
          <li className="flex items-center gap-2.5"><Moon className="h-4 w-4 text-gold shrink-0" /> Evening reflection</li>
        </ul>
        <div className="mt-6 space-y-2">
          <button onClick={onAccept} className="h-12 w-full btn-gold rounded-md text-sm font-medium">
            Turn on reminders
          </button>
          <button onClick={onDismiss} className="h-11 w-full text-xs label-mono text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Your phone will ask permission next. You can turn this off any time.
        </p>
      </div>
    </div>
  );
}
