import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push.server";
import { wrapPublicHandler } from "@/lib/server-log";


// Runs hourly. For each user whose reminder_time_local hour matches the current UTC hour
// and who has daily_motivation_enabled, generate a fresh AI quote (Playboy P voice) tailored
// to their name + goals + recent state, with fallback to the static pool. Idempotent per day.

type ProfileLite = {
  user_id: string;
  first_name: string | null;
  goals: unknown;
  reminder_time_local: string;
};

type Slot = "morning" | "midday" | "evening";

async function generateAiQuote(p: ProfileLite, recentMood: number | null, slot: Slot): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const name = p.first_name ?? "there";
  const goals = Array.isArray(p.goals) ? (p.goals as unknown[]).join(", ") : "";
  const moodHint = recentMood !== null && recentMood <= 2
    ? " They've been struggling this week — meet them there, don't rah-rah."
    : "";
  const slotHint = slot === "morning"
    ? "Morning ignition — set the tone for the day."
    : slot === "midday"
      ? "Midday lift — brief check-in, course-correct."
      : "Afternoon close — steady reminder to keep momentum.";

  const system = `You are Playboy P — survivor, builder, coach. Calm, steady certainty. Short. Plain words. Faith-aware, never preachy. Never bro-talk. Never shame.
${slotHint}
Write ONE motivation for the person named below. 1–2 sentences, max 30 words total. Address them directly. No emojis. No hashtags. No quotation marks. End with a concrete next move they can do today if it fits naturally.`;
  const user = `Name: ${name}. Goals: ${goals || "rebuild"}.${moodHint}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 120,
        temperature: 0.9,
      }),
    });
    if (!res || !res.ok) {
      if (res) console.error("ai quote gen", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/^["']|["']$/g, "").slice(0, 280);
  } catch (e) {
    console.error("ai quote gen exception", e);
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/daily-enqueue")({
  server: {
    handlers: {
      POST: wrapPublicHandler({ route: "hooks/daily-enqueue", id: "hooks/daily-enqueue", perMinute: 10, requireCron: true }, async () => {
        const now = new Date();
        const hour = now.getUTCHours();
        const today = now.toISOString().slice(0, 10);

        const { data: users, error: uErr } = await supabaseAdmin
          .from("user_profile")
          .select("user_id, reminder_time_local, reminder_time_midday_local, reminder_time_evening_local, first_name, rebuilt_access, daily_motivation_enabled, goals, morning_delivery")
          .eq("daily_motivation_enabled", true)
          .eq("rebuilt_access", true);
        if (uErr) return Response.json({ ok: false, error: uErr.message }, { status: 500 });

        // For each user, expand the three configured reminder times and check if any matches this hour
        type Target = { user: typeof users[number]; slot: Slot; slotHour: number };
        const targets: Target[] = [];
        for (const u of users ?? []) {
          const morningH = Number((u.reminder_time_local as string).slice(0, 2));
          const middayRaw = u.reminder_time_midday_local as string | null;
          const eveningRaw = u.reminder_time_evening_local as string | null;
          const middayH = middayRaw ? Number(middayRaw.slice(0, 2)) : (morningH + 3) % 24;
          const eveningH = eveningRaw ? Number(eveningRaw.slice(0, 2)) : (morningH + 6) % 24;
          const briefing = (u.morning_delivery as string | null) === "briefing";
          const slots: Array<[Slot, number]> = briefing
            ? [["morning", morningH % 24]]
            : [
                ["morning", morningH % 24],
                ["midday", middayH % 24],
                ["evening", eveningH % 24],
              ];
          for (const [slot, slotHour] of slots) {
            if (slotHour === hour) targets.push({ user: u, slot, slotHour });
          }
        }
        if (targets.length === 0) return Response.json({ ok: true, enqueued: 0 });

        const { data: affRows } = await supabaseAdmin
          .from("daily_affirmations").select("id, content");
        const aff = affRows ?? [];

        let enqueued = 0, aiUsed = 0, fallbackUsed = 0, pushed = 0, bufferSkipped = 0;

        for (const { user: u, slot, slotHour } of targets) {
          const dedupeType = `daily_motivation_${slot}`;
          // Idempotent per (user, slot, day)
          const { data: existing } = await supabaseAdmin
            .from("notification_queue")
            .select("id")
            .eq("user_id", u.user_id)
            .eq("type", dedupeType)
            .gte("scheduled_for", `${today}T00:00:00Z`)
            .lte("scheduled_for", `${today}T23:59:59Z`)
            .limit(1)
            .maybeSingle();
          if (existing) continue;

          // 10-minute buffer: never stack a motivation push on top of a
          // medication reminder (meds need ~10 min of user attention).
          const bufferStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
          const bufferEnd = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
          const { data: nearbyMed } = await supabaseAdmin
            .from("notification_queue")
            .select("id")
            .eq("user_id", u.user_id)
            .eq("type", "medication_dose")
            .gte("scheduled_for", bufferStart)
            .lte("scheduled_for", bufferEnd)
            .limit(1)
            .maybeSingle();
          if (nearbyMed) { bufferSkipped++; continue; }

          const { data: recent } = await supabaseAdmin
            .from("daily_checkins")
            .select("mood")
            .eq("user_id", u.user_id)
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();
          const recentMood = (recent?.mood as number | null) ?? null;

          let body: string | null = await generateAiQuote(
            {
              user_id: u.user_id,
              first_name: u.first_name as string | null,
              goals: u.goals,
              reminder_time_local: u.reminder_time_local as string,
            },
            recentMood,
            slot,
          );

          let contentId: number | null = null;
          if (body) {
            aiUsed++;
            const { data: cached } = await supabaseAdmin
              .from("daily_affirmations")
              .insert({ content: body, category: `ai-${slot}` })
              .select("id").single();
            contentId = (cached?.id as number | null) ?? null;
          } else if (aff.length > 0) {
            const seed = `${u.user_id}-${today}-${slot}`;
            let h = 0;
            for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
            const pick = aff[h % aff.length] as { id: number; content: string };
            body = pick.content;
            contentId = pick.id;
            fallbackUsed++;
          } else {
            continue;
          }

          const name = u.first_name as string | null;
          const subject = slot === "morning"
            ? (name ? `Morning, ${name}.` : "Morning. Time to show up.")
            : slot === "midday"
              ? (name ? `Quick lift, ${name}.` : "Quick lift. Keep moving.")
              : (name ? `Stay with it, ${name}.` : "Stay with it.");

          const { error: insErr } = await supabaseAdmin.from("notification_queue").insert({
            user_id: u.user_id,
            channel: "push",
            type: dedupeType,
            subject,
            body,
            scheduled_for: now.toISOString(),
            status: "sent",
            sent_at: now.toISOString(),
          });
          if (!insErr) {
            enqueued++;
            if (contentId !== null) {
              await supabaseAdmin.from("user_content_history").insert({
                user_id: u.user_id,
                content_type: "affirmation",
                content_id: contentId,
              });
            }
            // Fan out to Web Push devices (best-effort)
            try {
              const r = await sendPushToUser(u.user_id, {
                title: subject,
                body,
                url: "/app",
                tag: `daily-${slot}`,
              });
              pushed += r.sent;
            } catch (e) {
              console.warn("push fanout failed", (e as Error).message);
            }
          }
          // suppress unused var warning
          void slotHour;
        }
        return Response.json({ ok: true, enqueued, aiUsed, fallbackUsed, pushed, bufferSkipped });
      }),
    },
  },
});
