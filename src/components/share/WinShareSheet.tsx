import { useEffect, useRef, useState } from "react";
import { X, Share2, Download } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useTrack } from "@/lib/track";
import { getMyReferralInfo } from "@/lib/referrals.functions";
import {
  drawWinCard,
  canvasToBlob,
  shareOrDownload,
} from "./ShareCardCanvas";

const TAGLINES = [
  "Built one rep at a time.",
  "Keep showing up.",
  "Discipline > motivation.",
  "Rebuilt, not repaired.",
];

export function WinShareSheet({
  open,
  onClose,
  title,
  description,
  includeReferral = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  includeReferral?: boolean;
}) {
  const { track } = useTrack();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [customLine, setCustomLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [refLink, setRefLink] = useState<string>("");
  const [refCode, setRefCode] = useState<string>("");
  const fetchRef = useServerFn(getMyReferralInfo);
  const tagline = description || TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

  useEffect(() => {
    if (!open || !includeReferral) return;
    (async () => {
      try {
        const info = await fetchRef();
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setRefCode(info.code);
        setRefLink(`${origin}/?ref=${info.code}`);
      } catch {
        setRefLink("");
      }
    })();
  }, [open, includeReferral, fetchRef]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    drawWinCard(canvasRef.current, {
      track,
      title,
      tagline,
      customLine,
      referralLink: refLink || undefined,
    });
  }, [open, track, title, tagline, customLine, refLink]);

  if (!open) return null;

  async function handleShare() {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const shareText = refCode
        ? `${title} — my invite to Rebuilt: ${refLink}`
        : title;
      const file = new File([blob], `rebuilt-win-${Date.now()}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title, text: shareText, url: refLink || undefined });
          return;
        } catch {
          // fall through
        }
      }
      const result = await shareOrDownload(
        blob,
        `rebuilt-win-${Date.now()}.png`,
        title,
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
        <p className="label-mono text-gold text-xs">Share win</p>
        <div className="rounded-lg overflow-hidden border border-border bg-black">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ aspectRatio: "1080 / 1350" }}
          />
        </div>
        <div>
          <label className="label-mono text-[10px] text-muted-foreground">
            Add a line — optional
          </label>
          <input
            type="text"
            value={customLine}
            onChange={(e) => setCustomLine(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder=""
            className="mt-1 w-full h-10 rounded-md border border-border bg-input/40 px-3 text-sm"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            No weight, name, or personal data is included unless you type it here.
            {refCode && ` Your invite link is baked into the card so a share = an invite.`}
          </p>
        </div>
        <button
          onClick={handleShare}
          disabled={busy}
          className="w-full h-12 rounded-xl btn-gold text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? (
            "Preparing…"
          ) : (
            <>
              <Share2 className="h-4 w-4" /> Share / Save
            </>
          )}
        </button>
        <p className="text-[10px] text-muted-foreground text-center inline-flex items-center justify-center gap-1">
          <Download className="h-3 w-3" /> Falls back to download if sharing isn't available.
        </p>
      </div>
    </div>
  );
}
