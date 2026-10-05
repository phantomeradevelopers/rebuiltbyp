import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getInbox, markRead, getNotifPrefs, updateNotifPrefs,
  type InboxItem, type NotifPrefs,
} from "@/lib/notifications.functions";
import { getProfile, updateProfile, regeneratePlan, type ProfileData } from "@/lib/profile.functions";
import { resetOnboarding } from "@/lib/onboarding.functions";
import { Bell, Quote, LogOut, Settings as SettingsIcon, User, Sparkles, Volume2, Languages, CalendarPlus, RefreshCw, Pill, Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { useTimeFormat, type TimeFormatChoice } from "@/lib/time-format";
import { Clock } from "lucide-react";
import { isMuted, setMuted, playChime } from "@/lib/sound";
import { isHapticsEnabled, setHapticsEnabled, haptic } from "@/lib/haptics";
import { buildReminderIcs, downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { CandyRxCard } from "@/components/CandyRxCard";
import { ConsultCard } from "@/components/ConsultCard";
import { EnablePushCard } from "@/components/EnablePushCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGymContext, setPrimaryGym, removeUserGym } from "@/lib/gyms.functions";
import { GymPickerCard } from "@/components/gym/GymPickerCard";
import { Dumbbell, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "@/i18n";
import { CoachVoiceSection } from "@/components/settings/CoachVoiceSection";
import { ConnectedAppsCard } from "@/components/ConnectedAppsCard";
import { SetupTodoCard } from "@/components/SetupTodoCard";
import { QuickThemeToggle } from "@/components/QuickThemeToggle";
import { useTrack, type Track } from "@/lib/track";
import { trackCopy } from "@/lib/track-copy";
import { YouHub } from "@/components/rebuilt/YouHub";
import { ReferralCard } from "@/components/ReferralCard";
import { MemberDiscountCard } from "@/components/MemberDiscountCard";
import { HowYouEarnSheet } from "@/components/HowYouEarnSheet";
import { Flame } from "lucide-react";
import { IntensitySection } from "@/components/IntensitySection";
import { AccountabilityPartnerSection } from "@/components/AccountabilityPartnerSection";
import { CancelSubscriptionSection } from "@/components/settings/CancelSubscriptionSection";

export const Route = createFileRoute("/app/settings")({ head: () => ({ meta: [{ title: "Settings — REBUILT" },{ name: "description", content: "Manage your account, reminders, and preferences." },{ property: "og:title", content: "Settings — REBUILT" },{ property: "og:description", content: "Manage your account, reminders, and preferences." },] }), component: MorePage, errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />, notFoundComponent: () => <RouteNotFound /> });

type Tab = "profile" | "inbox" | "settings";

function MorePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("profile");
  const [inbox, setInbox] = useState<{ items: InboxItem[]; unread: number } | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);

  async function loadInbox() {
    try { setInbox(await getInbox()); } catch (e) { toast.error((e as Error).message); }
  }
  async function loadPrefs() {
    try { setPrefs(await getNotifPrefs()); } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => { loadInbox(); loadPrefs(); }, []);

  async function onMarkAll() { await markRead({ data: { all: true } }); loadInbox(); }
  async function onOpen(id: string) { await markRead({ data: { id } }); loadInbox(); }

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-8">
      <header>
        <p className="label-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--rebuilt-gold)]">
          {t("settings.kicker", "You")}
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-[1.05] text-[color:var(--text-primary)]">
          {t("settings.title", "Everything about you.")}
        </h1>
      </header>

      {/* You hub: quick access to Journal, Progress, Trophies, Coach, Health data,
          Spirit, Outdoor, Consult, Redeem, Account. Below is the classic settings surface. */}
      <YouHub />

      {/* Perks + referral (moved off Today) */}
      <ReferralCard variant="compact" />
      <MemberDiscountCard compact />

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)]">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          <User className="h-3.5 w-3.5" /> {t("more.profile", "Profile")}
        </TabButton>
        <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
          <Bell className="h-3.5 w-3.5" /> {t("more.inbox", "Inbox")}
          {inbox && inbox.unread > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--rebuilt-gold)] text-black text-xs font-semibold">
              {inbox.unread}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
          <SettingsIcon className="h-3.5 w-3.5" /> {t("more.settings", "Settings")}
        </TabButton>
      </div>

      {tab === "profile" && <ProfileEditor />}
      {tab === "inbox" && <Inbox inbox={inbox} onMarkAll={onMarkAll} onOpen={onOpen} />}
      {tab === "settings" && <Settings prefs={prefs} reload={loadPrefs} />}

      <div className="h-8" />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-11 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] label-mono uppercase tracking-[0.14em] transition-colors active:scale-[0.97] ${
        active
          ? "bg-[color:var(--bg-base)] text-[color:var(--rebuilt-gold)] shadow-[inset_0_0_0_1px_var(--rebuilt-gold-dim)]"
          : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
      }`}
    >{children}</button>
  );
}

/* ------------------------------ Profile ------------------------------ */

const GOAL_OPTIONS = ["fat_loss", "build_muscle", "recomp", "strength", "energy", "sleep", "stress", "mobility"] as const;
const STYLE_OPTIONS: { v: NonNullable<ProfileData["workout_style_preference"]>; label: string }[] = [
  { v: "short_intense", label: "Short & intense" },
  { v: "long_steady", label: "Long & steady" },
  { v: "varied", label: "Mix it up" },
  { v: "fun_first", label: "Whatever's fun" },
];
const DIET_OPTIONS: { v: ProfileData["dietary_pattern"]; label: string }[] = [
  { v: "omnivore", label: "Omnivore" },
  { v: "vegetarian", label: "Vegetarian" },
  { v: "vegan", label: "Vegan" },
  { v: "pescatarian", label: "Pescatarian" },
  { v: "keto", label: "Keto" },
  { v: "other", label: "Other" },
];
const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function ProfileEditor() {
  const navigate = useNavigate();
  const [p, setP] = useState<ProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [redoBusy, setRedoBusy] = useState(false);

  async function load() {
    try { setP(await getProfile()); } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  if (!p) return <p className="label-mono">Loading…</p>;

  function set<K extends keyof ProfileData>(k: K, v: ProfileData[K]) {
    setP((cur) => (cur ? { ...cur, [k]: v } : cur));
  }

  function toggleArr(field: "goals" | "allergies" | "preferred_training_days", val: string) {
    if (!p) return;
    const cur = p[field];
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    set(field, next);
  }

  async function save() {
    if (!p) return;
    setBusy(true);
    try {
      await updateProfile({ data: {
        first_name: p.first_name ?? undefined,
        age: p.age ?? undefined,
        height_cm: p.height_cm ?? undefined,
        weight_kg: p.weight_kg ?? undefined,
        goal_weight_kg: p.goal_weight_kg,
        goals: p.goals,
        training_days_per_week: p.training_days_per_week ?? undefined,
        session_minutes: p.session_minutes ?? undefined,
        equipment_access: (p.equipment_access ?? undefined) as "none" | "minimal" | "home_gym" | "full_gym" | undefined,
        workout_style_preference: (p.workout_style_preference ?? undefined) as "short_intense" | "long_steady" | "varied" | "fun_first" | undefined,
        preferred_training_days: p.preferred_training_days,
        dietary_pattern: (p.dietary_pattern ?? undefined) as "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "keto" | "other" | undefined,
        allergies: p.allergies,
        foods_avoided: p.foods_avoided,
        foods_liked: p.foods_liked,
        sleep_hours: p.sleep_hours ?? undefined,
        stress_level: p.stress_level ?? undefined,
        caffeine_per_day: p.caffeine_per_day ?? undefined,
        alcohol_per_week: p.alcohol_per_week ?? undefined,
        injuries: p.injuries,
        medications: p.medications,
      }});
      toast.success("Saved.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function regen() {
    if (!confirm("Rebuild your fitness and nutrition plan based on the current profile? This replaces your current plan.")) return;
    setRegenBusy(true);
    try {
      const res = await regeneratePlan();
      if (res && res.ok === false) throw new Error(res.error || "Could not rebuild plan.");
      toast.success("New plan ready.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setRegenBusy(false); }
  }

  async function redoIntake() {
    if (!confirm("Walk through the full 11-step intake again? Your current answers will be pre-filled — change anything you want, then we'll rebuild your plan at the end.")) return;
    setRedoBusy(true);
    try {
      await resetOnboarding();
      try { sessionStorage.removeItem("onb_state_v2"); } catch { /* noop */ }
      navigate({ to: "/onboarding" as never });
    } catch (e) {
      toast.error((e as Error).message);
      setRedoBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Section title="You">
        <Row><Field label="First name"><Input value={p.first_name ?? ""} onChange={(v) => set("first_name", v)} /></Field></Row>
        <Row two>
          <Field label="Age"><NumInput value={p.age} onChange={(v) => set("age", v)} /></Field>
          <Field label="Height (cm)"><NumInput value={p.height_cm} onChange={(v) => set("height_cm", v)} step={0.5} /></Field>
        </Row>
        <Row two>
          <Field label="Weight (kg)"><NumInput value={p.weight_kg} onChange={(v) => set("weight_kg", v)} step={0.1} /></Field>
          <Field label="Goal (kg)"><NumInput value={p.goal_weight_kg} onChange={(v) => set("goal_weight_kg", v)} step={0.1} /></Field>
        </Row>
      </Section>

      <Section title="Goals">
        <Chips items={GOAL_OPTIONS.map((g) => ({ v: g, label: g.replace("_", " ") }))} selected={p.goals} onToggle={(v) => toggleArr("goals", v)} />
      </Section>

      <Section title="Training">
        <Row two>
          <Field label="Days / week"><NumInput value={p.training_days_per_week} onChange={(v) => set("training_days_per_week", v)} min={1} max={7} /></Field>
          <Field label="Minutes / session"><NumInput value={p.session_minutes} onChange={(v) => set("session_minutes", v)} min={10} max={180} /></Field>
        </Row>
        <Field label="Style">
          <div className="grid grid-cols-2 gap-2">
            {STYLE_OPTIONS.map((o) => (
              <PillBtn key={o.v} active={p.workout_style_preference === o.v} onClick={() => set("workout_style_preference", o.v)}>{o.label}</PillBtn>
            ))}
          </div>
        </Field>
        <Field label="Preferred days">
          <Chips items={DOW.map((d) => ({ v: d, label: d.toUpperCase() }))} selected={p.preferred_training_days} onToggle={(v) => toggleArr("preferred_training_days", v)} />
        </Field>
      </Section>

      <Section title="Nutrition">
        <Field label="Pattern">
          <div className="grid grid-cols-3 gap-2">
            {DIET_OPTIONS.map((o) => (
              <PillBtn key={o.v} active={p.dietary_pattern === o.v} onClick={() => set("dietary_pattern", o.v)}>{o.label}</PillBtn>
            ))}
          </div>
        </Field>
        <Field label="Allergies"><ChipInput values={p.allergies} onChange={(v) => set("allergies", v)} placeholder="Type and press Enter…" /></Field>
        <Field label="Foods you avoid"><Textarea value={p.foods_avoided ?? ""} onChange={(v) => set("foods_avoided", v || null)} /></Field>
        <Field label="Foods you love"><Textarea value={p.foods_liked ?? ""} onChange={(v) => set("foods_liked", v || null)} /></Field>
      </Section>

      <Section title="Lifestyle">
        <Row two>
          <Field label="Sleep (hrs)"><NumInput value={p.sleep_hours} onChange={(v) => set("sleep_hours", v)} step={0.5} max={16} /></Field>
          <Field label="Stress (1–10)"><NumInput value={p.stress_level} onChange={(v) => set("stress_level", v)} min={1} max={10} /></Field>
        </Row>
        <Row two>
          <Field label="Caffeine / day"><NumInput value={p.caffeine_per_day} onChange={(v) => set("caffeine_per_day", v)} min={0} max={20} /></Field>
          <Field label="Alcohol / week"><NumInput value={p.alcohol_per_week} onChange={(v) => set("alcohol_per_week", v)} min={0} max={100} /></Field>
        </Row>
      </Section>

      <Section title="Health">
        <Field label="Injuries"><Textarea value={p.injuries ?? ""} onChange={(v) => set("injuries", v || null)} /></Field>
        <Field label="Medications"><Textarea value={p.medications ?? ""} onChange={(v) => set("medications", v || null)} /></Field>
      </Section>


      <ConsultCard variant="compact" />
      <CandyRxCard />

      <button onClick={save} disabled={busy} className="btn-gold h-12 w-full rounded-md text-sm font-medium disabled:opacity-60">
        {busy ? "Saving…" : "Save profile"}
      </button>

      <button onClick={regen} disabled={regenBusy} className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-md border border-gold/40 text-sm text-gold hover:bg-gold/5 disabled:opacity-60">
        <Sparkles className="h-4 w-4" />
        {regenBusy ? "Rebuilding…" : "Regenerate my plan"}
      </button>
      <p className="text-xs text-muted-foreground -mt-3 text-center">Use this after changing training days, equipment, goals, or diet.</p>

      <button onClick={redoIntake} disabled={redoBusy} className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-gold/40 disabled:opacity-60">
        <RefreshCw className="h-4 w-4" />
        {redoBusy ? "Resetting…" : "Redo full intake"}
      </button>
      <p className="text-xs text-muted-foreground -mt-3 text-center">Walk through the original 11-step intake again. Best for big life changes.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-elevated p-5 space-y-4">
      <p className="label-mono text-gold">{title}</p>
      {children}
    </section>
  );
}
function Row({ children, two }: { children: React.ReactNode; two?: boolean }) {
  return <div className={two ? "grid grid-cols-2 gap-3" : ""}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full h-11 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none" />;
}
function NumInput({ value, onChange, step = 1, min, max }: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; max?: number }) {
  return <input type="number" inputMode="decimal" step={step} min={min} max={max}
    value={value ?? ""}
    onChange={(e) => { const v = e.target.value; onChange(v === "" ? null : Number(v)); }}
    className="w-full h-11 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none" />;
}
function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full rounded-md border border-border bg-input p-3 text-base focus:border-gold focus:outline-none" />;
}
function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-11 rounded-md border text-sm font-medium transition-colors active:scale-95 ${active ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
    >{children}</button>
  );
}
function Chips({ items, selected, onToggle }: { items: { v: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = selected.includes(it.v);
        return (
          <button key={it.v} type="button" onClick={() => onToggle(it.v)}
            className={`h-9 px-3.5 rounded-full border text-xs label-mono transition-colors active:scale-95 ${on ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  function add() {
    const t = text.trim();
    if (!t) return;
    if (!values.includes(t)) onChange([...values, t]);
    setText("");
  }
  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-gold/10 border border-gold/30 text-xs text-gold">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-gold/70 hover:text-gold h-6 w-6 inline-flex items-center justify-center -mr-1" aria-label={`Remove ${v}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 h-11 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none" />
        <button type="button" onClick={add} className="h-11 px-4 rounded-md border border-border text-xs label-mono hover:border-gold active:scale-95">Add</button>
      </div>
    </div>
  );
}

/* ------------------------------ Inbox ------------------------------ */

function Inbox({
  inbox, onMarkAll, onOpen,
}: { inbox: { items: InboxItem[]; unread: number } | null; onMarkAll: () => void; onOpen: (id: string) => void }) {
  if (!inbox) return <p className="label-mono">Loading…</p>;
  if (inbox.items.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-center">
        <Bell className="h-6 w-6 text-muted-foreground mx-auto" />
        <p className="mt-3 font-display text-lg">No messages yet</p>
        <p className="text-xs text-muted-foreground mt-1">Daily motivation will land here at your reminder time.</p>
      </section>
    );
  }
  return (
    <div className="space-y-3">
      {inbox.unread > 0 && (
        <button onClick={onMarkAll} className="text-xs label-mono text-gold hover:underline">Mark all read</button>
      )}
      {inbox.items.map((n) => {
        const unread = !n.read_at;
        return (
          <article key={n.id} onClick={() => unread && onOpen(n.id)}
            className={`rounded-lg border p-4 cursor-pointer transition ${unread ? "border-gold/40 bg-card" : "border-border bg-card/50"}`}>
            <div className="flex items-start gap-3">
              <Quote className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-sm ${unread ? "font-semibold" : "text-muted-foreground"}`}>{n.subject ?? "REBUILT"}</p>
                  <span className="label-mono text-xs shrink-0">{relTime(n.scheduled_for)}</span>
                </div>
                <p className="mt-1 font-display text-base leading-snug">{n.body}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------ Settings ------------------------------ */

function Settings({ prefs, reload }: { prefs: NotifPrefs | null; reload: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<NotifPrefs | null>(prefs);
  const [soundOn, setSoundOn] = useState<boolean>(!isMuted());
  const [hapticsOn, setHapticsOn] = useState<boolean>(isHapticsEnabled());
  const [repsOpen, setRepsOpen] = useState(false);
  useEffect(() => { setLocal(prefs); }, [prefs]);

  if (!local) return <p className="label-mono">Loading…</p>;

  async function save() {
    if (!local) return;
    setBusy(true);
    try {
      await updateNotifPrefs({ data: {
        daily_motivation_enabled: local.daily_motivation_enabled,
        reminder_time_local: local.reminder_time_local,
        reminder_time_midday_local: local.reminder_time_midday_local,
        reminder_time_evening_local: local.reminder_time_evening_local,
        notification_push: local.notification_push,
        notification_sms: local.notification_sms,
        notification_email: local.notification_email,
        notify_medications: local.notify_medications,
        morning_delivery: local.morning_delivery,
        reminder_frequency: local.reminder_frequency,
      } });
      toast.success("Saved.");
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  function set<K extends keyof NotifPrefs>(k: K, v: NotifPrefs[K]) {
    setLocal({ ...local!, [k]: v });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="label-mono text-muted-foreground">Settings</p>
        <QuickThemeToggle />
      </div>

      <SetupTodoCard />

      <TrackSection />

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold">Account</p>
        <p className="mt-2 font-display text-2xl">{local.first_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{local.email}</p>
      </section>

      <AppearanceSection />

      <TimeFormatSection />

      <CoachVoiceSection />

      <ConnectedAppsCard />

      {/* Reps & rewards — the retention engine surface */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-mono text-gold flex items-center gap-1.5">
              <Flame className="h-3 w-3" /> Reps &amp; rewards
            </p>
            <p className="mt-2 font-display text-lg leading-snug">
              Earned points, honest rewards.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              See how you earn reps, your freeze-token balance, and what unlocks next.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRepsOpen(true)}
          className="mt-3 w-full min-tap rounded-md border border-border text-sm font-medium hover:bg-accent active:scale-[0.98] transition"
        >
          Open reps &amp; rewards
        </button>
      </section>
      <HowYouEarnSheet
        open={repsOpen}
        onClose={() => setRepsOpen(false)}
        lang={i18n.language?.startsWith("es") ? "es" : "en"}
      />

      <IntensitySection />

      <AccountabilityPartnerSection />

      <CancelSubscriptionSection />




      {/* Reminder cadence — controls the honest win-back sequence */}
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold flex items-center gap-1.5">
          <Bell className="h-3 w-3" /> Reminder cadence
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          How often we'll nudge you if you miss a day. No fake urgency, ever.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Reminder cadence">
          {([
            { v: "off", label: "Off", desc: "Silence. No nudges." },
            { v: "gentle", label: "Gentle", desc: "Only if 3+ days quiet." },
            { v: "balanced", label: "Balanced", desc: "Daily nudge + win-back." },
            { v: "frequent", label: "Frequent", desc: "Same as balanced." },
          ] as const).map((opt) => {
            const active = local.reminder_frequency === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("reminder_frequency", opt.v)}
                className={`min-tap rounded-md border p-3 text-left touch-manipulation transition ${
                  active
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border hover:bg-accent text-foreground"
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold">Daily motivation</p>
        <Toggle label="Send me a daily message" desc="A short P-voice nudge each morning."
          value={local.daily_motivation_enabled} onChange={(v) => set("daily_motivation_enabled", v)} />
        <div className="mt-4">
          <p className="text-sm font-medium">Delivery style</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["spaced", "briefing"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set("morning_delivery", mode)}
                className={`h-11 rounded-md border text-sm touch-manipulation ${local.morning_delivery === mode ? "border-gold bg-gold/10 text-foreground" : "border-border hover:bg-accent"}`}
              >
                {mode === "spaced" ? "Spaced (3/day)" : "Morning briefing"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Spaced = morning, midday, evening. Briefing = one clean morning message only.</p>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm">Morning lift</label>
            <input type="time" value={local.reminder_time_local}
              onChange={(e) => set("reminder_time_local", e.target.value)}
              className="mt-2 w-full h-12 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none touch-manipulation" />
          </div>
          <div>
            <label className="text-sm">Midday lift</label>
            <input type="time" value={local.reminder_time_midday_local}
              onChange={(e) => set("reminder_time_midday_local", e.target.value)}
              className="mt-2 w-full h-12 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none touch-manipulation" />
          </div>
          <div>
            <label className="text-sm">Evening close</label>
            <input type="time" value={local.reminder_time_evening_local}
              onChange={(e) => set("reminder_time_evening_local", e.target.value)}
              className="mt-2 w-full h-12 rounded-md border border-border bg-input px-3 text-base focus:border-gold focus:outline-none touch-manipulation" />
          </div>
          <p className="text-xs text-muted-foreground">We'll send a quick P-voice lift at each time.</p>
        </div>
        <div className="mt-4 rounded-md border border-border bg-background p-3">
          <p className="label-mono text-gold flex items-center gap-1.5"><CalendarPlus className="h-3 w-3" /> Add to your calendar</p>
          <p className="text-xs text-muted-foreground mt-1">iPhone, Android, Google, Outlook. Daily repeat at your reminder time.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const ics = buildReminderIcs({ time: local.reminder_time_local || "06:00", title: "REBUILT daily check-in", description: "Open the app and log your check-in." });
                downloadIcs("rebuilt-checkin", ics);
              }}
              className="h-11 rounded-md border border-border text-sm hover:bg-accent active:scale-95 touch-manipulation select-none"
            >Add to Calendar</button>
            <a
              href={googleCalendarUrl({ time: local.reminder_time_local || "06:00", title: "REBUILT daily check-in", description: "Open the app and log your check-in." })}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 inline-flex items-center justify-center rounded-md border border-border text-sm hover:bg-accent active:scale-95 touch-manipulation select-none"
            >Google Calendar</a>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold flex items-center gap-1.5"><Pill className="h-3 w-3" /> Medication reminders</p>
        <Toggle
          label="Push notifications for scheduled doses"
          desc="We'll ping you when a dose on your schedule is due. As-needed meds never auto-notify."
          value={local.notify_medications}
          onChange={(v) => set("notify_medications", v)}
        />
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Morning doses are spaced ~2 min after your daily motivation ping so your morning doesn't get noisy. A gentle check-in nudge follows ~2 min after that if you haven't logged yet.
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          Add or remove medications from your check-in, or ask your coach in chat.
        </p>
      </section>

      <EnablePushCard />

      <GymsSection />


      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold">Other channels</p>
        <Toggle label="In-app inbox" desc="Always on." value={true} onChange={() => {}} disabled />
        <Toggle label="SMS" desc={local.phone_e164 ? "Coming soon." : "Add a phone number in onboarding to enable."} value={local.notification_sms} onChange={(v) => set("notification_sms", v)} disabled />
        <Toggle label="Email" desc="Coming soon." value={local.notification_email} onChange={(v) => set("notification_email", v)} disabled />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <p className="label-mono text-gold flex items-center gap-1.5"><Volume2 className="h-3 w-3" /> Sounds & effects</p>
        <Toggle
          label="Celebration sounds"
          desc="Subtle chimes when you hit a milestone. Confetti always shows."
          value={soundOn}
          onChange={(v) => { setSoundOn(v); setMuted(!v); if (v) playChime("ding"); }}
        />
        <Toggle
          label="Haptics"
          desc="Subtle vibrations on taps, timers, and rest cues. Supported on most Android devices."
          value={hapticsOn}
          onChange={(v) => { setHapticsOn(v); setHapticsEnabled(v); if (v) haptic("success"); }}
        />
      </section>

      <LanguageSection />

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="label-mono text-gold">Tools</p>
        <Link to={"/app/spirit" as never} className="flex items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/5 p-3 hover:bg-gold/10 transition">
          <span className="text-sm">Today's anchor · breath · spirit</span>
          <span className="text-gold text-sm">→</span>
        </Link>
        <Link to={"/app/readiness" as never} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition">
          <span className="text-sm">Readiness check-in</span>
          <span className="text-gold text-sm">→</span>
        </Link>
        <Link to={"/app/journal" as never} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition">
          <span className="text-sm">Voice journal</span>
          <span className="text-gold text-sm">→</span>
        </Link>
        <Link to={"/app/review" as never} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition">
          <span className="text-sm">Weekly review</span>
          <span className="text-gold text-sm">→</span>
        </Link>
        <Link to={"/app/identity" as never} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition">
          <span className="text-sm">Identity contract</span>
          <span className="text-gold text-sm">→</span>
        </Link>
        <Link to={"/app/account" as never} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition">
          <span className="text-sm">Account · export data</span>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
        <Link to={"/app/account" as never} hash="delete-account" className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 hover:bg-destructive/10 transition">
          <span className="text-sm text-destructive">Delete account</span>
          <span className="text-destructive text-sm">→</span>
        </Link>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="label-mono text-gold">Library & legal</p>
        <Link
          to="/app/peptides"
          className="flex items-center justify-between gap-3 rounded-md border border-sky-500/40 bg-sky-500/5 p-3 hover:bg-sky-500/10 transition"
        >
          <span className="text-sm">Peptide education</span>
          <span className="text-sky-300 text-sm">→</span>
        </Link>
        <Link
          to="/legal"
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 hover:bg-accent transition"
        >
          <span className="text-sm">Medical disclaimer · Affiliate disclosure · Terms</span>
          <span className="text-muted-foreground text-sm">→</span>
        </Link>
        <p className="text-xs text-muted-foreground">Coaching is educational and accountability-based. It is not medical care.</p>
      </section>

      <button onClick={save} disabled={busy}
        className="h-12 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
      >{busy ? "Saving…" : "Save settings"}</button>

      <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" as never, replace: true }))}
        className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-accent active:scale-[0.98]">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function LanguageSection() {
  const { t, i18n: i18nHook } = useTranslation();
  const current = i18nHook.resolvedLanguage ?? "en";
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold flex items-center gap-1.5"><Languages className="h-3 w-3" /> {t("more.language_section", "Language")}</p>
      <p className="text-xs text-muted-foreground mt-1">{t("more.language_hint")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SUPPORTED_LANGUAGES.map((l) => {
          const active = current === l.code;
          return (
            <button key={l.code} onClick={() => { i18n.changeLanguage(l.code); }}
              className={`h-11 rounded-md border text-sm font-medium transition-colors active:scale-95 ${active ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >{l.label}</button>
          );
        })}
      </div>
    </section>
  );
}

function Toggle({
  label, desc, value, onChange, disabled,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-60" : ""}`}>
      <div>
        <p className="text-sm">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button type="button" role="switch" aria-checked={value} disabled={disabled}
        onClick={() => onChange(!value)}
        className={`shrink-0 relative h-6 w-11 rounded-full border transition ${value ? "bg-gold border-gold" : "bg-card border-border"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toISOString().slice(5, 10);
}

function AppearanceSection() {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
    { value: "light", label: "Daylight", icon: <Sun className="h-3.5 w-3.5" /> },
    { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
  ];
  return (
    <section id="appearance" className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold">Appearance</p>
      <p className="mt-1 text-xs text-muted-foreground">Dark = deep obsidian. Daylight = warm-stone light. System follows your device.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setChoice(o.value)}
              className={`h-11 rounded-md border text-xs label-mono inline-flex items-center justify-center gap-1.5 transition-colors ${
                on ? "border-gold text-gold" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >{o.icon} {o.label}</button>
          );
        })}
      </div>
    </section>
  );
}

function TimeFormatSection() {
  const { choice, setChoice } = useTimeFormat();
  const options: { value: TimeFormatChoice; label: string }[] = [
    { value: "system", label: "System" },
    { value: "12h", label: "12-hour" },
    { value: "24h", label: "24-hour" },
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold flex items-center gap-1.5"><Clock className="h-3 w-3" /> Time format</p>
      <p className="mt-1 text-xs text-muted-foreground">How times are shown across the app.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setChoice(o.value)}
              className={`h-11 rounded-md border text-xs label-mono inline-flex items-center justify-center transition-colors ${
                on ? "border-gold text-gold" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >{o.label}</button>
          );
        })}
      </div>
    </section>
  );
}

function GymsSection() {
  const fetchCtx = useServerFn(getGymContext);
  const setPrimary = useServerFn(setPrimaryGym);
  const removeFn = useServerFn(removeUserGym);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["gym-context"], queryFn: () => fetchCtx(), staleTime: 30_000 });

  if (!data) return null;

  async function makePrimary(id: string) {
    try { await setPrimary({ data: { userGymId: id } }); qc.invalidateQueries({ queryKey: ["gym-context"] }); toast.success("Primary set."); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this gym?")) return;
    try { await removeFn({ data: { userGymId: id } }); qc.invalidateQueries({ queryKey: ["gym-context"] }); toast.success("Removed."); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <p className="label-mono text-gold flex items-center gap-1.5"><Dumbbell className="h-3 w-3" /> Gyms</p>
      <p className="text-xs text-muted-foreground">
        We celebrate every time you walk through the door of one of these.
      </p>

      {data.userGyms.length > 0 ? (
        <ul className="space-y-2">
          {data.userGyms.map((ug) => (
            <li key={ug.id} className="rounded-md border border-border bg-background/40 p-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {ug.gym.name}
                  {ug.is_primary && <span className="text-xs label-mono text-gold inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-gold" /> primary</span>}
                </p>
                {ug.gym.formatted_address && (
                  <p className="text-xs text-muted-foreground truncate">{ug.gym.formatted_address}</p>
                )}
              </div>
              {!ug.is_primary && (
                <button onClick={() => makePrimary(ug.id)} className="text-xs label-mono text-gold h-9 px-3 rounded-md border border-gold/40 active:scale-95">
                  Make primary
                </button>
              )}
              <button onClick={() => remove(ug.id)} className="text-muted-foreground hover:text-destructive h-9 w-9 inline-flex items-center justify-center rounded-md active:scale-90" aria-label="Remove gym">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <GymPickerCard />
    </section>
  );
}

/* ------------------------------ Track ------------------------------ */

function TrackSection() {
  const { track, setTrack, saving } = useTrack();
  async function choose(next: Track) {
    if (next === track) return;
    const label = next === "angels" ? "REBUILT Angels (women's track)" : "REBUILT (men's track)";
    if (!confirm(`Switch to ${label}? You can switch back anytime.`)) return;
    try {
      await setTrack(next);
      toast.success(next === "angels" ? "Welcome to Angels." : "Back on the REBUILT track.");
    } catch (e) {
      toast.error((e as Error).message || "Could not switch track.");
    }
  }
  const opts: { v: Track; title: string; desc: string }[] = [
    { v: "men",    title: "REBUILT",        desc: trackCopy("men", "trackTagline") },
    { v: "angels", title: "REBUILT Angels", desc: trackCopy("angels", "trackTagline") },
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="label-mono text-gold">Track</p>
      <p className="mt-1 text-xs text-muted-foreground">Choose how the app speaks to you and how it looks.</p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {opts.map((o) => {
          const active = track === o.v;
          return (
            <button
              key={o.v}
              type="button"
              disabled={saving}
              onClick={() => choose(o.v)}
              className={`text-left rounded-lg border p-4 transition-colors active:scale-[0.99] disabled:opacity-60 ${
                active
                  ? "border-[color:var(--rebuilt-gold)] bg-[color:var(--rebuilt-gold-dim)]"
                  : "border-border bg-background hover:border-[color:var(--border-strong)]"
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-lg text-foreground">{o.title}</p>
                {active && <span className="label-mono text-[10px] text-[color:var(--rebuilt-gold)]">Active</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
