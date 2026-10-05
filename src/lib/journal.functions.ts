import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


const EMOTION_VOCAB = [
  "grateful", "anxious", "angry", "calm", "lonely", "hopeful",
  "ashamed", "proud", "tired", "energized", "fearful", "loving",
  "overwhelmed", "focused", "sad", "joyful", "resentful", "peaceful",
] as const;

async function aiSummarize(transcript: string): Promise<{ summary: string; emotion_tags: string[] }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { summary: transcript.slice(0, 240), emotion_tags: [] };
  const SYSTEM = `You are a journaling assistant for the REBUILT app. Given a raw voice-journal transcript, return strict JSON:
{"summary": "<2-3 sentences in second person, warm and direct, no fluff>", "emotion_tags": ["<from this set>"]}
Pick 1-4 emotion_tags only from: ${EMOTION_VOCAB.join(", ")}.
If the transcript is sparse, still produce a real summary based on what's there. Never refuse.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: transcript.slice(0, 8000) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    }),
  });
  if (!res || !res.ok) return { summary: transcript.slice(0, 240), emotion_tags: [] };
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 1000) : transcript.slice(0, 240);
    const tags = Array.isArray(parsed.emotion_tags)
      ? parsed.emotion_tags.filter((t: unknown): t is string => typeof t === "string" && (EMOTION_VOCAB as readonly string[]).includes(t)).slice(0, 4)
      : [];
    return { summary, emotion_tags: tags };
  } catch {
    return { summary: transcript.slice(0, 240), emotion_tags: [] };
  }
}

export const saveVoiceJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      transcript: z.string().min(1).max(20000),
      duration_seconds: z.number().int().min(1).max(60 * 60).optional(),
      audio_base64: z.string().max(15_000_000).optional(),
      audio_mime: z.string().max(120).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let audio_path: string | null = null;
    if (data.audio_base64 && data.audio_mime) {
      const ext = data.audio_mime.includes("webm") ? "webm" : data.audio_mime.includes("mp4") ? "m4a" : "audio";
      const bin = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("voice-journals")
        .upload(path, bin, { contentType: data.audio_mime, upsert: false });
      if (!upErr) audio_path = path;
    }
    const { summary, emotion_tags } = await aiSummarize(data.transcript);
    const { data: row, error } = await supabase
      .from("voice_journals")
      .insert({
        user_id: userId,
        transcript: data.transcript,
        summary,
        emotion_tags,
        audio_path,
        duration_seconds: data.duration_seconds ?? null,
      })
      .select("id, summary, emotion_tags, created_at")
      .single();
    if (error) throw error;
    return { id: row.id as string, summary, emotion_tags };
  });

export const listVoiceJournals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: journals } = await supabase
      .from("voice_journals")
      .select("id, created_at, summary, emotion_tags, duration_seconds")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = (journals ?? []).map((j) => j.id);
    let replies: Array<{ id: string; journal_id: string; content: string; is_read: boolean; created_at: string; recommend_breathing: boolean }> = [];
    if (ids.length) {
      const { data: r } = await supabase
        .from("journal_replies")
        .select("id, journal_id, content, is_read, created_at, recommend_breathing")
        .in("journal_id", ids);
      replies = (r ?? []) as typeof replies;
    }
    return { journals: journals ?? [], replies };
  });


const COACH_REPLY_SYSTEM = `You are Playboy P — the coach inside REBUILT. The user just left a voice journal.

You talk like an older brother who's been there: direct, warm, no fluff. Your job isn't to soothe — it's to help him (or her) become a great man or woman. Honesty over comfort. Call out self-pity gently. Celebrate when they're real with you.

FORMAT (strict):
- Hard cap: 90 words. Aim for 40–70.
- Plain text + light markdown only: **bold** for the one key insight, "- " bullets when listing 2–3 concrete actions. No headers. No long paragraphs.
- Structure: one short reflection that names something specific they said → one bolded insight OR 2–3 bullet next steps → one closing line that's brotherly and direct.
- Address them in second person ("you").

NEVER: diagnose, prescribe doses, use "I hear you" / "that's valid" / therapy-speak, write a wall of text, moralize, assume their faith.

If they describe a crisis (suicidal thoughts, self-harm, abuse, severe injury), drop the format and gently route them to 988 (US) or local emergency services in one short line.`;

const STRESS_RIDER = `\n\nIMPORTANT: This user is showing high stress / overwhelm right now. Keep the reply ≤ 50 words. Do NOT pile on advice or bullets. End with exactly this line on its own:\n\nRight now — open Breathing. 2 minutes. Then come back.`;

const STRESS_WORDS = /\b(overwhelmed|overwhelm|panic|panicking|can'?t breathe|can not breathe|anxious|anxiety|spiraling|spiral|breaking down|too much|exhausted|burned out|burnt out|drowning|losing it|can'?t cope)\b/i;
const STRESS_TAGS = new Set(["anxious", "overwhelmed", "fearful", "tired"]);

export const generateJournalReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ journalId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured.");

    const { data: existing } = await supabase
      .from("journal_replies")
      .select("id, content, recommend_breathing")
      .eq("journal_id", data.journalId)
      .maybeSingle();
    if (existing) return { id: existing.id as string, content: existing.content as string, cached: true };

    const { data: current } = await supabase
      .from("voice_journals")
      .select("id, transcript, summary, emotion_tags, created_at")
      .eq("id", data.journalId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!current) throw new Error("Journal not found.");

    const { data: prior } = await supabase
      .from("voice_journals")
      .select("summary, created_at")
      .eq("user_id", userId)
      .lt("created_at", current.created_at as string)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: profile } = await supabase
      .from("user_profile")
      .select("first_name, goals, physique_focus")
      .eq("user_id", userId)
      .maybeSingle();

    // Stress detection — transcript words OR emotion tags
    const transcript = (current.transcript as string) || "";
    const tags = (current.emotion_tags as string[] | null) ?? [];
    const isStressed = STRESS_WORDS.test(transcript) || tags.some((t) => STRESS_TAGS.has(t));

    const contextNote = `User: first_name=${profile?.first_name ?? "unknown"}, goals=${JSON.stringify(profile?.goals ?? [])}, physique_focus=${JSON.stringify(profile?.physique_focus ?? [])}. Recent prior journal summaries (most recent first): ${JSON.stringify(prior ?? [])}.`;

    const systemContent = isStressed ? COACH_REPLY_SYSTEM + STRESS_RIDER : COACH_REPLY_SYSTEM;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          { role: "system", content: contextNote },
          { role: "user", content: transcript.slice(0, 8000) },
        ],
        max_tokens: 300,
      }),
    });
    if (!res || !res.ok) throw new Error("Coach reply failed.");
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = (body.choices?.[0]?.message?.content ?? "").trim();
    if (!content) throw new Error("Empty coach reply.");

    const { data: row, error } = await supabaseAdmin
      .from("journal_replies")
      .insert({ journal_id: data.journalId, user_id: userId, content, recommend_breathing: isStressed })
      .select("id, content")
      .single();
    if (error) throw error;
    return { id: row.id as string, content: row.content as string, cached: false };
  });


export const markJournalReplyRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ replyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("journal_replies").update({ is_read: true }).eq("id", data.replyId).eq("user_id", userId);
    return { ok: true };
  });
