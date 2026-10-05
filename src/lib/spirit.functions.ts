import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DailyAnchor = {
  id: string;
  anchor_date: string;
  tradition: string;
  theme: string;
  verse_ref: string | null;
  verse_text: string;
  reflection_prompt: string;
  breath_protocol: string;
};

export type AnchorReflection = {
  anchor_date: string;
  response: string | null;
  mood_before: number | null;
  mood_after: number | null;
  created_at: string;
};

function today() { return new Date().toISOString().slice(0, 10); }

const DateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveDate(input?: { date?: string }) { return input?.date ?? today(); }

export const getTodayAnchor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DateInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ anchor: DailyAnchor | null; reflection: AnchorReflection | null; tradition: string }> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("user_profile").select("tradition").eq("user_id", userId).maybeSingle();
    const tradition = (profile?.tradition ?? "secular") as string;
    const date = resolveDate(data);

    // Pick today's anchor for this tradition; fall back to most recent past or secular
    const { data: exact } = await supabase
      .from("daily_anchors").select("*")
      .eq("anchor_date", date).eq("tradition", tradition).maybeSingle();
    let anchor = exact as DailyAnchor | null;
    if (!anchor) {
      const { data: anyDay } = await supabase
        .from("daily_anchors").select("*")
        .eq("tradition", tradition)
        .lte("anchor_date", date)
        .order("anchor_date", { ascending: false }).limit(1).maybeSingle();
      anchor = (anyDay as DailyAnchor | null);
    }
    if (!anchor) {
      const { data: fallback } = await supabase
        .from("daily_anchors").select("*")
        .eq("tradition", "secular")
        .order("anchor_date", { ascending: false }).limit(1).maybeSingle();
      anchor = (fallback as DailyAnchor | null);
    }

    const { data: refl } = await supabase
      .from("anchor_reflections").select("anchor_date, response, mood_before, mood_after, created_at")
      .eq("user_id", userId).eq("anchor_date", date).maybeSingle();

    return { anchor, reflection: (refl as AnchorReflection | null) ?? null, tradition };
  });

export const saveReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      response: z.string().max(4000).optional(),
      mood_before: z.number().int().min(1).max(10).optional(),
      mood_after: z.number().int().min(1).max(10).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("anchor_reflections").upsert({
      user_id: userId,
      anchor_date: data.anchor_date,
      response: data.response ?? null,
      mood_before: data.mood_before ?? null,
      mood_after: data.mood_after ?? null,
    }, { onConflict: "user_id,anchor_date" });
    if (error) throw new Error("Could not save reflection.");

    // Mirror written reflections into the journal timeline so users have
    // one place to look back on their inner work. Best-effort — no throw.
    const text = (data.response ?? "").trim();
    if (text.length >= 3) {
      try {
        await supabase.from("voice_journals").insert({
          user_id: userId,
          transcript: text,
          summary: `Anchor reflection · ${data.anchor_date}`,
          emotion_tags: [],
        });
      } catch { /* non-fatal */ }
    }
    return { ok: true };
  });

export const TRADITION_VALUES = [
  "secular", "christian", "catholic", "islamic", "jewish", "hindu", "buddhist", "native_indigenous",
  "oceania_pacific", "african_traditional", "sufi", "sikh", "stoic", "custom",
] as const;
export type TraditionValue = typeof TRADITION_VALUES[number];

// Shared, ordered list of tradition options for UI pickers.
// Single source of truth — keep FaithModePrompt and /app/spirit aligned.
// "custom" is intentionally omitted (no setup flow).
export const TRADITIONS: ReadonlyArray<{ value: TraditionValue; label: string }> = [
  { value: "secular", label: "Secular" },
  { value: "christian", label: "Christian" },
  { value: "catholic", label: "Catholic" },
  { value: "islamic", label: "Islamic" },
  { value: "sufi", label: "Sufi" },
  { value: "jewish", label: "Jewish" },
  { value: "hindu", label: "Hindu" },
  { value: "buddhist", label: "Buddhist" },
  { value: "sikh", label: "Sikh" },
  { value: "native_indigenous", label: "Native" },
  { value: "oceania_pacific", label: "Oceania" },
  { value: "african_traditional", label: "African" },
  { value: "stoic", label: "Stoic" },
];

export const setTradition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tradition: z.enum(TRADITION_VALUES) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_profile").update({ tradition: data.tradition }).eq("user_id", userId);
    return { ok: true };
  });
