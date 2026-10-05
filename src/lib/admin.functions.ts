import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: ReturnType<typeof supabaseAdmin extends infer T ? () => T : never> | typeof supabaseAdmin, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "coach"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Not authorized.");
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("user_profile")
      .select("user_id, first_name, email, location, onboarding_completed_at, rebuilt_start_date, goals")
      .order("rebuilt_start_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { clients: data ?? [] };
  });

export const getClientBriefing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(supabaseAdmin, context.userId);
    const cid = data.clientId;
    const [profileRes, checkinsRes, foodRes, suggestionsRes, notesRes] = await Promise.all([
      supabaseAdmin.from("user_profile").select("*").eq("user_id", cid).maybeSingle(),
      supabaseAdmin.from("daily_checkins").select("date, mood, energy, sleep_hours, stress, workout_completed").eq("user_id", cid).order("date", { ascending: false }).limit(14),
      supabaseAdmin.from("food_log").select("date, meal, name, calories, protein_g").eq("user_id", cid).order("logged_at", { ascending: false }).limit(30),
      supabaseAdmin.from("nutrition_suggestions").select("*").eq("user_id", cid).is("dismissed_at", null).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("client_notes").select("id, body, created_at, author_user_id").eq("client_user_id", cid).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    return {
      profile: profileRes.data,
      checkins: checkinsRes.data ?? [],
      food: foodRes.data ?? [],
      suggestions: suggestionsRes.data ?? [],
      notes: notesRes.data ?? [],
    };
  });

export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(supabaseAdmin, context.userId);
    const body = data.body.trim();
    if (!body) throw new Error("Empty note.");
    const { error } = await supabaseAdmin
      .from("client_notes")
      .insert({ client_user_id: data.clientId, author_user_id: context.userId, body: body.slice(0, 4000) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "coach"]);
    return { isAdmin: (data?.length ?? 0) > 0 };
  });
