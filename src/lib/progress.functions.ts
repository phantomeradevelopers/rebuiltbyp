import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeightPoint = { date: string; kg: number };
export type CheckinPoint = {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  workout_completed: boolean | null;
};
export type PhotoItem = { id: string; url: string; view_type: string | null; logged_at: string };

export type ProgressSnapshot = {
  startWeightKg: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  weights: WeightPoint[];
  checkins: CheckinPoint[];
  photos: PhotoItem[];
  workoutsCompleted30d: number;
  checkinDays30d: number;
};

export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressSnapshot> => {
    const { supabase, userId } = context;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [{ data: profile }, weightRes, checkinRes, photosRes] = await Promise.all([
      supabase.from("user_profile").select("weight_kg, goal_weight_kg").eq("user_id", userId).maybeSingle(),
      supabase.from("weight_log").select("weight_kg, logged_at")
        .eq("user_id", userId).gte("logged_at", sinceIso)
        .order("logged_at", { ascending: true }),
      supabase.from("daily_checkins")
        .select("date, mood, energy, stress, sleep_hours, workout_completed")
        .eq("user_id", userId).gte("date", sinceDate)
        .order("date", { ascending: true }),
      supabase.from("progress_photos")
        .select("id, photo_url, view_type, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(120),
    ]);

    const weights: WeightPoint[] = (weightRes.data ?? []).map((r) => ({
      date: (r.logged_at as string).slice(0, 10),
      kg: Number(r.weight_kg),
    }));

    const checkins: CheckinPoint[] = (checkinRes.data ?? []).map((r) => ({
      date: r.date as string,
      mood: r.mood,
      energy: r.energy,
      stress: r.stress,
      sleep_hours: r.sleep_hours == null ? null : Number(r.sleep_hours),
      workout_completed: r.workout_completed,
    }));

    // Sign photo URLs (private bucket)
    const photos: PhotoItem[] = [];
    for (const p of photosRes.data ?? []) {
      const path = p.photo_url as string;
      const { data: signed } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(path, 60 * 60);
      photos.push({
        id: p.id as string,
        url: signed?.signedUrl ?? "",
        view_type: (p.view_type as string | null) ?? null,
        logged_at: p.logged_at as string,
      });
    }

    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const last30Date = last30.toISOString().slice(0, 10);
    const recent = checkins.filter((c) => c.date >= last30Date);
    const workoutsCompleted30d = recent.filter((c) => c.workout_completed).length;
    const checkinDays30d = recent.length;

    const currentWeightKg = weights.length ? weights[weights.length - 1].kg : (profile?.weight_kg ? Number(profile.weight_kg) : null);
    const startWeightKg = weights.length ? weights[0].kg : (profile?.weight_kg ? Number(profile.weight_kg) : null);

    return {
      startWeightKg,
      currentWeightKg,
      goalWeightKg: profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null,
      weights,
      checkins,
      photos,
      workoutsCompleted30d,
      checkinDays30d,
    };
  });

export const logWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ weight_kg: z.number().min(20).max(400) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("weight_log").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
    });
    if (error) throw new Error("Could not save weight.");
    await supabase.from("user_profile").update({ weight_kg: data.weight_kg }).eq("user_id", userId);
    return { ok: true as const };
  });

export const addProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      path: z.string().min(1).max(500),
      view_type: z.enum(["front", "side", "back", "other"]).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Path must start with `${userId}/`
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Invalid photo path.");
    }
    const { error } = await supabase.from("progress_photos").insert({
      user_id: userId,
      photo_url: data.path,
      view_type: data.view_type ?? "other",
    });
    if (error) throw new Error("Could not save photo.");
    return { ok: true as const };
  });

export const deleteProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("progress_photos").select("photo_url").eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (row?.photo_url) {
      await supabase.storage.from("progress-photos").remove([row.photo_url as string]);
    }
    await supabase.from("progress_photos").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true as const };
  });

// ---------- Combined streak (workout + nutrition same day) ----------

export type CombinedStreak = {
  streak: number;
  earnedBadges: string[];
};

export const getCombinedStreak = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CombinedStreak> => {
    const { supabase, userId } = context;
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceDate = since.toISOString().slice(0, 10);
    const sinceIso = since.toISOString();

    const [workoutsRes, foodRes, profileRes] = await Promise.all([
      supabase.from("daily_training_mode").select("date").eq("user_id", userId).gte("date", sinceDate),
      supabase.from("food_log").select("date").eq("user_id", userId).gte("logged_at", sinceIso),
      supabase.from("user_profile").select("earned_badges").eq("user_id", userId).maybeSingle(),
    ]);

    const wDays = new Set<string>((workoutsRes.data ?? []).map((r) => r.date as string));
    const fDays = new Set<string>((foodRes.data ?? []).map((r) => r.date as string));

    let streak = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (wDays.has(ds) && fDays.has(ds)) streak++;
      else {
        // Today not yet logged shouldn't break a prior streak — only break on a missed past day
        if (i === 0) continue;
        break;
      }
    }

    const earned = Array.isArray(profileRes.data?.earned_badges)
      ? (profileRes.data!.earned_badges as string[])
      : [];
    return { streak, earnedBadges: earned };
  });

export const awardBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ badge: z.string().min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("user_profile").select("earned_badges").eq("user_id", userId).maybeSingle();
    const cur = Array.isArray(row?.earned_badges) ? (row!.earned_badges as string[]) : [];
    if (cur.includes(data.badge)) return { added: false as const };
    const next = [...cur, data.badge];
    await supabase.from("user_profile").update({ earned_badges: next }).eq("user_id", userId);
    return { added: true as const };
  });
