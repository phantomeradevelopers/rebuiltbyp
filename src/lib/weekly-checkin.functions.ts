import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeeklyCheckinRow = {
  id: string;
  week_number: number;
  submitted_at: string;
  focus_feedback: Record<string, "bigger" | "same" | "smaller">;
  measurements: Record<string, number>;
  weight_kg: number | null;
  week_rating: number | null;
  notes: string | null;
};

export type WeeklyCheckinStatus = {
  isDue: boolean;
  daysSinceLast: number | null;
  currentWeek: number;
  physique_focus: string[];
  success_metric: {
    type: string;
    target_value?: number | null;
    target_unit?: string | null;
    body_part?: string | null;
    lift_name?: string | null;
  } | null;
  last: WeeklyCheckinRow | null;
  history: WeeklyCheckinRow[];
  weeklyStreak: number;
};

function weekNumberFromStart(startDate: string | null): number {
  if (!startDate) return 1;
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((today0.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

export const getWeeklyCheckinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeeklyCheckinStatus> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase
        .from("user_profile")
        .select("rebuilt_start_date, physique_focus, success_metric")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("weekly_checkins")
        .select("id, week_number, submitted_at, focus_feedback, measurements, weight_kg, week_rating, notes")
        .eq("user_id", userId)
        .order("week_number", { ascending: false })
        .limit(12),
    ]);

    const startDate = profile?.rebuilt_start_date ?? null;
    const currentWeek = weekNumberFromStart(startDate);
    const history = (rows ?? []) as unknown as WeeklyCheckinRow[];
    const last = history[0] ?? null;

    let daysSinceLast: number | null = null;
    if (last) {
      const d = new Date(last.submitted_at);
      daysSinceLast = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    }

    // Due window: Sunday is the canonical "reset day". We open the window
    // every Sunday once ≥7 days have passed since the last submission (or if
    // this is the very first one). Sun → Tue gives a 72-hour grace if the
    // user misses Sunday, so it never just disappears on them.
    const hasStart = !!startDate;
    const now = new Date();
    const dow = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue
    const inSundayWindow = dow === 0 || dow === 1 || dow === 2;
    const weekElapsed = last === null || (daysSinceLast !== null && daysSinceLast >= 6);
    const isDue = hasStart && weekElapsed && inSundayWindow;

    // Weekly streak: consecutive week numbers descending from currentWeek-1 (or last logged)
    let weeklyStreak = 0;
    const weeks = new Set(history.map((r) => r.week_number));
    let cur = last?.week_number ?? 0;
    while (cur > 0 && weeks.has(cur)) {
      weeklyStreak++;
      cur--;
    }

    return {
      isDue,
      daysSinceLast,
      currentWeek,
      physique_focus: ((profile?.physique_focus as string[] | null) ?? []),
      success_metric: (profile?.success_metric as WeeklyCheckinStatus["success_metric"]) ?? null,
      last,
      history,
      weeklyStreak,
    };
  });

const SubmitSchema = z.object({
  focus_feedback: z.record(z.string().max(40), z.enum(["bigger", "same", "smaller"])).default({}),
  measurements: z.record(z.string().max(40), z.number().min(0).max(500)).default({}),
  weight_kg: z.number().min(30).max(400).nullable().optional(),
  week_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const submitWeeklyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("user_profile")
      .select("first_name, rebuilt_start_date, physique_focus, success_metric, goal_progress_summary")
      .eq("user_id", userId)
      .maybeSingle();

    const startDate = profile?.rebuilt_start_date ?? null;
    const weekNumber = weekNumberFromStart(startDate);

    const { data: inserted, error } = await supabase
      .from("weekly_checkins")
      .insert({
        user_id: userId,
        week_number: weekNumber,
        focus_feedback: data.focus_feedback,
        measurements: data.measurements,
        weight_kg: data.weight_kg ?? null,
        week_rating: data.week_rating ?? null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("weekly_checkin insert", error);
      throw new Error("Could not save your check-in.");
    }

    // Update rolling summary on profile
    const focus = ((profile?.physique_focus as string[] | null) ?? []);
    const trendNote = Object.entries(data.focus_feedback)
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    const summary = {
      last_week_number: weekNumber,
      last_submitted_at: new Date().toISOString(),
      last_rating: data.week_rating ?? null,
      last_weight_kg: data.weight_kg ?? null,
      last_focus_trend: trendNote,
    };
    await supabase
      .from("user_profile")
      .update({ goal_progress_summary: summary as never })
      .eq("user_id", userId);

    // Generate P's response and seed it into the user's coach conversation
    try {
      const first = profile?.first_name?.trim() || "brother";
      const focusList = focus.length ? focus.map((f) => f.replace(/_/g, " ")).join(" + ") : "your goals";
      const positives = Object.entries(data.focus_feedback).filter(([, v]) => v === "bigger").map(([k]) => k.replace(/_/g, " "));
      const negatives = Object.entries(data.focus_feedback).filter(([, v]) => v === "smaller").map(([k]) => k.replace(/_/g, " "));
      const rating = data.week_rating ?? null;
      const wt = data.weight_kg ?? null;

      const lines: string[] = [];
      lines.push(`Week ${weekNumber} logged, ${first}.`);
      if (positives.length) lines.push(`Moving on ${positives.join(", ")} — that's the signal we want. Hold the work.`);
      if (negatives.length) lines.push(`${negatives.join(", ")} feels off — not panic, data. We adjust next block.`);
      if (rating !== null) {
        if (rating >= 8) lines.push(`A ${rating}/10 week. Stay there.`);
        else if (rating <= 4) lines.push(`A ${rating}/10. One thing this week: pick the smallest move and stack it. Sleep, water, protein, walk.`);
      }
      if (wt !== null) lines.push(`Weight logged at ${wt}kg.`);
      lines.push(`Focus on ${focusList}. Run today's session. Talk to me when you need to.`);
      const welcome = lines.join(" ");

      const { data: convo, error: cErr } = await supabase
        .from("ai_coach_conversations")
        .select("id")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let conversationId = convo?.id as string | undefined;
      if (cErr || !conversationId) {
        const { data: created } = await supabase
          .from("ai_coach_conversations")
          .insert({ user_id: userId, title: `Week ${weekNumber} check-in` })
          .select("id")
          .single();
        conversationId = created?.id as string | undefined;
      }
      if (conversationId) {
        await supabase.from("ai_coach_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: welcome,
        });
        await supabase
          .from("ai_coach_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    } catch (e) {
      console.warn("weekly checkin coach reply seed failed", e);
    }

    return { ok: true as const, id: inserted.id as string, weekNumber };
  });
