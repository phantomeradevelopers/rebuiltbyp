import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Coach Proposals — the user's coach proposes a change in chat; the user
 * confirms with a button; this server fn applies the change.
 *
 * Hard rules:
 *  - Every write is scoped to auth.uid().
 *  - Profile updates are field-allowlisted; auth, billing, role, and screener
 *    fields are NEVER touched here.
 *  - Every applied action gets a row in coach_actions for the chat history.
 */

// Profile fields the coach is allowed to write. Mirrors intake-form parity
// minus anything related to identity/auth/billing/role/screener.
const PROFILE_FIELDS = new Set([
  "first_name",
  "height_cm",
  "weight_kg",
  "gender",
  "dietary_pattern",
  "goals",
  "physique_focus",
  "success_metric",
  "primary_goal",
  "injuries",
  "taste_profile",
  "foods_liked",
  "foods_avoided",
  "restaurants",
  "grocery_stores",
  "cooking_willingness",
  "cooking_minutes_per_day",
  "sweet_tooth",
  "organic_preference",
  "location",
  "sleep_hours",
  "stress_level",
  "caffeine_per_day",
  "alcohol_per_week",
  "reminder_time_local",
  "reminder_time_midday_local",
  "reminder_time_evening_local",
  "daily_motivation_enabled",
  "notification_push",
  "notification_sms",
  "notification_email",
  "notify_medications",
]);

const scheduleConfigSchema = z.object({
  days_of_week: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(8).optional(),
  every_n_days: z.number().int().min(1).max(60).optional(),
  cycle_on: z.number().int().min(1).max(60).optional(),
  cycle_off: z.number().int().min(0).max(60).optional(),
}).default({});

const ProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("profile.update"),
    patch: z.record(z.string().min(1).max(60), z.unknown()),
    summary: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("medication.add"),
    display_name: z.string().min(1).max(120),
    catalog_id: z.string().uuid().nullable().optional(),
    dose_amount: z.number().min(0).max(10000).nullable().optional(),
    dose_unit: z.string().max(20).nullable().optional(),
    route: z.string().max(20).nullable().optional(),
    schedule_type: z.enum(["daily", "weekly_days", "every_n_days", "cycle", "as_needed"]),
    schedule_config: scheduleConfigSchema,
    source_tag: z.enum(["candyrx", "other"]).optional(),
    notes: z.string().max(500).nullable().optional(),
    summary: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("medication.archive"),
    medication_id: z.string().uuid(),
    summary: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("medication.edit"),
    medication_id: z.string().uuid(),
    patch: z.object({
      display_name: z.string().min(1).max(120).optional(),
      dose_amount: z.number().min(0).max(10000).nullable().optional(),
      dose_unit: z.string().max(20).nullable().optional(),
      route: z.string().max(20).nullable().optional(),
      schedule_type: z.enum(["daily", "weekly_days", "every_n_days", "cycle", "as_needed"]).optional(),
      schedule_config: scheduleConfigSchema.optional(),
      notes: z.string().max(500).nullable().optional(),
    }),
    summary: z.string().max(280).optional(),
  }),
  // One-tap action cards (Section 5): each performs the real action server-side.
  z.object({
    kind: z.literal("workout.swap_recovery"),
    note: z.string().max(280).optional(),
    summary: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("workout.mark_done"),
    summary: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal("plan.add_refinement"),
    target: z.enum(["fitness", "nutrition"]),
    request: z.string().min(3).max(500),
    summary: z.string().max(280).optional(),
  }),
]);


export type CoachProposal = z.infer<typeof ProposalSchema>;

const InputSchema = z.object({
  proposal: ProposalSchema,
  conversation_id: z.string().uuid().nullable().optional(),
  message_id: z.string().nullable().optional(), // free-form (local- ids from optimistic chat)
});

export const applyCoachProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = data.proposal;

    let summary = p.summary ?? "";
    let undoable = false;

    if (p.kind === "profile.update") {
      const cleanPatch: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(p.patch)) {
        if (!PROFILE_FIELDS.has(key)) continue;
        cleanPatch[key] = val;
      }
      if (Object.keys(cleanPatch).length === 0) {
        throw new Error("None of those fields are editable by the coach.");
      }
      const { error } = await supabase
        .from("user_profile")
        .update(cleanPatch as never)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      undoable = true;
      if (!summary) summary = `Updated ${Object.keys(cleanPatch).join(", ")}.`;
    } else if (p.kind === "medication.add") {
      const { error } = await supabase.from("user_medications").insert({
        user_id: userId,
        catalog_id: p.catalog_id ?? null,
        display_name: p.display_name,
        dose_amount: p.dose_amount ?? null,
        dose_unit: p.dose_unit ?? null,
        route: p.route ?? null,
        schedule_type: p.schedule_type,
        schedule_config: p.schedule_config,
        start_date: new Date().toISOString().slice(0, 10),
        source_tag: p.source_tag ?? "other",
        notes: p.notes ?? null,
        active: true,
        rx_acknowledged_at: new Date().toISOString(),
      } as never);
      if (error) throw new Error(error.message);
      if (!summary) summary = `Added ${p.display_name} to your protocol.`;
    } else if (p.kind === "medication.archive") {
      const { error } = await supabase
        .from("user_medications")
        .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
        .eq("id", p.medication_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      if (!summary) summary = "Archived medication.";
    } else if (p.kind === "medication.edit") {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p.patch)) {
        if (v !== undefined) patch[k] = v;
      }
      if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
      const { error } = await supabase
        .from("user_medications")
        .update(patch as never)
        .eq("id", p.medication_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      undoable = true;
      if (!summary) summary = "Updated medication.";
    } else if (p.kind === "workout.swap_recovery") {
      const today = new Date().toISOString().slice(0, 10);
      // Upsert today's training mode to recovery. UNIQUE(user_id,date) makes this idempotent.
      const { error } = await supabase
        .from("daily_training_mode")
        .upsert({
          user_id: userId,
          date: today,
          modality: "recovery",
          category: "recovery",
          equipment: [],
          notes: p.note ?? "Swapped to recovery via coach.",
        } as never, { onConflict: "user_id,date" });
      if (error) throw new Error(error.message);
      if (!summary) summary = "Swapped today for recovery.";
    } else if (p.kind === "workout.mark_done") {
      const today = new Date().toISOString().slice(0, 10);
      // Upsert today's check-in row with workout_completed=true. Don't clobber other fields.
      const { data: existing } = await supabase
        .from("daily_checkins")
        .select("id, workout_completed")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        if (!existing.workout_completed) {
          const { error } = await supabase
            .from("daily_checkins")
            .update({ workout_completed: true } as never)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
        }
      } else {
        const { error } = await supabase
          .from("daily_checkins")
          .insert({ user_id: userId, date: today, workout_completed: true } as never);
        if (error) throw new Error(error.message);
      }
      // Tick the workout streak via the same RPC tickStreak uses (idempotent on source_key).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("fn_tick_streak", {
          p_kind: "workout",
          p_day_local: today,
          p_grace_days: 1,
          p_source: `workout:${today}`,
        });
      } catch { /* non-fatal */ }

      if (!summary) summary = "Logged today's workout.";
    } else if (p.kind === "plan.add_refinement") {
      const { error } = await supabase
        .from("plan_refinements")
        .insert({
          user_id: userId,
          plan_type: p.target,
          changes: [{ source: "coach", request: p.request }],
        } as never);
      if (error) throw new Error(error.message);
      if (!summary) summary = `Queued for your ${p.target} plan. Open it and tap Refine.`;
    }


    // Audit row (best-effort; do not block on failure)
    try {
      await supabase.from("coach_actions").insert({
        user_id: userId,
        conversation_id: data.conversation_id ?? null,
        message_id: typeof data.message_id === "string" && data.message_id.length === 36 ? data.message_id : null,
        kind: p.kind,
        payload: p as unknown as Record<string, unknown>,
        status: "applied",
      } as never);
    } catch { /* non-fatal */ }

    return { ok: true as const, summary, undoable };
  });
