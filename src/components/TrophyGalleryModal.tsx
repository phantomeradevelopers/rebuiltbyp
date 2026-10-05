import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAchievements, type AchievementWithStatus, type Rarity } from "@/lib/achievements.functions";
import { TrophyCard } from "./TrophyCard";

const TIERS: { key: Rarity | "all"; label: string; subtitle: string }[] = [
  { key: "all",      label: "All",      subtitle: "Every trophy in the vault" },
  { key: "bronze",   label: "Recruit",  subtitle: "Bronze — first steps" },
  { key: "silver",   label: "Soldier",  subtitle: "Silver — proving ground" },
  { key: "gold",     label: "Warrior",  subtitle: "Gold — earned and forged" },
  { key: "platinum", label: "Champion", subtitle: "Platinum — elite tier" },
  { key: "mythic",   label: "Legend",   subtitle: "Mythic — gods take notice" },
];

export function TrophyGalleryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tier, setTier] = useState<Rarity | "all">("all");
  const [authReady, setAuthReady] = useState(false);
  const [preview, setPreview] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("trophyPreviewMode") === "1";
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthReady(!!data.user);
    });
    return () => { cancelled = true; };
  }, [open]);

  const { data } = useQuery({
    queryKey: ["achievements-full"],
    queryFn: () => listAchievements(),
    enabled: open && authReady,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("trophyPreviewMode", preview ? "1" : "0");
    }
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const items: AchievementWithStatus[] = data?.items ?? [];
  const filtered = tier === "all" ? items : items.filter((i) => i.rarity === tier);
  const activeTier = TIERS.find((t) => t.key === tier)!;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono text-gold">Trophy Vault</p>
            <h2 className="font-display text-3xl mt-1 text-gold-shimmer">Every trophy</h2>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full border border-border grid place-items-center hover:bg-muted transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Each one a receipt. Each one a war won against the old you.
        </p>

        {/* Tier tabs */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {TIERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTier(t.key)}
              className={`shrink-0 h-9 px-4 rounded-full text-xs font-medium transition-all ${
                tier === t.key ? "bg-gold text-gold-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{activeTier.subtitle}</p>
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 shrink-0">
            <button
              onClick={() => setPreview(false)}
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-all ${!preview ? "bg-gold text-gold-foreground" : "text-muted-foreground"}`}
            >Earned</button>
            <button
              onClick={() => setPreview(true)}
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-all ${preview ? "bg-gold text-gold-foreground" : "text-muted-foreground"}`}
            >Preview all</button>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 justify-items-center">
          {filtered.map((t, i) => (
            <div key={t.key} className="flex flex-col items-center">
              <TrophyCard
                achievementKey={t.key}
                rarity={t.rarity as Rarity}
                icon={t.icon}
                title={t.title}
                description={t.description}
                unlocked={t.unlocked}
                preview={preview}
                serial={`№ ${String(i + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`}
                size="md"
              />
              <p className="mt-2 label-mono text-xs text-gold">
                {t.unlocked ? "Earned" : `${t.current} / ${t.target}`}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-12">
              No trophies in this tier yet.
            </p>
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
