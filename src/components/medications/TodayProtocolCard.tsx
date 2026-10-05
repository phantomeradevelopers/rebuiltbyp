import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Pill, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getTodayDoses, logDose, type DoseEvent } from "@/lib/medications.functions";
import { TodayDoseList } from "./TodayDoseList";
import { MedicationAddSheet } from "./MedicationAddSheet";

export function TodayProtocolCard() {
  const qc = useQueryClient();
  const fetchDoses = useServerFn(getTodayDoses);
  const logFn = useServerFn(logDose);
  const [addOpen, setAddOpen] = useState(false);

  const { data: doses } = useQuery({
    queryKey: ["med-today-doses"],
    queryFn: () => fetchDoses(),
    staleTime: 30_000,
  });

  const mark = useMutation({
    mutationFn: async ({ d, status }: { d: DoseEvent; status: "taken" | "skipped" }) =>
      logFn({ data: { medication_id: d.medication_id, scheduled_at: d.scheduled_at, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["med-today-doses"] }),
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  // Empty state: surface a CTA so new users can add their first medication.
  if (!doses || doses.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full text-left block card-elevated p-5 border-gold/30 hover:border-gold/60 transition-colors active:scale-[0.99]"
        >
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Pill className="h-3 w-3" /> Your protocol
          </p>
          <p className="mt-2 font-display text-xl leading-tight">
            Log what you're taking.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your CandyRx prescriptions, supplements, and more. REBUILT sends reminders at times you set.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-gold label-mono">
            <Plus className="h-3 w-3" /> Add medication
          </span>
        </button>
        <MedicationAddSheet open={addOpen} onOpenChange={setAddOpen} />
      </>
    );
  }

  const taken = doses.filter((d) => d.status === "taken").length;

  return (
    <>
      <section className="card-elevated p-5 animate-count-up space-y-3" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Pill className="h-3 w-3" /> Today's protocol
          </p>
          <span className="label-mono text-xs text-muted-foreground">
            {taken} of {doses.length} taken
          </span>
        </div>

        <TodayDoseList
          doses={doses}
          onMark={(d, status) => mark.mutate({ d, status })}
        />

        <div className="flex items-center justify-between pt-1 gap-3">
          <Link
            to="/app/protocol"
            className="label-mono text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
          >
            Full protocol <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="label-mono text-xs text-gold inline-flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </section>
      <MedicationAddSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
