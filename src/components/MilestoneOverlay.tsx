import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import type { MilestoneEvent } from "@/lib/celebrate";
import { SignatureSeal } from "./brand/SignatureSeal";
import { WinShareSheet } from "./share/WinShareSheet";

export function MilestoneOverlay() {
  const [event, setEvent] = useState<MilestoneEvent | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    function onMilestone(e: Event) {
      const detail = (e as CustomEvent<MilestoneEvent>).detail;
      if (!detail) return;
      setEvent(detail);
    }
    window.addEventListener("rebuilt:milestone", onMilestone);
    return () => window.removeEventListener("rebuilt:milestone", onMilestone);
  }, []);

  useEffect(() => {
    if (!event || shareOpen) return;
    const t = setTimeout(() => setEvent(null), 8000);
    return () => clearTimeout(t);
  }, [event, shareOpen]);

  if (!event) return null;

  return (
    <>
      <div
        role="dialog"
        aria-live="assertive"
        onClick={() => setEvent(null)}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-xl px-6 animate-in fade-in duration-300"
      >
        <div
          className="card-elevated max-w-sm w-full p-8 text-center border-gold/40 animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="label-mono text-gold">Milestone</p>
          {event.bigNumber !== undefined && (
            <p className="font-display text-7xl leading-none mt-4 text-gold-shimmer">
              {event.bigNumber}
            </p>
          )}
          <h2 className="font-display text-3xl leading-tight mt-4">{event.title}</h2>
          {event.subtitle && (
            <p className="mt-3 text-muted-foreground">{event.subtitle}</p>
          )}
          <div className="mt-4 flex justify-center">
            <SignatureSeal size="sm" prefix="—" opacity={0.7} />
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="mt-6 h-11 w-full rounded-md border border-gold/50 text-gold text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-gold/5"
          >
            <Share2 className="h-4 w-4" /> Share this win
          </button>
          <button
            onClick={() => setEvent(null)}
            className="btn-gold mt-2 h-12 w-full rounded-md text-sm font-medium"
          >
            Continue
          </button>
        </div>
      </div>
      <WinShareSheet
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
          setEvent(null);
        }}
        title={event.title}
        description={event.subtitle}
      />
    </>
  );
}
