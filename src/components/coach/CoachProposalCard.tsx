import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, ShieldAlert } from "lucide-react";
import { applyCoachProposal, type CoachProposal } from "@/lib/coach-actions.functions";

/**
 * The coach emits structured change proposals at the end of its replies:
 *
 *   ::propose
 *   { "kind": "profile.update", "patch": { ... }, "summary": "..." }
 *   ::end
 *
 * Returns the proposal + the plain prose with the fence stripped.
 */
export function parseCoachProposal(content: string): { prose: string; proposal: CoachProposal | null } {
  const fenceRe = /::propose\s*([\s\S]*?)\s*::end/i;
  const match = content.match(fenceRe);
  if (!match) return { prose: content, proposal: null };
  const raw = match[1].trim();
  // Strip an optional ```json wrapper if the model added one.
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as CoachProposal;
    if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
      return { prose: content.replace(fenceRe, "").trim(), proposal: null };
    }
    return {
      prose: content.replace(fenceRe, "").trim(),
      proposal: parsed,
    };
  } catch {
    return { prose: content.replace(fenceRe, "").trim(), proposal: null };
  }
}

export function CoachProposalCard({
  proposal,
  conversationId,
  messageId,
}: {
  proposal: CoachProposal;
  conversationId: string | null;
  messageId: string | null;
}) {
  const qc = useQueryClient();
  const applyFn = useServerFn(applyCoachProposal);
  const [state, setState] = useState<"pending" | "applied" | "cancelled">("pending");
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const isDestructive = proposal.kind === "medication.archive";

  const apply = useMutation({
    mutationFn: async () => {
      return applyFn({
        data: {
          proposal,
          conversation_id: conversationId,
          message_id: messageId,
        },
      });
    },
    onSuccess: (res) => {
      setState("applied");
      toast.success(res.summary || "Applied.");
      // Invalidate everything the proposal might have changed.
      qc.invalidateQueries({ queryKey: ["my-meds"] });
      qc.invalidateQueries({ queryKey: ["today-doses"] });
      qc.invalidateQueries({ queryKey: ["med-today-doses"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
      qc.invalidateQueries({ queryKey: ["today-mode"] });
      qc.invalidateQueries({ queryKey: ["daily-checkin"] });
      qc.invalidateQueries({ queryKey: ["streaks"] });
      qc.invalidateQueries({ queryKey: ["plan-refinements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (state === "cancelled") {
    return (
      <div className="mt-2 max-w-[85%] rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
        Change cancelled.
      </div>
    );
  }

  if (state === "applied") {
    return (
      <div className="mt-2 max-w-[85%] rounded-xl border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-foreground/90 inline-flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5 text-gold" />
        Applied{proposal.summary ? `: ${proposal.summary}` : ""}.
      </div>
    );
  }

  const title = headlineFor(proposal);
  const details = detailsFor(proposal);

  return (
    <div className="mt-2 max-w-[85%] rounded-xl border border-gold/40 bg-card px-3.5 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        {isDestructive ? (
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
        )}
        <p className="label-mono text-[10px] uppercase tracking-wide text-gold">
          {isDestructive ? "Confirm change" : "Coach wants to change"}
        </p>
      </div>

      <p className="text-sm leading-snug font-medium">{title}</p>

      {details.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {details.map((d, i) => (
            <li key={i} className="leading-relaxed">{d}</li>
          ))}
        </ul>
      )}

      {isDestructive && !confirmingArchive ? (
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => setState("cancelled")}
            className="flex-1 h-9 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 inline mr-1" /> Keep it
          </button>
          <button
            onClick={() => setConfirmingArchive(true)}
            className="flex-1 h-9 rounded-md border border-amber-500/40 bg-amber-500/5 text-xs text-amber-400 hover:bg-amber-500/10"
          >
            Continue…
          </button>
        </div>
      ) : (
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => setState("cancelled")}
            disabled={apply.isPending}
            className="flex-1 h-9 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => apply.mutate()}
            disabled={apply.isPending}
            className="flex-1 h-9 rounded-md bg-gold text-gold-foreground text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            {apply.isPending ? "Applying…" : (isDestructive ? "Yes, archive" : "Confirm")}
          </button>
        </div>
      )}
    </div>
  );
}

function headlineFor(p: CoachProposal): string {
  if (p.summary) return p.summary;
  switch (p.kind) {
    case "profile.update": return `Update ${Object.keys(p.patch).join(", ")}.`;
    case "medication.add": return `Track ${p.display_name} in your medication log.`;
    case "medication.archive": return `Archive this medication.`;
    case "medication.edit": return `Update this medication.`;
    case "workout.swap_recovery": return `Swap today's workout for recovery.`;
    case "workout.mark_done": return `Log today's workout as complete.`;
    case "plan.add_refinement": return `Queue this for your ${p.target} plan.`;
  }
}

function detailsFor(p: CoachProposal): string[] {
  const out: string[] = [];
  if (p.kind === "profile.update") {
    for (const [k, v] of Object.entries(p.patch)) {
      out.push(`${k} → ${formatVal(v)}`);
    }
  } else if (p.kind === "medication.add") {
    const dose = [p.dose_amount, p.dose_unit].filter(Boolean).join(" ");
    if (dose) out.push(`Dose: ${dose}`);
    if (p.route) out.push(`Route: ${p.route}`);
    out.push(`Schedule: ${describeSchedule(p.schedule_type, p.schedule_config)}`);
  } else if (p.kind === "medication.edit") {
    for (const [k, v] of Object.entries(p.patch)) {
      if (v === undefined) continue;
      out.push(`${k} → ${formatVal(v)}`);
    }
  } else if (p.kind === "workout.swap_recovery") {
    if (p.note) out.push(p.note);
  } else if (p.kind === "plan.add_refinement") {
    out.push(p.request);
  }
  return out;
}


function describeSchedule(t: string, cfg: Record<string, unknown>): string {
  const times = Array.isArray(cfg.times) ? (cfg.times as string[]).join(", ") : "";
  if (t === "as_needed") return "As needed";
  if (t === "daily") return `Daily${times ? ` at ${times}` : ""}`;
  if (t === "weekly_days") {
    const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = Array.isArray(cfg.days_of_week)
      ? (cfg.days_of_week as number[]).map((d) => dn[d]).join("/")
      : "";
    return `${days}${times ? ` at ${times}` : ""}`;
  }
  if (t === "every_n_days") return `Every ${cfg.every_n_days ?? 1} days${times ? ` at ${times}` : ""}`;
  if (t === "cycle") return `${cfg.cycle_on ?? 5} on / ${cfg.cycle_off ?? 2} off${times ? ` at ${times}` : ""}`;
  return t;
}

function formatVal(v: unknown): string {
  if (v === null) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
