import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { pickMindsetLine } from "./coach-p-quotes";
import type { MindsetIntensity } from "./mindset-intensity";


export type DailyQuote = { text: string; source: "ai" | "library" | "fallback" };

function todayISO2() {
  return new Date().toISOString().slice(0, 10);
}



function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locale: z.string().min(2).max(10).optional(),
});

function resolveDate(input?: { date?: string }) { return input?.date ?? todayISO2(); }

async function aiGenerate(
  track: "men" | "angels",
  name: string | null,
  goals: unknown,
  mood: number | null,
  intensity: MindsetIntensity,
  locale: string,
): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const goalsStr = Array.isArray(goals) ? (goals as unknown[]).join(", ") : "";
  const isAngels = track === "angels";
  const isEs = locale.toLowerCase().startsWith("es");
  const moodHint =
    mood !== null && mood <= 4
      ? isAngels
        ? " She's been low this week — meet her there, warm and steady, no rah-rah."
        : " He's been low this week — meet him there, no rah-rah."
      : "";

  const intensityGuide = intensity === "fire"
    ? (isAngels
      ? " INTENSITY: fire. Passionate, direct, strong AND warm. Sister-to-sister on fire. Never aggressive. Never condescending."
      : " INTENSITY: fire. Passionate, direct, high intensity. Never bro-hype, never fake-guru, never shaming.")
    : intensity === "calm"
      ? " INTENSITY: calm. Grounded, quiet, gentle certainty. Low volume, high truth."
      : " INTENSITY: balanced. Mostly calm, occasional fire when it fits.";

  const langGuide = isEs
    ? " WRITE IN SPANISH. Keep the fire in Spanish — do not translate literally; capture the feeling."
    : " WRITE IN ENGLISH.";

  const system = isAngels
    ? `You are Coach Grace — warm, wise, strong, plain-spoken. 8th-grade words. Faith-aware, never preachy. Sister-to-sister. No "queen", no "babe", no condescending sweetness.
Write ONE morning line. 1–2 sentences, max 30 words. Address her directly. No emojis. No hashtags. No quotation marks.${intensityGuide}${langGuide}
Tone reference (calm): "Strong is quiet. Show up anyway."
Tone reference (fire): "Rise, sister. Today has your name on it."`
    : `You are Playboy P — survivor, builder, coach. Calm, steady certainty. Plain words. Faith-aware, never preachy. No bro-talk. No shame.
Write ONE morning motivation. 1–2 sentences, max 30 words. Address him directly. No emojis. No hashtags. No quotation marks.${intensityGuide}${langGuide}
Tone reference (fire): "Get up. The old you doesn't get to vote today."`;
  const user = `Name: ${name ?? (isAngels ? "sister" : "brother")}. Goals: ${goalsStr || "rebuild"}.${moodHint}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: 120,
        temperature: intensity === "fire" ? 1.0 : 0.9,
      }),
    });
    if (!res || !res.ok) return null;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/^["']|["']$/g, "").slice(0, 280);
  } catch {
    return null;
  }
}


export const getDailyQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<DailyQuote> => {
    const { supabase, userId } = context;
    const today = resolveDate(data);

    // 1. Already delivered today? Return the same one.
    const { data: hist } = await supabase
      .from("user_content_history")
      .select("content_id, delivered_at")
      .eq("user_id", userId)
      .eq("content_type", "affirmation")
      .gte("delivered_at", `${today}T00:00:00Z`)
      .lte("delivered_at", `${today}T23:59:59Z`)
      .order("delivered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hist?.content_id) {
      const { data: existing } = await supabase
        .from("daily_affirmations")
        .select("content, category")
        .eq("id", hist.content_id)
        .maybeSingle();
      if (existing?.content) {
        return { text: existing.content, source: existing.category === "ai-generated" ? "ai" : "library" };
      }
    }

    // 2. Try AI generation
    const { data: profile } = await supabase
      .from("user_profile")
      .select("first_name, goals, track, mindset_intensity")
      .maybeSingle();
    const { data: recent } = await supabase
      .from("daily_checkins")
      .select("mood")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const track: "men" | "angels" =
      ((profile as { track?: string } | null)?.track === "angels" ? "angels" : "men");
    const rawIntensity = (profile as { mindset_intensity?: string } | null)?.mindset_intensity;
    const intensity: MindsetIntensity =
      rawIntensity === "calm" || rawIntensity === "fire" ? rawIntensity : "balanced";
    const locale = data.locale ?? "en";

    const aiText = await aiGenerate(
      track,
      profile?.first_name ?? null,
      profile?.goals ?? null,
      (recent?.mood as number | null) ?? null,
      intensity,
      locale,
    );


    if (aiText) {
      const { data: cached } = await supabase
        .from("daily_affirmations")
        .insert({ content: aiText, category: "ai-generated" })
        .select("id")
        .single();
      if (cached?.id) {
        await supabase.from("user_content_history").insert({
          user_id: userId,
          content_type: "affirmation",
          content_id: cached.id,
        });
      }
      return { text: aiText, source: "ai" };
    }

    // 3. Curated fallback pool — respects intensity + locale + track.
    const seed = `${userId}-${today}-${intensity}`;
    const line = pickMindsetLine({ track, intensity, locale, seed });
    return { text: line, source: "fallback" };

  });

