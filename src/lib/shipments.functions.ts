import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Shipment = {
  id: string;
  medication_id: string | null;
  carrier: string;
  tracking_number: string;
  status: "pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "unknown";
  last_event_at: string | null;
  last_event_description: string | null;
  estimated_delivery: string | null;
  notify_on_status: { in_transit?: boolean; out_for_delivery?: boolean; delivered?: boolean };
  provider: string;
  provider_tracker_id: string | null;
  created_at: string;
  updated_at: string;
};

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "OnTrac", "LaserShip"] as const;

const addSchema = z.object({
  medication_id: z.string().uuid().nullable().optional(),
  carrier: z.enum(CARRIERS),
  tracking_number: z.string().min(4).max(64).regex(/^[A-Za-z0-9\s-]+$/),
});

async function createEasypostTracker(carrier: string, tracking: string): Promise<{
  id: string | null;
  status: Shipment["status"];
  last_event_at: string | null;
  last_event_description: string | null;
  estimated_delivery: string | null;
}> {
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) return { id: null, status: "pending", last_event_at: null, last_event_description: null, estimated_delivery: null };
  try {
    const res = await fetch("https://api.easypost.com/v2/trackers", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tracker: { tracking_code: tracking.replace(/\s+/g, ""), carrier: carrier.toUpperCase() } }),
    });
    if (!res.ok) {
      console.warn("EasyPost tracker create failed", res.status);
      return { id: null, status: "pending", last_event_at: null, last_event_description: null, estimated_delivery: null };
    }
    const t = await res.json();
    return mapEasypost(t);
  } catch (e) {
    console.warn("EasyPost create error", (e as Error).message);
    return { id: null, status: "pending", last_event_at: null, last_event_description: null, estimated_delivery: null };
  }
}

export function mapEasypost(t: {
  id?: string;
  status?: string;
  est_delivery_date?: string | null;
  tracking_details?: Array<{ datetime?: string; message?: string; status?: string }>;
}): {
  id: string | null;
  status: Shipment["status"];
  last_event_at: string | null;
  last_event_description: string | null;
  estimated_delivery: string | null;
} {
  const statusMap: Record<string, Shipment["status"]> = {
    pre_transit: "pending",
    in_transit: "in_transit",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    available_for_pickup: "out_for_delivery",
    return_to_sender: "exception",
    failure: "exception",
    cancelled: "exception",
    error: "exception",
    unknown: "unknown",
  };
  const last = (t.tracking_details ?? [])[t.tracking_details ? t.tracking_details.length - 1 : 0];
  return {
    id: t.id ?? null,
    status: statusMap[t.status ?? "unknown"] ?? "unknown",
    last_event_at: last?.datetime ?? null,
    last_event_description: last?.message ?? null,
    estimated_delivery: t.est_delivery_date ?? null,
  };
}

export const listShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Shipment[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("medication_shipments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load shipments.");
    return (data ?? []) as unknown as Shipment[];
  });

export const addShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tracker = await createEasypostTracker(data.carrier, data.tracking_number);
    const { data: created, error } = await supabase
      .from("medication_shipments")
      .insert({
        user_id: userId,
        medication_id: data.medication_id ?? null,
        carrier: data.carrier,
        tracking_number: data.tracking_number.replace(/\s+/g, ""),
        status: tracker.status,
        last_event_at: tracker.last_event_at,
        last_event_description: tracker.last_event_description,
        estimated_delivery: tracker.estimated_delivery,
        provider: "easypost",
        provider_tracker_id: tracker.id,
        last_polled_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) {
      if (error?.code === "23505") throw new Error("That tracking number is already being tracked.");
      throw new Error("Could not save shipment.");
    }
    return { id: created.id };
  });

export const removeShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("medication_shipments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Could not remove shipment.");
    return { ok: true };
  });

export const refreshShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("medication_shipments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !row) throw new Error("Shipment not found.");
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) throw new Error("Tracking provider not configured yet.");
    const trackerId = row.provider_tracker_id as string | null;
    try {
      const url = trackerId
        ? `https://api.easypost.com/v2/trackers/${trackerId}`
        : `https://api.easypost.com/v2/trackers?tracking_code=${encodeURIComponent(row.tracking_number as string)}`;
      const res = await fetch(url, {
        headers: { Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64") },
      });
      if (!res.ok) throw new Error("Provider error");
      const j = await res.json();
      const t = Array.isArray(j.trackers) ? j.trackers[0] : j;
      const mapped = mapEasypost(t);
      await supabase
        .from("medication_shipments")
        .update({
          status: mapped.status,
          last_event_at: mapped.last_event_at,
          last_event_description: mapped.last_event_description,
          estimated_delivery: mapped.estimated_delivery,
          provider_tracker_id: mapped.id ?? trackerId,
          last_polled_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("user_id", userId);
      return { ok: true, status: mapped.status };
    } catch (e) {
      throw new Error("Could not refresh: " + (e as Error).message);
    }
  });
