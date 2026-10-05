import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = x.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // days since Monday
  x.setUTCDate(x.getUTCDate() - diff);
  return x.toISOString().slice(0, 10);
}

export const generateWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const weekStart = mondayOf(new Date());
    const startDate = weekStart;
    const endDate = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const [checkins, food, mindset, readiness, journals] = await Promise.all([
      supabase.from("daily_checkins").select("date, mood, energy, sleep_hours, stress, workout_completed")
        .eq("user_id", userId).gte("date", startDate).lt("date", endDate),
      supabase.from("food_log").select("date, calories, protein_g")
        .eq("user_id", userId).gte("date", startDate).lt("date", endDate),
      supabase.from("mindset_logs").select("date, rep_type, state, completed_at")
        .eq("user_id", userId).gte("date", startDate).lt("date", endDate),
      supabase.from("readiness_checkins").select("day_date, score")
        .eq("user_id", userId).gte("day_date", startDate).lt("day_date", endDate),
      supabase.from("voice_journals").select("created_at, summary, emotion_tags")
        .eq("user_id", userId).gte("created_at", `${startDate}T00:00:00Z`).order("created_at", { ascending: true }),
    ]);

    const c = checkins.data ?? [];
    const f = food.data ?? [];
    const m = mindset.data ?? [];
    const r = readiness.data ?? [];
    const j = journals.data ?? [];

    const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
    const workouts = c.filter((x) => x.workout_completed).length;
    const mindsetReps = m.filter((x) => x.completed_at).length;
    const totalCals = f.reduce((s, x) => s + (x.calories ?? 0), 0);
    const totalProtein = f.reduce((s, x) => s + (x.protein_g ?? 0), 0);
    const stats = {
      week_start: weekStart,
      checkins: c.length,
      workouts,
      mindset_reps: mindsetReps,
      avg_mood: avg(c.map((x) => x.mood ?? 0).filter((v) => v > 0)),
      avg_energy: avg(c.map((x) => x.energy ?? 0).filter((v) => v > 0)),
      avg_sleep: avg(c.map((x) => Number(x.sleep_hours) || 0).filter((v) => v > 0)),
      avg_readiness: avg(r.map((x) => x.score ?? 0).filter((v) => v > 0)),
      total_calories: totalCals,
      total_protein_g: totalProtein,
      journal_count: j.length,
      top_emotions: Array.from(new Set(j.flatMap((x) => (x.emotion_tags ?? []) as string[]))).slice(0, 5),
    };

    let ai_summary = "";
    let one_thing = "";
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const SYSTEM = `You write weekly reviews for REBUILT, Playboy P's app. Tone: direct, warm, no fluff. Output strict JSON: {"summary":"<3-4 sentences reflecting on the week, talking TO the user (you/your)>", "one_thing":"<single concrete focus for next week, max 18 words>"}.`;
      const userPayload = `This week's stats:\n${JSON.stringify(stats, null, 2)}\n\nRecent journals (summaries):\n${j.slice(-5).map((x) => `- ${x.summary}`).join("\n") || "(none)"}`;
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: userPayload },
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
          }),
        });
        if (res && res.ok) {
          const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const parsed = JSON.parse((body.choices?.[0]?.message?.content ?? "{}").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
          if (typeof parsed.summary === "string") ai_summary = parsed.summary.slice(0, 1500);
          if (typeof parsed.one_thing === "string") one_thing = parsed.one_thing.slice(0, 240);
        }
      } catch { /* ignore */ }
    }

    const { data: existing } = await supabase
      .from("weekly_reviews").select("id").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    if (existing?.id) {
      await supabase.from("weekly_reviews").update({ stats, ai_summary, one_thing, generated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("weekly_reviews").insert({ user_id: userId, week_start: weekStart, stats, ai_summary, one_thing });
    }
    return { week_start: weekStart, stats, ai_summary, one_thing };
  });

export const getLatestWeeklyReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("weekly_reviews")
      .select("week_start, stats, ai_summary, one_thing, generated_at")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { review: data };
  });
