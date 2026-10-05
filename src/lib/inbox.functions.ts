import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const listMyAdminMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Auto-mark automated (self-sent) messages older than 48h as read,
    // so old nudges stop pretending to be unread.
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    try {
      await supabaseAdmin
        .from("admin_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", context.userId)
        .is("read_at", null)
        .lte("created_at", cutoff)
        .filter("sender_user_id", "eq", context.userId);
    } catch { /* non-fatal */ }

    const { data, error } = await supabaseAdmin
      .from("admin_messages")
      .select("id, kind, subject, body, cta_label, cta_url, read_at, dismissed_at, created_at, sender_user_id, recipient_user_id")
      .eq("recipient_user_id", context.userId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
