import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "coach"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Not authorized.");
}

const SendSchema = z.object({
  recipientUserId: z.string().uuid(),
  kind: z.enum(["upsell_1m", "upsell_2m", "check_in", "custom"]),
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  cta_label: z.string().max(40).optional().nullable(),
  cta_url: z.string().max(500).optional().nullable(),
});

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("admin_messages").insert({
      recipient_user_id: data.recipientUserId,
      sender_user_id: context.userId,
      kind: data.kind,
      subject: data.subject.trim(),
      body: data.body.trim(),
      cta_label: data.cta_label?.trim() || null,
      cta_url: data.cta_url?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListMessagesForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("admin_messages")
      .select("id, kind, subject, body, cta_label, cta_url, read_at, dismissed_at, created_at")
      .eq("recipient_user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });
