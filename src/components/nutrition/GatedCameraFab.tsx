import { useState } from "react";
import { Camera, Lock } from "lucide-react";
import { CameraFab } from "@/components/nutrition/CameraFab";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { useTier } from "@/hooks/useTier";
import { hasTier } from "@/lib/tier";

/**
 * Tier-aware Camera FAB. Pro+ get the real camera. Free users see a locked
 * gold pill that opens the upgrade sheet. (DB trigger also enforces a hard
 * 1-meal/day limit for free users, so this is purely UX.)
 */
export function GatedCameraFab() {
  const tier = useTier();
  const [open, setOpen] = useState(false);
  if (hasTier(tier, "pro")) return <CameraFab />;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Snap a meal — Pro feature"
        className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-gold/90 to-gold text-gold-foreground shadow-lg hover:scale-105 active:scale-95 transition inline-flex items-center justify-center"
      >
        <Camera className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border border-gold inline-flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-gold" />
        </span>
      </button>
      <UpgradeSheet
        open={open}
        onOpenChange={setOpen}
        feature="meal_camera"
        title="Snap any meal with the camera"
        description="Unlimited photo-based meal logging with macros and coach feedback. Free tier is capped at 1 meal/day."
      />
    </>
  );
}
