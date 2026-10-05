import { useState } from "react";
import { Truck } from "lucide-react";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "OnTrac", "LaserShip"] as const;

export type ShipmentFormValue = {
  enabled: boolean;
  carrier: typeof CARRIERS[number];
  tracking_number: string;
};

export function ShipmentForm({
  value,
  onChange,
}: {
  value: ShipmentFormValue;
  onChange: (v: ShipmentFormValue) => void;
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="mt-1 h-4 w-4"
        />
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-gold" /> Track shipment from CandyRx
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Get notified when your order ships, is out for delivery, and arrives. Paste from your CandyRx shipping email.
          </p>
        </div>
      </label>

      {value.enabled && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <label className="block space-y-1 col-span-1">
            <span className="label-mono text-[11px] text-muted-foreground">Carrier</span>
            <select
              className="w-full h-10 px-2 rounded-md border border-border bg-background text-sm"
              value={value.carrier}
              onChange={(e) => onChange({ ...value, carrier: e.target.value as ShipmentFormValue["carrier"] })}
            >
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block space-y-1 col-span-2">
            <span className="label-mono text-[11px] text-muted-foreground">Tracking number</span>
            <input
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm font-mono"
              value={value.tracking_number}
              onChange={(e) => onChange({ ...value, tracking_number: e.target.value })}
              placeholder="9400 1000 0000 0000 0000 00"
              maxLength={64}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function useShipmentFormValue(initial?: Partial<ShipmentFormValue>) {
  return useState<ShipmentFormValue>({
    enabled: initial?.enabled ?? false,
    carrier: initial?.carrier ?? "USPS",
    tracking_number: initial?.tracking_number ?? "",
  });
}
