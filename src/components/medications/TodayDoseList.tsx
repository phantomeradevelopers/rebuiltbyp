import { CheckCircle2, Circle, X } from "lucide-react";
import type { DoseEvent } from "@/lib/medications.functions";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRoute(r: string | null) {
  if (!r) return "";
  return ({ subq: "subq", im: "IM", oral: "oral", topical: "topical", nasal: "nasal" } as Record<string, string>)[r] ?? r;
}

export function TodayDoseList({
  doses,
  onMark,
  emptyHint,
}: {
  doses: DoseEvent[];
  onMark: (d: DoseEvent, status: "taken" | "skipped") => void;
  emptyHint?: string;
}) {
  if (!doses.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        {emptyHint ?? "No medications scheduled for today."}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {doses.map((d) => {
        const taken = d.status === "taken";
        const skipped = d.status === "skipped";
        return (
          <li
            key={d.id}
            className={`flex items-center gap-3 p-3 rounded-md border ${
              taken ? "border-gold/30 bg-gold/5" : skipped ? "border-border bg-background/20 opacity-60" : "border-border bg-background/40"
            }`}
          >
            <button
              type="button"
              aria-label={taken ? "Mark not taken" : "Mark taken"}
              onClick={() => onMark(d, taken ? "skipped" : "taken")}
              className="shrink-0"
            >
              {taken ? (
                <CheckCircle2 className="h-5 w-5 text-gold" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm truncate ${taken ? "line-through opacity-70" : ""}`}>
                {d.medication?.display_name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {fmtTime(d.scheduled_at)}
                {d.medication?.dose_amount != null && (
                  <> · {d.medication.dose_amount}{d.medication.dose_unit ?? ""}</>
                )}
                {d.medication?.route && <> · {formatRoute(d.medication.route)}</>}
              </p>
            </div>
            {!taken && !skipped && (
              <button
                type="button"
                aria-label="Skip"
                onClick={() => onMark(d, "skipped")}
                className="text-muted-foreground hover:text-destructive text-xs shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
