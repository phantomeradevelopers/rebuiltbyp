import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicReview = {
  id: string;
  display_name: string;
  city: string | null;
  rating: number;
  quote: string;
  track: string;
  approved_at: string | null;
};

/**
 * Public list of approved + consented reviews.
 * FAIL-SAFE: never throws — returns { reviews: [] } on any error so the
 * landing page never crashes or shows an error toast.
 */
export const listApprovedReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ reviews: PublicReview[] }> => {
    try {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return { reviews: [] };
      const sb = createClient<Database>(url, key, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("public_reviews" as never)
        .select("id, display_name, city, rating, quote, track, approved_at")
        .eq("status", "approved")
        .eq("consent", true)
        .order("approved_at", { ascending: false })
        .limit(12);
      if (error) return { reviews: [] };
      return { reviews: (data ?? []) as PublicReview[] };
    } catch {
      return { reviews: [] };
    }
  },
);

const submitSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  city: z.string().trim().max(60).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  quote: z.string().trim().min(10).max(500),
  track: z.enum(["men", "angels", "any"]).default("any"),
  consent: z.literal(true),
});

// Simple in-memory rate limit per worker instance (best-effort).
const recent = new Map<string, number>();

/**
 * Submit a review. Always inserted as `pending` — an admin must approve
 * before it appears publicly. Uses service role because we intentionally
 * disallow direct client INSERT.
 * TODO(moderation): build /admin/reviews UI to approve/reject.
 */
export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => submitSchema.parse(raw))
  .handler(async ({ data }) => {
    // best-effort rate-limit by name to avoid trivial spam bursts
    const key = data.display_name.toLowerCase();
    const now = Date.now();
    const last = recent.get(key) ?? 0;
    if (now - last < 15_000) {
      return { ok: false as const, error: "Please wait a moment before submitting again." };
    }
    recent.set(key, now);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("public_reviews" as never).insert({
        display_name: data.display_name,
        city: data.city || null,
        rating: data.rating,
        quote: data.quote,
        track: data.track,
        consent: true,
        status: "pending",
      } as never);
      if (error) return { ok: false as const, error: "Could not save your review." };
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Could not save your review." };
    }
  });
