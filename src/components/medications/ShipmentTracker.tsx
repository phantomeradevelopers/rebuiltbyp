import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Truck, RefreshCw, X, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { listShipments, refreshShipment, removeShipment, type Shipment } from "@/lib/shipments.functions";

const STATUS_LABEL: Record<Shipment["status"], string> = {
  pending: "Label created",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Issue",
  unknown: "Checking…",
};

const STATUS_COLOR: Record<Shipment["status"], string> = {
  pending: "text-muted-foreground border-border bg-[color:var(--bg-sunken)]",
  in_transit: "text-primary border-primary/40 bg-primary/5",
  out_for_delivery: "text-gold border-gold/40 bg-gold/5",
  delivered: "text-green-500 border-green-500/40 bg-green-500/5",
  exception: "text-destructive border-destructive/40 bg-destructive/5",
  unknown: "text-muted-foreground border-border bg-[color:var(--bg-sunken)]",
};

function StatusIcon({ status }: { status: Shipment["status"] }) {
  if (status === "delivered") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "exception") return <AlertCircle className="h-3 w-3" />;
  if (status === "out_for_delivery") return <Truck className="h-3 w-3" />;
  return <Package className="h-3 w-3" />;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ShipmentTracker() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShipments);
  const refreshFn = useServerFn(refreshShipment);
  const removeFn = useServerFn(removeShipment);
  const q = useQuery({ queryKey: ["med-shipments"], queryFn: () => listFn() });

  const refresh = useMutation({
    mutationFn: (id: string) => refreshFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["med-shipments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-shipments"] });
      toast.success("Removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ships = q.data ?? [];
  if (ships.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="label-mono text-xs uppercase tracking-wide font-semibold text-primary flex items-center gap-1.5">
        <Truck className="h-3 w-3" /> Shipments
      </p>
      {ships.map((s) => (
        <article key={s.id} className="card-elevated p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s.status]}`}>
                <StatusIcon status={s.status} /> {STATUS_LABEL[s.status]}
              </div>
              <p className="text-sm mt-1.5 font-mono text-foreground/80">{s.carrier} · {s.tracking_number}</p>
              {s.last_event_description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.last_event_description}
                  {s.last_event_at && <span className="text-foreground/40"> · {timeAgo(s.last_event_at)}</span>}
                </p>
              )}
              {s.estimated_delivery && s.status !== "delivered" && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Est. delivery {new Date(s.estimated_delivery).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => refresh.mutate(s.id)}
                disabled={refresh.isPending}
                aria-label="Refresh"
                className="h-9 w-9 rounded-md border border-border text-foreground/60 hover:text-foreground"
              ><RefreshCw className={`h-3.5 w-3.5 mx-auto ${refresh.isPending ? "animate-spin" : ""}`} /></button>
              <button
                onClick={() => remove.mutate(s.id)}
                aria-label="Remove"
                className="h-9 w-9 rounded-md border border-border text-foreground/60 hover:text-destructive hover:border-destructive/40"
              ><X className="h-3.5 w-3.5 mx-auto" /></button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
