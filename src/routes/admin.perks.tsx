import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listPartnerPerkConfigs,
  setPartnerPerkConfig,
  type PartnerPerkConfig,
} from "@/lib/perks.functions";

type TierReq = "free" | "pro" | "elite";

export const Route = createFileRoute("/admin/perks")({
  component: AdminPerksPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="font-display text-xl">Perks</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <button
          className="mt-4 btn-gold h-10 px-4 rounded-md text-sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </button>
      </div>
    );
  },
  notFoundComponent: () => <p className="p-8 text-center">Not found.</p>,
});

function AdminPerksPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-perk-configs"],
    queryFn: () => listPartnerPerkConfigs(),
  });

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="label-mono text-gold text-[10px]">REBUILT ADMIN</p>
          <h1 className="font-display text-2xl">Member perks</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Toggle partner perks, set the discount percent, and choose the
            minimum member tier. Codes auto-issue per member and revoke when a
            subscription lapses.
          </p>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </Link>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && (
        <div className="space-y-3">
          {q.data.map((cfg) => (
            <PerkEditor
              key={cfg.partner}
              cfg={cfg}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-perk-configs"] })}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
        Partner-site verify endpoint:{" "}
        <code className="font-mono">/api/public/perks/verify</code>. Requests
        must include an <code className="font-mono">x-perk-signature</code>{" "}
        HMAC-SHA256 of the raw JSON body, keyed with{" "}
        <code className="font-mono">PERK_SYNC_SECRET</code>.
      </p>
    </div>
  );
}

function PerkEditor({
  cfg,
  onSaved,
}: {
  cfg: PartnerPerkConfig;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [pct, setPct] = useState<number>(cfg.discount_percent);
  const [tier, setTier] = useState<TierReq>(cfg.tier_required);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(cfg.enabled);
    setPct(cfg.discount_percent);
    setTier(cfg.tier_required);
  }, [cfg]);

  const label =
    cfg.partner === "youthfullab"
      ? "YouthfulLab (research use)"
      : "CandyRx (prescription — licensed providers)";

  async function save() {
    setSaving(true);
    try {
      await setPartnerPerkConfig({
        data: {
          partner: cfg.partner,
          enabled,
          discount_percent: Math.max(0, Math.min(90, Math.round(pct))),
          tier_required: tier,
        },
      });
      toast.success(`${label} saved`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-[10px] text-gold">PARTNER</p>
          <h2 className="font-display text-lg">{label}</h2>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label-mono text-[10px] text-muted-foreground">
            DISCOUNT %
          </label>
          <input
            type="number"
            min={0}
            max={90}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full mt-1 rounded-md border border-border bg-input p-2 text-sm"
          />
        </div>
        <div>
          <label className="label-mono text-[10px] text-muted-foreground">
            MIN TIER
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as TierReq)}
            className="w-full mt-1 rounded-md border border-border bg-input p-2 text-sm"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Last updated {new Date(cfg.updated_at).toLocaleString()}
        </p>
        <button
          disabled={saving}
          onClick={save}
          className="h-9 px-3 btn-gold rounded-md text-xs disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
