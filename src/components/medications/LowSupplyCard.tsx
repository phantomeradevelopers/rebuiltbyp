import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLowSupplyMedications,
  setMedicationSupply,
  type LowSupplyAlert,
} from "@/lib/medications.functions";
import { haptic } from "@/lib/haptics";

const SEVERITY_STYLE: Record<LowSupplyAlert["severity"], { ring: string; chip: string; label: string }> = {
  out: {
    ring: "border-destructive/50 bg-destructive/10",
    chip: "bg-destructive/20 text-destructive",
    label: "Out",
  },
  critical: {
    ring: "border-destructive/40 bg-destructive/5",
    chip: "bg-destructive/15 text-destructive",
    label: "Critical",
  },
  low: {
    ring: "border-gold/40 bg-gold/5",
    chip: "bg-gold/15 text-gold",
    label: "Low",
  },
};

export function LowSupplyCard() {
  const qc = useQueryClient();
  const fetchAlerts = useServerFn(getLowSupplyMedications);
  const updateSupply = useServerFn(setMedicationSupply);

  const { data: alerts } = useQuery({
    queryKey: ["med-low-supply"],
    queryFn: () => fetchAlerts(),
    staleTime: 60_000,
  });

  const refillFn = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      updateSupply({ data: { id, supply_remaining: amount } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-low-supply"] });
      qc.invalidateQueries({ queryKey: ["user-medications"] });
      toast.success("Supply updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="label-mono text-destructive flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" /> Refill warnings
      </p>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {alerts.map((a, i) => (
            <SupplyAlertRow
              key={a.id}
              alert={a}
              index={i}
              busy={refillFn.isPending}
              onRefill={(amount) => {
                haptic("medium");
                refillFn.mutate({ id: a.id, amount });
              }}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function SupplyAlertRow({
  alert,
  index,
  onRefill,
  busy,
}: {
  alert: LowSupplyAlert;
  index: number;
  onRefill: (amount: number) => void;
  busy: boolean;
}) {
  const style = SEVERITY_STYLE[alert.severity];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>("30");
  const unit = alert.supply_unit || "doses";

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
      className={`rounded-xl border p-4 ${style.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-base truncate">{alert.display_name}</p>
            <span className={`label-mono text-[10px] px-1.5 py-0.5 rounded ${style.chip}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {alert.supply_remaining === 0
              ? `You're out. Reorder before your next dose.`
              : `${alert.supply_remaining} ${unit} left · alert at ${alert.low_supply_threshold}.`}
          </p>
        </div>
        <PackageCheck className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(value);
            if (!Number.isFinite(n) || n < 0) return;
            onRefill(n);
            setEditing(false);
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 w-20 rounded-md border border-border bg-background/40 px-2 text-sm"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-9 px-3 rounded-md text-xs text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-9 px-3 rounded-md bg-foreground text-background text-xs font-medium disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[15, 30, 60].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRefill(n)}
              disabled={busy}
              className="h-8 px-3 rounded-md border border-border bg-background/40 text-xs hover:bg-background/60 disabled:opacity-50"
            >
              +{n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-8 px-3 rounded-md border border-border bg-background/40 text-xs hover:bg-background/60 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Custom
          </button>
        </div>
      )}
    </motion.li>
  );
}
