import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fields the coach is allowed to edit without confirmation
const AUTO_FIELDS = new Set([
  "restaurants",
  "grocery_stores",
  "foods_liked",
  "foods_avoided",
  "sweet_tooth",
  "organic_preference",
  "cooking_willingness",
  "cooking_minutes_per_day",
  "taste_profile",
  "location",
]);

// Fields that require explicit user confirmation
const CONFIRM_FIELDS = new Set([
  "goals",
  "physique_focus",
  "dietary_pattern",
  "gender",
  "success_metric",
  "height_cm",
  "weight_kg",
  "first_name",
]);

const Schema = z.object({
  field: z.string().min(1).max(60),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string()), z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))]),
  confirmed: z.boolean().optional(),
});

type ProfileValue = z.infer<typeof Schema>["value"];

export const updateProfileFromCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data, context }): Promise<{ status: "updated" | "needs_confirmation"; field: string; value: ProfileValue }> => {
    const { supabase, userId } = context;
    const field = data.field;
    const auto = AUTO_FIELDS.has(field);
    const needsConfirm = CONFIRM_FIELDS.has(field);
    if (!auto && !needsConfirm) {
      throw new Error(`Field "${field}" is not editable from the coach.`);
    }
    if (needsConfirm && !data.confirmed) {
      return { status: "needs_confirmation", field, value: data.value };
    }
    const { error } = await supabase
      .from("user_profile")
      .update({ [field]: data.value as never })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { status: "updated", field, value: data.value };
  });
