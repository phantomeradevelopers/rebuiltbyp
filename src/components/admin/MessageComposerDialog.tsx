import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminSendMessage } from "@/lib/admin-messages.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Kind = "upsell_1m" | "upsell_2m" | "check_in" | "custom";

const TEMPLATES: Record<Kind, { subject: string; body: string; cta_label?: string; cta_url?: string }> = {
  upsell_1m: {
    subject: "A month in — let's go deeper",
    body:
      "You've put in real work this month. I'd love to take this to the next level with you 1-on-1 — tighter accountability, custom plan adjustments, and direct access to me.\n\nIf you're ready, tap below to apply for a seat in the Inner Circle.",
    cta_label: "Apply for Inner Circle",
    cta_url: "/app/consult/apply",
  },
  upsell_2m: {
    subject: "Two months in. Time to compound this.",
    body:
      "Two months of consistency separates you from 95% of people. The next leap is working together directly — I'll help you compound everything you've built into your next phase.\n\nApply when you're ready.",
    cta_label: "Apply for Inner Circle",
    cta_url: "/app/consult/apply",
  },
  check_in: {
    subject: "Checking in",
    body: "Just wanted to check in — how are you feeling about your progress this week? Reply or hit me up on the Coach tab.",
    cta_label: "Open Coach",
    cta_url: "/app/coach",
  },
  custom: { subject: "", body: "", cta_label: "", cta_url: "" },
};

export function MessageComposerDialog({
  open,
  onOpenChange,
  recipientUserId,
  recipientName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientUserId: string;
  recipientName: string;
}) {
  const [kind, setKind] = useState<Kind>("upsell_1m");
  const [subject, setSubject] = useState(TEMPLATES.upsell_1m.subject);
  const [body, setBody] = useState(TEMPLATES.upsell_1m.body);
  const [ctaLabel, setCtaLabel] = useState(TEMPLATES.upsell_1m.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(TEMPLATES.upsell_1m.cta_url ?? "");

  function applyTemplate(k: Kind) {
    setKind(k);
    const t = TEMPLATES[k];
    setSubject(t.subject);
    setBody(t.body);
    setCtaLabel(t.cta_label ?? "");
    setCtaUrl(t.cta_url ?? "");
  }

  const send = useMutation({
    mutationFn: () =>
      adminSendMessage({
        data: {
          recipientUserId,
          kind,
          subject,
          body,
          cta_label: ctaLabel || null,
          cta_url: ctaUrl || null,
        },
      }),
    onSuccess: () => {
      toast.success("Message sent.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Message {recipientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(["upsell_1m", "upsell_2m", "check_in", "custom"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => applyTemplate(k)}
                className={`h-8 px-3 rounded-md text-xs border ${
                  kind === k ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"
                }`}
              >
                {k === "upsell_1m" ? "1-month upsell" : k === "upsell_2m" ? "2-month upsell" : k === "check_in" ? "Check-in" : "Custom"}
              </button>
            ))}
          </div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-md border border-border bg-input p-2 text-sm"
            maxLength={160}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            placeholder="Body"
            className="w-full rounded-md border border-border bg-input p-2 text-sm"
            maxLength={4000}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="CTA label (optional)"
              className="rounded-md border border-border bg-input p-2 text-xs"
              maxLength={40}
            />
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="CTA URL (optional)"
              className="rounded-md border border-border bg-input p-2 text-xs"
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-3 rounded-md text-sm border border-border"
          >
            Cancel
          </button>
          <button
            onClick={() => send.mutate()}
            disabled={send.isPending || !subject.trim() || !body.trim()}
            className="h-9 px-4 btn-gold rounded-md text-sm disabled:opacity-50"
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
