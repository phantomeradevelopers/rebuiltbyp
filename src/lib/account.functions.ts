import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USER_TABLES = [
  "user_profile",
  "daily_checkins",
  "food_log",
  "weight_log",
  "mindset_logs",
  "progress_photos",
  "readiness_checkins",
  "voice_journals",
  "weekly_reviews",
  "weekly_checkins",
  "identity_contracts",
  "legal_acceptances",
  "user_plans",
  "user_achievements",
  "user_content_history",
  "user_food_bookmarks",
  "ai_coach_conversations",
  "plan_refinements",
  "push_subscriptions",
  "notification_queue",
  "consult_waitlist",
  "consult_subscription",
  "meal_reminder_profile",
  "daily_training_mode",
  "client_errors",
] as const;

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const out: Record<string, unknown> = {};
    out["exported_at"] = new Date().toISOString();
    out["user_id"] = userId;
    for (const table of USER_TABLES) {
      const { data } = await supabase.from(table).select("*").eq("user_id", userId);
      out[table] = data ?? [];
    }
    const convos = (out["ai_coach_conversations"] as { id: string }[]) ?? [];
    if (convos.length) {
      const ids = convos.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("ai_coach_messages")
        .select("*")
        .in("conversation_id", ids);
      out["ai_coach_messages"] = msgs ?? [];
    } else {
      out["ai_coach_messages"] = [];
    }
    return { json: JSON.stringify(out) };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "DELETE") throw new Error("Type DELETE to confirm.");
    return input;
  })
  .handler(async ({ context }) => {
    const { userId } = context;
    // Wipe rows in user-owned tables
    for (const table of USER_TABLES) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
    }
    // Storage: progress-photos + voice-journals folders by user id
    for (const bucket of ["progress-photos", "voice-journals"] as const) {
      const { data: list } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId, { limit: 1000 });
      const paths = (list ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length) await supabaseAdmin.storage.from(bucket).remove(paths);
    }
    // Finally, remove the auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
