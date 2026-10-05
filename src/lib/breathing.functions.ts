import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PATTERNS = new Set(["box", "relax_478", "physio_sigh"]);

export const logBreathingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pattern: string; duration_seconds: number }) => {
    const pattern = String(input?.pattern ?? "");
    const duration_seconds = Math.max(1, Math.min(3600, Math.floor(Number(input?.duration_seconds ?? 0))));
    if (!PATTERNS.has(pattern)) throw new Error("Invalid pattern");
    if (!duration_seconds) throw new Error("Invalid duration");
    return { pattern, duration_seconds };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("breathing_sessions").insert({
      user_id: userId,
      pattern: data.pattern,
      duration_seconds: data.duration_seconds,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getBreathingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("breathing_sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ completed_at: string }>;
    const total = rows.length;

    // Compute daily streak in user's local timezone (best-effort UTC).
    const days = new Set<string>();
    for (const r of rows) {
      const d = new Date(r.completed_at);
      days.add(d.toISOString().slice(0, 10));
    }
    let streak = 0;
    const cur = new Date();
    for (;;) {
      const key = cur.toISOString().slice(0, 10);
      if (days.has(key)) {
        streak += 1;
        cur.setUTCDate(cur.getUTCDate() - 1);
      } else if (streak === 0) {
        // allow "today not yet done" — check yesterday
        cur.setUTCDate(cur.getUTCDate() - 1);
        if (days.has(cur.toISOString().slice(0, 10))) {
          streak += 1;
          cur.setUTCDate(cur.getUTCDate() - 1);
          continue;
        }
        break;
      } else {
        break;
      }
    }
    return { total, streak };
  });
