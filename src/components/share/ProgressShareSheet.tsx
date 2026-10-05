import { useEffect, useRef, useState } from "react";
import { X, Share2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useTrack } from "@/lib/track";
import {
  drawProgressCard,
  canvasToBlob,
  shareOrDownload,
} from "./ShareCardCanvas";

type Photo = { url: string; logged_at: string };

export function ProgressShareSheet({
  open,
  onClose,
  before,
  after,
}: {
  open: boolean;
  onClose: () => void;
  before: Photo | null;
  after: Photo | null;
}) {
  const { track } = useTrack();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setDrawn(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !confirmed || !canvasRef.current || !before || !after) return;
    let cancelled = false;
    drawProgressCard(canvasRef.current, {
      track,
      beforeUrl: before.url,
      afterUrl: after.url,
      beforeDate: before.logged_at,
      afterDate: after.logged_at,
    })
      .then(() => { if (!cancelled) setDrawn(true); })
      .catch((e) => toast.error(e?.message || "Could not render card."));
    return () => { cancelled = true; };
  }, [open, confirmed, track, before, after]);

  if (!open || !before || !after) return null;

  async function handleShare() {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const result = await shareOrDownload(
        blob,
        `rebuilt-progress-${Date.now()}.png`,
        "My progress · REBUILT",
      );
      if (result === "downloaded") toast.success("Card saved to your downloads.");
    } catch (e) {
      toast.error((e as Error).message || "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-background/90 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-elevated p-5 space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-md hover:bg-muted/30"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="label-mono text-gold text-xs">Share progress</p>

        {!confirmed ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-gold">
                <ShieldAlert className="h-4 w-4" />
                <p className="label-mono text-xs">Privacy check</p>
              </div>
              <p className="text-sm leading-relaxed">
                This card will include your <strong>before</strong> and <strong>now</strong> photos
                side-by-side. Anyone you send it to will see them. We don't add your name,
                weight, or any other data.
              </p>
              <p className="text-xs text-muted-foreground">
                Each photo is watermarked so it stays attributable if it gets re-shared.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onClose}
                className="h-11 rounded-xl border border-border bg-card text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmed(true)}
                className="h-11 rounded-xl btn-gold text-sm font-medium"
              >
                Generate card
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg overflow-hidden border border-border bg-black">
              <canvas
                ref={canvasRef}
                className="w-full h-auto block"
                style={{ aspectRatio: "1080 / 1350" }}
              />
            </div>
            <button
              onClick={handleShare}
              disabled={busy || !drawn}
              className="w-full h-12 rounded-xl btn-gold text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy || !drawn ? (
                "Preparing…"
              ) : (
                <>
                  <Share2 className="h-4 w-4" /> Share / Save
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
