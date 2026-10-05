import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMedicationCatalog,
  upsertUserMedication,
  getWakeTime,
  type CatalogItem,
  type UserMedication,
} from "@/lib/medications.functions";
import { addShipment } from "@/lib/shipments.functions";
import { acceptDocument, getMyAcceptances } from "@/lib/legal.functions";
import { MedicationPicker } from "@/components/medications/MedicationPicker";
import { MedicationScheduleForm, type ScheduleFormValue } from "@/components/medications/MedicationScheduleForm";
import { MedicationDisclaimer } from "@/components/medications/MedicationDisclaimer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const ACCEPT_DOC = "medication_tracker_v1";

type Step =
  | { kind: "loading" }
  | { kind: "accept" }
  | { kind: "picker" }
  | { kind: "form"; catalog: CatalogItem | null; editing?: UserMedication };

export function MedicationAddSheet({
  open,
  onOpenChange,
  initialEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optionally start the sheet on the form step for an existing med (edit flow). */
  initialEdit?: UserMedication;
}) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const listCatalogFn = useServerFn(listMedicationCatalog);
  const upsertFn = useServerFn(upsertUserMedication);
  const wakeFn = useServerFn(getWakeTime);
  const acceptancesFn = useServerFn(getMyAcceptances);
  const acceptFn = useServerFn(acceptDocument);
  const addShipmentFn = useServerFn(addShipment);

  const catalog = useQuery({
    queryKey: ["med-catalog"],
    queryFn: () => listCatalogFn(),
    enabled: open,
  });
  const wake = useQuery({
    queryKey: ["wake-time"],
    queryFn: () => wakeFn(),
    enabled: open,
  });
  const accepted = useQuery({
    queryKey: ["med-accepted"],
    queryFn: async () => {
      const r = await acceptancesFn();
      return { accepted: r.acceptances.some((a) => a.document === ACCEPT_DOC) };
    },
    enabled: open,
  });

  const [step, setStep] = useState<Step>({ kind: "loading" });

  // When the sheet opens, decide where to start: edit > picker (if accepted) > accept gate.
  // Always reset to loading on close so reopening never flashes the previous step.
  useEffect(() => {
    if (!open) {
      setStep({ kind: "loading" });
      return;
    }
    if (initialEdit) {
      if (!catalog.isFetched) return;
      const cat = catalog.data?.find((c) => c.id === initialEdit.catalog_id) ?? null;
      setStep({ kind: "form", catalog: cat, editing: initialEdit });
      return;
    }
    if (!accepted.isFetched || !catalog.isFetched) return;
    setStep(accepted.data?.accepted ? { kind: "picker" } : { kind: "accept" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accepted.isFetched, accepted.data?.accepted, initialEdit, catalog.isFetched, catalog.data]);

  const acceptMutation = useMutation({
    mutationFn: () => acceptFn({ data: { document: ACCEPT_DOC, version: "1.0" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-accepted"] });
      setStep({ kind: "picker" });
    },
  });

  const upsert = useMutation({
    mutationFn: async (v: ScheduleFormValue & { id?: string }) => {
      const res = await upsertFn({
        data: {
          id: v.id,
          catalog_id: v.catalog_id,
          display_name: v.display_name,
          dose_amount: v.dose_amount,
          dose_unit: v.dose_unit,
          route: v.route,
          schedule_type: v.schedule_type,
          schedule_config: v.schedule_config,
          source_tag: v.source_tag,
          notes: v.notes,
        },
      });
      const medId = (res as { id?: string } | undefined)?.id ?? v.id ?? null;
      if (v.shipment?.enabled && v.shipment.tracking_number.trim().length >= 4) {
        try {
          await addShipmentFn({
            data: {
              medication_id: medId,
              carrier: v.shipment.carrier,
              tracking_number: v.shipment.tracking_number.trim(),
            },
          });
        } catch (e) {
          toast.error("Saved medication, but tracking failed: " + (e as Error).message);
        }
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-meds"] });
      qc.invalidateQueries({ queryKey: ["today-doses"] });
      qc.invalidateQueries({ queryKey: ["med-today-doses"] });
      qc.invalidateQueries({ queryKey: ["med-shipments"] });
      toast.success("Medication saved.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formCat = step.kind === "form" ? step.catalog : null;
  const formEditing = step.kind === "form" ? step.editing : undefined;

  const title =
    step.kind === "accept" ? "Before you add a medication" :
    step.kind === "picker" ? "Add medication" :
    formEditing ? formEditing.display_name : (formCat?.brand_name ?? "Add medication");

  const subtitleBits: string[] = [];
  if (step.kind === "form") {
    if (formCat?.generic_name && formCat.generic_name !== title) subtitleBits.push(formCat.generic_name);
    const routeLabel: Record<string, string> = { oral: "Oral", subq: "Subq", im: "IM", topical: "Topical", nasal: "Nasal" };
    const r = formCat?.typical_route ?? formEditing?.route ?? null;
    if (r && routeLabel[r]) subtitleBits.push(routeLabel[r]);
  }
  const subtitle = subtitleBits.join(" · ");
  const isCandyRx = step.kind === "form" && formCat?.source === "candyrx";

  const headerEl = (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-base font-semibold leading-tight truncate">{title}</span>
          {isCandyRx && (
            <span className="label-mono text-[10px] px-1.5 py-0.5 rounded border border-gold/40 text-gold bg-gold/5">CandyRx</span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );

  const body = (
    <>
      {step.kind === "loading" && (
        <div className="mt-4 space-y-2 animate-pulse" aria-hidden>
          <div className="h-11 rounded-md bg-muted/40" />
          <div className="h-14 rounded-md bg-muted/30" />
          <div className="h-14 rounded-md bg-muted/20" />
          <div className="h-14 rounded-md bg-muted/10" />
        </div>
      )}
      {step.kind === "accept" && (
        <AcceptGate
          onCancel={() => onOpenChange(false)}
          onAccept={() => acceptMutation.mutate()}
          pending={acceptMutation.isPending}
        />
      )}
      {step.kind === "picker" && (
        <div className="mt-2">
          <MedicationPicker
            catalog={catalog.data ?? []}
            onPick={(c) => setStep({ kind: "form", catalog: c })}
          />
        </div>
      )}
      {step.kind === "form" && (
        <div className="mt-2">
          <MedicationScheduleForm
            catalog={step.catalog}
            initialCatalog={step.catalog}
            initial={step.editing}
            submitting={upsert.isPending}
            wakeTime={wake.data?.wake_time ?? "07:00"}
            middayTime={wake.data?.midday_time ?? "12:30"}
            eveningTime={wake.data?.evening_time ?? "20:00"}
            usedTimes={wake.data?.used_times ?? []}
            onCancel={() => (step.editing ? onOpenChange(false) : setStep({ kind: "picker" }))}
            onSubmit={(v) => upsert.mutate({ ...v, id: step.editing?.id })}
          />
        </div>
      )}

    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/60 text-left">
            <SheetTitle asChild>{headerEl}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {body}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle asChild>{headerEl}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function AcceptGate({ onCancel, onAccept, pending }: { onCancel: () => void; onAccept: () => void; pending: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-3 mt-2">
      <MedicationDisclaimer />
      <label className="flex items-start gap-2 cursor-pointer rounded-md border border-gold/40 bg-gold/5 p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-xs text-foreground/90 leading-relaxed">
          I have an active prescription from a licensed clinician for the medication I'm about to add.
          REBUILT only reminds — it does not prescribe, dispense, advise on dosing, or replace my clinician.
        </span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 h-11 rounded-md border border-border text-sm">Cancel</button>
        <button
          onClick={onAccept}
          disabled={!checked || pending}
          className="flex-1 h-11 rounded-md bg-gold text-gold-foreground text-sm font-medium disabled:opacity-50"
        >{pending ? "…" : "Continue"}</button>
      </div>
    </div>
  );
}
