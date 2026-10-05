import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getFaithSettings, setFaithSettings } from "@/lib/faith.functions";
import { TRADITIONS } from "@/lib/spirit.functions";

const SEEN_KEY = "rebuilt:faith_prompt_seen";

export function FaithModePrompt() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [tradition, setTradition] = useState<string>("christian");
  const [saving, setSaving] = useState(false);
  const getSettings = useServerFn(getFaithSettings);
  const saveSettings = useServerFn(setFaithSettings);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SEEN_KEY)) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await getSettings();
        if (cancelled) return;
        // If a user already enabled faith mode elsewhere, treat as answered.
        if (s.faith_mode_enabled) {
          window.localStorage.setItem(SEEN_KEY, "1");
          return;
        }
        setOpen(true);
      } catch {
        // network/auth not ready — try again next mount
      }
    })();
    return () => { cancelled = true; };
  }, [getSettings]);

  function dismiss() {
    try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* noop */ }
    setOpen(false);
  }

  async function save() {
    setSaving(true);
    try {
      await saveSettings({
        data: enabled
          ? { faith_mode_enabled: true, tradition: tradition as never }
          : { faith_mode_enabled: false },
      });
      dismiss();
    } catch (e) {
      toast.error((e as Error).message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Faith mode?</DialogTitle>
          <DialogDescription>
            Add a faith-rooted tone — scripture, prayer, and devotional language in your daily nudges and coach replies.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Turn on faith mode</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">You can change this any time in settings.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              enabled ? "bg-gold border-gold" : "bg-card border-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="mt-3">
            <p className="label-mono mb-2 text-xs">Choose a tradition</p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {TRADITIONS.filter((t) => t.value !== "secular").map((t) => {
                const on = tradition === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTradition(t.value)}
                    className={`h-10 rounded-md border text-sm transition-colors ${
                      on ? "border-gold bg-card text-gold" : "border-border text-muted-foreground hover:bg-card"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            disabled={saving}
            className="h-11 flex-1 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-11 flex-1 rounded-md bg-gold text-gold-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FaithModePrompt;
