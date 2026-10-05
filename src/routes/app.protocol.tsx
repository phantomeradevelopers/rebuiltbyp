import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Pill, Plus, ChevronLeft, Archive, Pencil, Truck, History } from "lucide-react";
import { toast } from "sonner";
import { TodayProtocolCard } from "@/components/medications/TodayProtocolCard";
import { ShipmentTracker } from "@/components/medications/ShipmentTracker";
import { LowSupplyCard } from "@/components/medications/LowSupplyCard";
import { MedicationAddSheet } from "@/components/medications/MedicationAddSheet";
import { MedicationDisclaimer } from "@/components/medications/MedicationDisclaimer";
import { MedicalEducationalBanner } from "@/components/MedicalEducationalBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShipmentForm, type ShipmentFormValue } from "@/components/medications/ShipmentForm";
import { addShipment } from "@/lib/shipments.functions";
import {
  listUserMedications,
  archiveMedication,
  type UserMedication,
} from "@/lib/medications.functions";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/app/protocol")({
  component: ProtocolPage,
  head: () => ({
    meta: [
      { title: "Protocol — REBUILT" },
      {
        name: "description",
        content:
          "Your medications and supplements in one place. Log doses, watch supply, track shipments — reminders only, not medical advice.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="px-4 pt-safe pt-10 max-w-md mx-auto">
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => null,
});

function fmtSchedule(m: UserMedication): string {
  const times = m.schedule_config?.times ?? [];
  const t = times.length ? times.join(", ") : "no time set";
  if (m.schedule_type === "daily") return `Daily · ${t}`;
  if (m.schedule_type === "weekly_days") {
    const days = (m.schedule_config?.days_of_week ?? [])
      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
      .join(" ");
    return `${days || "Weekly"} · ${t}`;
  }
  if (m.schedule_type === "every_n_days")
    return `Every ${m.schedule_config?.every_n_days ?? 1}d · ${t}`;
  if (m.schedule_type === "cycle")
    return `Cycle ${m.schedule_config?.cycle_on ?? 0}/${m.schedule_config?.cycle_off ?? 0} · ${t}`;
  return "As needed";
}

function ProtocolPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUserMedications);
  const archiveFn = useServerFn(archiveMedication);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserMedication | undefined>(undefined);
  const [shipOpen, setShipOpen] = useState(false);

  const meds = useQuery({
    queryKey: ["user-medications"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-medications"] });
      qc.invalidateQueries({ queryKey: ["med-today-doses"] });
      qc.invalidateQueries({ queryKey: ["med-low-supply"] });
      toast.success("Archived.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = (meds.data ?? []).filter((m) => m.active);
  const archived = (meds.data ?? []).filter((m) => !m.active);

  return (
    <div className="px-4 sm:px-6 pt-safe pt-6 max-w-md mx-auto pb-32 space-y-6">
      <MedicalEducationalBanner />
      <header>
        <Link
          to="/app/checkin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Check-in
        </Link>
        <p className="label-mono text-gold flex items-center gap-1.5">
          <Pill className="h-3 w-3" /> Protocol
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">
          What you're taking.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          One place for every prescription, peptide, and supplement. Mark doses
          as you take them. We'll warn you before you run out.
        </p>
        <Link
          to="/app/protocol/history"
          className="mt-3 inline-flex items-center gap-1 label-mono text-xs text-gold hover:underline"
        >
          <History className="h-3 w-3" /> Dose history & CSV export →
        </Link>
      </header>

      <TodayProtocolCard />

      <LowSupplyCard />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono text-gold">Your medications</p>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setEditing(undefined);
              setAddOpen(true);
            }}
            className="label-mono text-xs text-gold inline-flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        {meds.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[color:var(--bg-sunken)] animate-pulse" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="card-elevated p-5 text-center space-y-2">
            <p className="font-display text-base">Nothing tracked yet.</p>
            <p className="text-xs text-muted-foreground">
              Add your first medication or supplement to start logging doses.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                className="card-elevated p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base truncate">
                      {m.display_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {m.dose_amount != null && (
                        <>
                          {m.dose_amount}
                          {m.dose_unit ?? ""}
                          {" · "}
                        </>
                      )}
                      {fmtSchedule(m)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(m);
                        setAddOpen(true);
                      }}
                      className="h-9 w-9 rounded-md border border-border text-foreground/60 hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5 mx-auto" />
                    </button>
                    <button
                      type="button"
                      aria-label="Archive"
                      onClick={() => {
                        if (confirm(`Archive ${m.display_name}?`)) archive.mutate(m.id);
                      }}
                      className="h-9 w-9 rounded-md border border-border text-foreground/60 hover:text-destructive hover:border-destructive/40"
                    >
                      <Archive className="h-3.5 w-3.5 mx-auto" />
                    </button>
                  </div>
                </div>
                {m.supply_remaining != null && (
                  <SupplyMeter med={m} />
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono text-gold flex items-center gap-1.5">
            <Truck className="h-3 w-3" /> Shipments
          </p>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setShipOpen(true);
            }}
            className="label-mono text-xs text-gold inline-flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3 w-3" /> Track
          </button>
        </div>
        <ShipmentTracker />
        <AddShipmentSheet open={shipOpen} onOpenChange={setShipOpen} />
      </section>

      {archived.length > 0 && (
        <details className="card-elevated p-4">
          <summary className="cursor-pointer label-mono text-xs text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <ul className="mt-3 space-y-1.5">
            {archived.map((m) => (
              <li key={m.id} className="text-xs text-muted-foreground flex items-center justify-between">
                <span className="truncate">{m.display_name}</span>
                <span className="text-[10px]">{m.end_date ?? ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <MedicationDisclaimer />

      <MedicationAddSheet
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setEditing(undefined);
        }}
        initialEdit={editing}
      />
    </div>
  );
}

function SupplyMeter({ med }: { med: UserMedication }) {
  const remaining = med.supply_remaining ?? 0;
  const threshold = med.low_supply_threshold || 7;
  const unit = med.supply_unit || "doses";
  const max = Math.max(remaining, threshold * 2, 1);
  const pct = Math.min(100, Math.max(0, (remaining / max) * 100));
  const isLow = remaining <= threshold;
  const isOut = remaining <= 0;

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={
            isOut
              ? "text-destructive font-medium"
              : isLow
                ? "text-gold"
                : "text-muted-foreground"
          }
        >
          {remaining} {unit} left
        </span>
        <span className="text-muted-foreground/60">alert at {threshold}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[color:var(--bg-sunken)] overflow-hidden">
        <div
          className={`h-full transition-all ${
            isOut ? "bg-destructive" : isLow ? "bg-gold" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AddShipmentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addShipment);
  const [val, setVal] = useState<ShipmentFormValue>({
    enabled: true,
    carrier: "USPS",
    tracking_number: "",
  });

  const mut = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          carrier: val.carrier,
          tracking_number: val.tracking_number.trim(),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-shipments"] });
      toast.success("Tracking added.");
      onOpenChange(false);
      setVal({ enabled: true, carrier: "USPS", tracking_number: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-raised border-border max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Track a shipment</SheetTitle>
        </SheetHeader>
        <div className="pt-4 space-y-4">
          <ShipmentForm value={val} onChange={setVal} />
          <button
            type="button"
            disabled={!val.tracking_number.trim() || mut.isPending}
            onClick={() => {
              haptic("medium");
              mut.mutate();
            }}
            className="w-full h-11 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50"
          >
            {mut.isPending ? "Adding…" : "Add tracking"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            We poll your carrier and notify you when status changes.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
