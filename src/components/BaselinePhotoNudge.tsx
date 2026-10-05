import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadBaselinePhoto } from "@/lib/progress-photo-upload";

const SNOOZE_KEY = "rebuilt:baseline_snooze_until";
const REMIND_AT_KEY = "rebuilt:baseline_remind_at";

function readDate(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(key);
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  } catch { return 0; }
}

function nextWakeDate(reminderTime: string | null | undefined): Date {
  const m = /^(\d{1,2}):(\d{2})/.exec(reminderTime || "06:00");
  const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 6;
  const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export function BaselinePhotoNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [reminderTime, setReminderTime] = useState<string>("06:00");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Already have a photo? Never nag again.
        const { count } = await supabase
          .from("progress_photos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((count ?? 0) > 0) return;

        // Honor explicit "remind me" requests first.
        const remindAt = readDate(REMIND_AT_KEY);
        if (remindAt && Date.now() < remindAt) return;

        // General snooze window.
        const snooze = readDate(SNOOZE_KEY);
        if (snooze && Date.now() < snooze) return;

        // Day counter from onboarding completion + user's wake time.
        const { data: p } = await supabase
          .from("user_profile")
          .select("onboarding_completed_at, reminder_time_local")
          .eq("user_id", user.id)
          .maybeSingle();
        const completedAt = p?.onboarding_completed_at
          ? new Date(p.onboarding_completed_at as string).getTime()
          : Date.now();
        const ageDays = Math.floor((Date.now() - completedAt) / 86_400_000);

        const rt = (p?.reminder_time_local as string | undefined) ?? "06:00";
        setReminderTime(rt.slice(0, 5));

        // Show every day for the first 14 days, then weekly.
        if (ageDays > 14 && ageDays % 7 !== 0) return;

        setDayNumber(Math.max(1, ageDays + 1));
        setShow(true);
      } catch { /* silent */ }
    })();
  }, []);

  const { whenLabel, timeLabel } = useMemo(() => {
    const d = nextWakeDate(reminderTime);
    const sameDay = d.toDateString() === new Date().toDateString();
    return {
      whenLabel: sameDay ? "later today" : "tomorrow",
      timeLabel: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    };
  }, [reminderTime]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await uploadBaselinePhoto(file);
      try {
        window.localStorage.removeItem(SNOOZE_KEY);
        window.localStorage.removeItem(REMIND_AT_KEY);
      } catch { /* noop */ }
      toast.success("Day one, locked in. The proof starts now.");
      setShow(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function snoozeUntilNextWake() {
    try {
      const d = nextWakeDate(reminderTime);
      window.localStorage.setItem(SNOOZE_KEY, d.toISOString());
    } catch { /* noop */ }
    setShow(false);
  }

  function remindAtNextWake() {
    try {
      const d = nextWakeDate(reminderTime);
      window.localStorage.setItem(REMIND_AT_KEY, d.toISOString());
    } catch { /* noop */ }
    toast.success(`We'll nudge you ${whenLabel} at ${timeLabel}.`);
    setShow(false);
  }

  if (!show) return null;

  const headline = dayNumber === 1
    ? "This is the version of you you're leaving behind."
    : `Day ${dayNumber} — and still no before photo.`;
  const sub = dayNumber === 1
    ? "One honest photo. Thirty days from now you'll wish you took it today."
    : "Future you is waiting. One photo. That's the whole ask.";

  return (
    <section className="card-elevated p-5 border border-gold/40 relative">
      <button
        onClick={snoozeUntilNextWake}
        className="absolute top-3 right-3 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center touch-manipulation"
        aria-label="Dismiss until next wake"
      ><X className="h-4 w-4" /></button>
      <p className="label-mono text-gold flex items-center gap-1.5">
        <Camera className="h-3 w-3" /> Day {dayNumber} of 30
      </p>
      <h3 className="mt-2 font-display text-2xl leading-tight pr-8">{headline}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-gold h-12 px-5 rounded-full text-sm font-medium disabled:opacity-50 touch-manipulation"
        >{busy ? "Saving…" : "Capture day one"}</button>
        <button
          onClick={remindAtNextWake}
          className="h-12 px-4 rounded-full text-sm text-muted-foreground hover:text-foreground border border-border touch-manipulation"
        >Remind me {whenLabel} at {timeLabel}</button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onUpload}
      />
    </section>
  );
}
