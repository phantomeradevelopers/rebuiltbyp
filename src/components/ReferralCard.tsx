import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Share2, Users, Sparkles, Check, ChevronDown, Gift, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralInfo, type ReferralInfo } from "@/lib/referrals.functions";
import { getReferralRewardsView, type ReferralRewardsView } from "@/lib/referral-rewards.functions";


export function ReferralCard({ variant = "full" }: { variant?: "full" | "compact" }) {
  const fetchInfo = useServerFn(getMyReferralInfo);
  const fetchRewards = useServerFn(getReferralRewardsView);
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [rewards, setRewards] = useState<ReferralRewardsView | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, w] = await Promise.all([fetchInfo(), fetchRewards()]);
        setInfo(r);
        setRewards(w);
      } catch (e) {
        console.error("referral info", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchInfo, fetchRewards]);

  if (loading) {
    if (variant === "compact") {
      return <div className="h-12 rounded-md border border-border bg-card/40 animate-pulse" />;
    }
    return (
      <div className="card-elevated p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted/40 rounded" />
        <div className="h-10 mt-4 bg-muted/30 rounded" />
      </div>
    );
  }
  if (!info) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/?ref=${info.code}`;
  const shareText = `I'm rebuilding myself with Rebuilt. Use my code ${info.code} when you sign up: ${link}`;


  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Rebuilt",
          text: shareText,
          url: link,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }

  const body = (
    <>
      <div className="rounded-xl border border-border bg-input/40 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your code</p>
        <p className="font-display text-3xl tracking-[0.15em] text-gold mt-1">{info.code}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copyLink}
          className="h-11 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center justify-center gap-2 hover:border-gold transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-gold" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={share}
          className="h-11 rounded-xl btn-gold text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      <div className="hairline" />

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Signed up" value={info.signups} />
        <Stat label="Converted" value={info.converted} accent />
        <Stat label="Rewards paid" value={rewards?.claims_as_referrer_count ?? 0} />
      </div>

      {rewards?.config?.enabled && (
        <div className="rounded-md border border-gold/30 bg-gold/5 p-3 space-y-1.5">
          <p className="label-mono text-gold flex items-center gap-1.5 text-[11px]">
            <Gift className="h-3 w-3" /> Real rewards, real threshold
          </p>
          <p className="text-xs text-muted-foreground">
            When your invite completes <span className="text-foreground font-medium">{rewards.config.activity_threshold_checkins}</span>{" "}
            check-ins, you both earn:
          </p>
          <ul className="text-xs space-y-0.5">
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-gold" />
              You: <span className="font-medium text-foreground">+{rewards.config.reps_referrer} Reps</span>
              {rewards.config.freeze_referrer > 0 && (
                <span className="text-muted-foreground">
                  {" "}· <Snowflake className="h-3 w-3 inline" /> {rewards.config.freeze_referrer} freeze token
                </span>
              )}
            </li>
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-gold" />
              Them: +{rewards.config.reps_referred} Reps
              {rewards.config.freeze_referred > 0 && (
                <> · <Snowflake className="h-3 w-3 inline" /> {rewards.config.freeze_referred} freeze token</>
              )}
            </li>
          </ul>
          {rewards.my_claim_as_referred && (
            <p className="text-[11px] text-gold pt-1 border-t border-gold/20">
              You earned +{rewards.my_claim_as_referred.reps_referred} Reps when you crossed the threshold.
            </p>
          )}
        </div>
      )}

      {info.referredByCode && (
        <p className="text-[11px] text-center text-muted-foreground pt-1 border-t border-border">
          Invited by code <span className="text-foreground font-mono">{info.referredByCode}</span>
        </p>
      )}
    </>
  );

  if (variant === "compact") {
    return (
      <div className="rounded-md border border-gold/40 bg-gold/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-gold/10 transition"
        >
          <div className="min-w-0 flex items-center gap-2">
            <Users className="h-4 w-4 text-gold shrink-0" />
            <div className="min-w-0">
              <p className="label-mono text-gold text-xs">Bring a friend</p>
              <p className="text-sm mt-0.5 truncate">
                Share your code · earn the Recruiter trophy
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gold shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="border-t border-gold/30 p-4 space-y-4 bg-background/40">
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-elevated p-5 space-y-4 border-l-2 border-l-gold">
      <div className="flex items-center gap-2 text-gold">
        <Users className="h-4 w-4" />
        <p className="label-mono">Bring a friend</p>
      </div>

      <div>
        <p className="font-display text-xl leading-tight">Pull someone else out of the same hole.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your code. When they finish onboarding, you earn a Recruiter trophy.
        </p>
      </div>

      {body}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className={`font-display text-2xl ${accent ? "text-gold" : ""}`}>{value}</p>
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
