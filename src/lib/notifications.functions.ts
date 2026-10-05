import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboxItem = {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  scheduled_for: string;
  status: string;
  read_at: string | null;
};

export type ReminderFrequency = "off" | "gentle" | "balanced" | "frequent";

export type NotifPrefs = {
  daily_motivation_enabled: boolean;
  reminder_time_local: string; // HH:MM (morning)
  reminder_time_midday_local: string; // HH:MM
  reminder_time_evening_local: string; // HH:MM
  notification_push: boolean;
  notification_sms: boolean;
  notification_email: boolean;
  notify_medications: boolean;
  morning_delivery: "spaced" | "briefing";
  reminder_frequency: ReminderFrequency;
  phone_e164: string | null;
  first_name: string | null;
  email: string | null;
};

export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: InboxItem[]; unread: number }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_queue")
      .select("id, type, subject, body, scheduled_for, status, read_at")
      .eq("user_id", userId)
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load inbox.");
    const items = (data ?? []) as InboxItem[];
    const unread = items.filter((i) => !i.read_at).length;
    return { items, unread };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    let q = supabase.from("notification_queue").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    if (data.id) q = q.eq("id", data.id);
    const { error } = await q;
    if (error) throw new Error("Could not update.");
    return { ok: true as const };
  });

export const getNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotifPrefs> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_profile")
      .select("daily_motivation_enabled, reminder_time_local, reminder_time_midday_local, reminder_time_evening_local, notification_push, notification_sms, notification_email, notify_medications, morning_delivery, reminder_frequency, phone_e164, first_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) throw new Error("Could not load preferences.");
    const rf = ((data as { reminder_frequency?: string }).reminder_frequency ?? "balanced") as ReminderFrequency;
    return {
      daily_motivation_enabled: data.daily_motivation_enabled,
      reminder_time_local: (data.reminder_time_local as string).slice(0, 5),
      reminder_time_midday_local: (data.reminder_time_midday_local as string).slice(0, 5),
      reminder_time_evening_local: (data.reminder_time_evening_local as string).slice(0, 5),
      notification_push: data.notification_push,
      notification_sms: data.notification_sms,
      notification_email: data.notification_email,
      notify_medications: data.notify_medications ?? true,
      morning_delivery: ((data as { morning_delivery?: string }).morning_delivery === "briefing" ? "briefing" : "spaced"),
      reminder_frequency: (["off","gentle","balanced","frequent"] as const).includes(rf as never) ? rf : "balanced",
      phone_e164: data.phone_e164,
      first_name: data.first_name,
      email: data.email,
    };
  });

export const updateNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      daily_motivation_enabled: z.boolean(),
      reminder_time_local: z.string().regex(/^\d{2}:\d{2}$/),
      reminder_time_midday_local: z.string().regex(/^\d{2}:\d{2}$/),
      reminder_time_evening_local: z.string().regex(/^\d{2}:\d{2}$/),
      notification_push: z.boolean(),
      notification_sms: z.boolean(),
      notification_email: z.boolean(),
      notify_medications: z.boolean().optional(),
      morning_delivery: z.enum(["spaced", "briefing"]).optional(),
      reminder_frequency: z.enum(["off","gentle","balanced","frequent"]).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_profile").update({
      daily_motivation_enabled: data.daily_motivation_enabled,
      reminder_time_local: `${data.reminder_time_local}:00`,
      reminder_time_midday_local: `${data.reminder_time_midday_local}:00`,
      reminder_time_evening_local: `${data.reminder_time_evening_local}:00`,
      notification_push: data.notification_push,
      notification_sms: data.notification_sms,
      notification_email: data.notification_email,
      ...(data.notify_medications !== undefined ? { notify_medications: data.notify_medications } : {}),
      ...(data.morning_delivery !== undefined ? { morning_delivery: data.morning_delivery } : {}),
      ...(data.reminder_frequency !== undefined ? { reminder_frequency: data.reminder_frequency } : {}),
    }).eq("user_id", userId);
    if (error) throw new Error("Could not save preferences.");
    return { ok: true as const };
  });
