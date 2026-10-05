import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Circle as Ring, Heart, Watch, Link2, Apple, Footprints, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWearablesWaitlistStatus, joinWearablesWaitlist } from "@/lib/wearables/waitlist.functions";
import { isNative, nativePlatform, requestHealthPermissions } from "@/lib/health-sync";

type Provider = "google_fit" | "oura" | "whoop" | "apple_health" | "garmin";

const META: Record<Provider, { label: string; icon: typeof Watch; tagline: string }> = {
  apple_health: { label: "Apple Watch", icon: Apple, tagline: "Activity, heart, sleep." },
  whoop: { label: "Whoop", icon: Watch, tagline: "Recovery, strain, sleep." },
  oura: { label: "Oura", icon: Ring, tagline: "Readiness, sleep, HRV." },
  garmin: { label: "Garmin", icon: Footprints, tagline: "Training, VO₂max, HRV." },
  google_fit: { label: "Google Health", icon: Heart, tagline: "Steps, sleep, heart rate." },
};

export function ConnectedAppsCard() {
  const fetchStatus = useServerFn(getWearablesWaitlistStatus);
  const join = useServerFn(joinWearablesWaitlist);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["wearables-waitlist"],
    queryFn: () => fetchStatus(),
  });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function prefillEmail() {
    if (email) return;
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user?.email) setEmail(s.session.user.email);
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await join({ data: { email } });
      toast.success("You're on the list. We'll email when device sync goes live.");
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated p-5 space-y-3">
      <div className="flex items-center gap-2 text-gold">
        <Link2 className="h-4 w-4" />
        <p className="label-mono">Connect your device</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Your data, your dashboard. Sleep, HRV, activity, and lab results — all in REBUILT.
      </p>
      <NativeAppleWatchNotice />
      <div className="space-y-2 pt-1">
        {(Object.keys(META) as Provider[]).map((p) => {
          const meta = META[p];
          const Icon = meta.icon;
          const isAppleOnDevice = p === "apple_health" && isNative() && nativePlatform() === "ios";
          return (
            <div
              key={p}
              className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="h-9 w-9 rounded-md bg-card flex items-center justify-center">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground truncate">{meta.tagline}</p>
              </div>
              {isAppleOnDevice ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await requestHealthPermissions();
                    if (ok) toast.success("Apple Watch connected. Pulling your data.");
                    else toast.error("Health permission denied. Enable it in Settings → Privacy → Health → REBUILT.");
                  }}
                  className="h-8 px-3 rounded-md border border-gold/40 text-[11px] uppercase tracking-[0.14em] text-gold font-medium hover:bg-gold/10"
                >
                  Connect
                </button>
              ) : (
                <span className="h-8 pl-2.5 pr-3 rounded-md border border-gold/30 bg-gold/5 text-[11px] uppercase tracking-[0.14em] text-gold inline-flex items-center gap-1.5 font-medium">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-gold/60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
                  </span>
                  Coming soon
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : data?.joined ? (
          <div className="rounded-md border border-gold/40 bg-gold/10 p-3">
            <p className="text-xs text-foreground">
              <Check className="inline h-3.5 w-3.5 text-gold mr-1" />
              You're on the list. We'll email{" "}
              <span className="text-gold">{data.email}</span> when sync unlocks.
            </p>
          </div>
        ) : (
          <form onSubmit={onJoin} className="space-y-2">
            <p className="label-mono text-[11px] text-muted-foreground">
              Apple Watch sync arrives with our iOS app — join the list and you'll be first in
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onFocus={prefillEmail}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 flex-1 min-w-0 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-gold h-10 px-4 rounded-md text-xs font-medium disabled:opacity-60 whitespace-nowrap"
              >
                {busy ? "…" : "Notify me"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function NativeAppleWatchNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(isNative() && nativePlatform() === "ios"); }, []);
  if (!show) return null;
  return (
    <div className="rounded-md border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
      <Check className="inline h-3.5 w-3.5 text-gold mr-1" />
      Running in the REBUILT iOS app. Tap <span className="text-gold">Connect</span> on Apple Watch to grant HealthKit access.
    </div>
  );
}

