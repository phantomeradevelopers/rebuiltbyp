import { ClipboardList, Circle } from "lucide-react";

type TodoItem = {
  title: string;
  detail: string;
  who: string;
};

// Items that require human action outside the code (secrets, OAuth app
// registration, native shell builds). The agent cannot complete these — they
// surface here so the owner can knock them out when ready.
const TODOS: TodoItem[] = [
  {
    title: "Add VAPID secrets for Web Push",
    detail:
      "Project Settings → Backend → Secrets. Add VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto:you@domain). Until then, push code runs but nothing is delivered.",
    who: "Owner",
  },
  {
    title: "Register Google Health (Fitness API) OAuth app",
    detail:
      "Create OAuth 2.0 Client ID in Google Cloud Console → APIs & Services → Credentials. Enable the Fitness API. Add GOOGLE_FIT_CLIENT_ID + GOOGLE_FIT_CLIENT_SECRET as secrets. Authorized redirect URI: https://rebuiltbyp.com/api/public/oauth/google_fit/callback",
    who: "Owner",
  },
  {
    title: "Register Oura OAuth app",
    detail:
      "cloud.ouraring.com → create app, add OURA_CLIENT_ID + OURA_CLIENT_SECRET. Callback: /api/public/oauth/oura/callback.",
    who: "Owner",
  },
  {
    title: "Register Whoop OAuth app",
    detail:
      "developer.whoop.com → create app, add WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET. Callback: /api/public/oauth/whoop/callback.",
    who: "Owner",
  },
  {
    title: "(Optional) Resend for email fallback",
    detail:
      "If users miss push, email backup uses Resend. Add RESEND_API_KEY when ready.",
    who: "Owner",
  },
  {
    title: "(Optional) Native shell for Apple Health / Health Connect",
    detail:
      "Browser PWA cannot read HealthKit or Health Connect. A Capacitor wrapper is needed to ship to App Store / Play Store and pull native health data. Separate build — see docs/native.md.",
    who: "Owner",
  },
];

export function SetupTodoCard() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-gold">
        <ClipboardList className="h-4 w-4" />
        <p className="label-mono">Setup to-do</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Manual steps the app can't do for you. Code is ready — these just need
        keys or an external app to flip on.
      </p>
      <ul className="mt-4 space-y-3">
        {TODOS.map((t) => (
          <li
            key={t.title}
            className="flex gap-3 rounded-md border border-border/60 bg-background/40 p-3"
          >
            <Circle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.detail}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
                Owner action
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
