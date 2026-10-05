import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyState, generateMindsetLine, STATE_META, type MindsetState, type RepType } from "./mindset.server";

export type MindsetToday = {
  state: MindsetState;
  chip: string;
  title: string;
  prompt: string;
  repType: RepType;
  repTitle: string;
  repBlurb: string;
  completedAt: string | null;
  streak: number;
  hasCheckin: boolean;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveDate(input?: { date?: string }) {
  return input?.date ?? todayStr();
}

async function computeStreak(supabase: any, userId: string, targetDate = todayStr()): Promise<number> {
  const { data } = await supabase
    .from("mindset_logs")
    .select("date, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("date", { ascending: false })
    .limit(60);
  if (!data || data.length === 0) return 0;
  const dates = new Set<string>((data as Array<{ date: string }>).map((r) => r.date));
  let streak = 0;
  const cursor = new Date(targetDate + "T00:00:00Z");
  // allow today to count if completed; otherwise start from yesterday
  const today = targetDate;
  if (!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const k = cursor.toISOString().slice(0, 10);
    if (!dates.has(k)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function loadContext(supabase: any, userId: string, targetDate = todayStr()) {
  const [{ data: profile }, { data: checkin }] = await Promise.all([
    supabase.from("user_profile").select("first_name, goals").eq("user_id", userId).maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("date, mood, energy, stress")
      .eq("user_id", userId)
      .eq("date", targetDate)
      .maybeSingle(),
  ]);
  const goals = Array.isArray((profile as any)?.goals) ? ((profile as any).goals as string[]) : [];
  return {
    firstName: (profile as any)?.first_name ?? null,
    goals,
    checkin: checkin as { date: string; mood: number | null; energy: number | null; stress: number | null } | null,
  };
}

export const getTodayMindset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<MindsetToday> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const date = resolveDate(data);

    const { data: existing } = await supabase
      .from("mindset_logs")
      .select("state, prompt_text, rep_type, completed_at")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const ctx = await loadContext(supabase, userId, date);
    const hasCheckin = !!ctx.checkin && ctx.checkin.date === date;

    if (existing) {
      const state = existing.state as MindsetState;
      const meta = STATE_META[state] ?? STATE_META.SHARPEN;
      const streak = await computeStreak(supabase, userId, date);
      return {
        state,
        chip: meta.chip,
        title: meta.title,
        prompt: existing.prompt_text,
        repType: (existing.rep_type as RepType) ?? meta.repType,
        repTitle: meta.repTitle,
        repBlurb: meta.repBlurb,
        completedAt: existing.completed_at,
        streak,
        hasCheckin,
      };
    }

    const state = classifyState({
      mood: ctx.checkin?.mood ?? null,
      energy: ctx.checkin?.energy ?? null,
      stress: ctx.checkin?.stress ?? null,
    });
    const meta = STATE_META[state];
    const line = await generateMindsetLine(state, {
      firstName: ctx.firstName,
      goals: ctx.goals,
      weekNumber: null,
    });

    await supabase.from("mindset_logs").insert({
      user_id: userId,
      date,
      state,
      prompt_text: line,
      rep_type: meta.repType,
    });

    const streak = await computeStreak(supabase, userId, date);
    return {
      state,
      chip: meta.chip,
      title: meta.title,
      prompt: line,
      repType: meta.repType,
      repTitle: meta.repTitle,
      repBlurb: meta.repBlurb,
      completedAt: null,
      streak,
      hasCheckin,
    };
  });

export const regenerateMindset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<MindsetToday> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const date = resolveDate(data);
    const ctx = await loadContext(supabase, userId, date);
    const state = classifyState({
      mood: ctx.checkin?.mood ?? null,
      energy: ctx.checkin?.energy ?? null,
      stress: ctx.checkin?.stress ?? null,
    });
    const meta = STATE_META[state];
    const line = await generateMindsetLine(state, {
      firstName: ctx.firstName,
      goals: ctx.goals,
      weekNumber: null,
    });

    await supabase
      .from("mindset_logs")
      .upsert(
        {
          user_id: userId,
          date,
          state,
          prompt_text: line,
          rep_type: meta.repType,
        },
        { onConflict: "user_id,date" },
      );

    const { data: row } = await supabase
      .from("mindset_logs")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    const streak = await computeStreak(supabase, userId, date);
    return {
      state,
      chip: meta.chip,
      title: meta.title,
      prompt: line,
      repType: meta.repType,
      repTitle: meta.repTitle,
      repBlurb: meta.repBlurb,
      completedAt: row?.completed_at ?? null,
      streak,
      hasCheckin: !!ctx.checkin && ctx.checkin.date === date,
    };
  });

export const completeMindsetRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ streak: number; completedAt: string }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const date = resolveDate(data);
    const now = new Date().toISOString();

    // Ensure a row exists (defensive — should already be created by getTodayMindset)
    const { data: existing } = await supabase
      .from("mindset_logs")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (!existing) {
      const ctx = await loadContext(supabase, userId, date);
      const state = classifyState({
        mood: ctx.checkin?.mood ?? null,
        energy: ctx.checkin?.energy ?? null,
        stress: ctx.checkin?.stress ?? null,
      });
      const meta = STATE_META[state];
      await supabase.from("mindset_logs").insert({
        user_id: userId,
        date,
        state,
        prompt_text: meta.fallback,
        rep_type: meta.repType,
        completed_at: now,
      });
    } else if (!existing.completed_at) {
      await supabase.from("mindset_logs").update({ completed_at: now }).eq("id", existing.id);
    }

    const streak = await computeStreak(supabase, userId, date);
    return { streak, completedAt: now };
  });
