import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { stripeSecretKey, stripeConfigured } from "@/lib/stripe-server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";


// ============================================================================
// Constants
// ============================================================================

const PRICE_CENTS = 300000; // $3,000 USD / month
const SEAT_CAP = Math.max(1, Number(process.env.CONSULT_SEAT_CAP ?? 6));

// ============================================================================
// Types
// ============================================================================

export type ConsultStatus = {
  active: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  bookingUrl: string | null;
  priceCents: number;
  stripeReady: boolean;
  seatsTaken: number;
  seatsTotal: number;
  application: {
    id: string;
    status: "pending" | "approved" | "rejected" | "waitlist";
    created_at: string;
  } | null;
};

export type ActionItem = { id: string; text: string; done: boolean };

export type SeatView = {
  id: string;
  status: "active" | "paused" | "ended";
  slot_dow: number | null;
  slot_time: string | null;
  zoom_link: string | null;
  started_at: string;
  upcoming: {
    id: string;
    scheduled_at: string;
    video_link: string | null;
  } | null;
  last_completed: {
    id: string;
    scheduled_at: string;
    p_notes: string | null;
    action_items: ActionItem[];
    voice_note_url: string | null;
  } | null;
};

// ============================================================================
// Helpers
// ============================================================================

function getStripe(): Stripe | null {
  const key = stripeSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

function defaultZoomLink(): string | null {
  return process.env.CONSULT_ZOOM_LINK || process.env.CONSULT_BOOKING_URL || null;
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin"]);
  if (!data || data.length === 0) throw new Error("Admin only.");
}

async function activeSeatCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("consult_seats")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return count ?? 0;
}

// ============================================================================
// Status (user)
// ============================================================================

export const getConsultStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultStatus> => {
    const [subRes, appRes, taken] = await Promise.all([
      supabaseAdmin
        .from("consult_subscription")
        .select("status, current_period_end, cancel_at_period_end, plan_price_cents")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("consult_applications")
        .select("id, status, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      activeSeatCount(),
    ]);

    const data = subRes.data;
    const active = !!data && (data.status === "active" || data.status === "trialing");

    return {
      active,
      status: data?.status ?? "inactive",
      currentPeriodEnd: data?.current_period_end ?? null,
      cancelAtPeriodEnd: !!data?.cancel_at_period_end,
      bookingUrl: active ? defaultZoomLink() : null,
      priceCents: data?.plan_price_cents ?? PRICE_CENTS,
      stripeReady: stripeConfigured(),
      seatsTaken: taken,
      seatsTotal: SEAT_CAP,
      application: appRes.data
        ? {
            id: appRes.data.id,
            status: appRes.data.status as ConsultStatus["application"] extends infer T
              ? T extends { status: infer S }
                ? S
                : never
              : never,
            created_at: appRes.data.created_at,
          }
        : null,
    };
  });

// ============================================================================
// Applications
// ============================================================================

export const submitConsultApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        want: z.string().min(10).max(1000),
        obstacle: z.string().min(10).max(1000),
        why_now: z.string().min(10).max(1000),
        extra: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; id: string }> => {
    // Prevent duplicate pending applications
    const { data: existing } = await supabaseAdmin
      .from("consult_applications")
      .select("id, status")
      .eq("user_id", context.userId)
      .in("status", ["pending", "approved", "waitlist"])
      .maybeSingle();
    if (existing) {
      throw new Error(
        existing.status === "approved"
          ? "You're already approved — check your inbox for the next step."
          : "You already have an application in review.",
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("consult_applications")
      .insert({
        user_id: context.userId,
        want: data.want,
        obstacle: data.obstacle,
        why_now: data.why_now,
        extra: data.extra ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// ============================================================================
// Waitlist (user) — used when seats are at the cap
// ============================================================================

export const joinConsultWaitlistFromApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        want: z.string().min(10).max(1000),
        obstacle: z.string().min(10).max(1000),
        why_now: z.string().min(10).max(1000),
        extra: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: profile } = await supabaseAdmin
      .from("user_profile")
      .select("email")
      .eq("user_id", context.userId)
      .maybeSingle();
    const email = (profile?.email as string | undefined) ?? "";
    if (!email) throw new Error("Add an email to your account before joining the waitlist.");
    const name = email.split("@")[0] || "Member";

    const notes = [
      `Want: ${data.want}`,
      `Obstacle: ${data.obstacle}`,
      `Why now: ${data.why_now}`,
      data.extra ? `Extra: ${data.extra}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: existing } = await supabaseAdmin
      .from("consult_waitlist")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.id) {
      const { error: upErr } = await supabaseAdmin
        .from("consult_waitlist")
        .update({ name, email, notes })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("consult_waitlist")
      .insert({ user_id: context.userId, name, email, notes });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============================================================================
// Seat (user)
// ============================================================================

export const getMySeat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeatView | null> => {
    const { data: seat } = await supabaseAdmin
      .from("consult_seats")
      .select("id, status, slot_dow, slot_time, zoom_link_override, started_at")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!seat) return null;

    const nowIso = new Date().toISOString();
    const [upcomingRes, lastRes] = await Promise.all([
      supabaseAdmin
        .from("consult_sessions")
        .select("id, scheduled_at, video_link")
        .eq("seat_id", seat.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("consult_sessions")
        .select("id, scheduled_at, p_notes, action_items, voice_note_url")
        .eq("seat_id", seat.id)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      id: seat.id,
      status: seat.status as "active" | "paused" | "ended",
      slot_dow: seat.slot_dow,
      slot_time: seat.slot_time,
      zoom_link: seat.zoom_link_override ?? defaultZoomLink(),
      started_at: seat.started_at,
      upcoming: upcomingRes.data
        ? {
            id: upcomingRes.data.id,
            scheduled_at: upcomingRes.data.scheduled_at,
            video_link: upcomingRes.data.video_link ?? seat.zoom_link_override ?? defaultZoomLink(),
          }
        : null,
      last_completed: lastRes.data
        ? {
            id: lastRes.data.id,
            scheduled_at: lastRes.data.scheduled_at,
            p_notes: lastRes.data.p_notes,
            action_items: (lastRes.data.action_items as ActionItem[] | null) ?? [],
            voice_note_url: lastRes.data.voice_note_url,
          }
        : null,
    };
  });

// ============================================================================
// Booking
// ============================================================================

export const listAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [availRes, blackoutsRes] = await Promise.all([
      supabaseAdmin
        .from("consult_availability")
        .select("id, dow, start_time, end_time, timezone, active")
        .eq("active", true),
      supabaseAdmin
        .from("consult_blackouts")
        .select("start_date, end_date, reason")
        .gte("end_date", new Date().toISOString().slice(0, 10)),
    ]);
    return {
      availability: availRes.data ?? [],
      blackouts: blackoutsRes.data ?? [],
    };
  });

export const bookSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scheduled_at: z.string().datetime() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; id: string }> => {
    const { data: seat } = await supabaseAdmin
      .from("consult_seats")
      .select("id, zoom_link_override")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!seat) throw new Error("You don't have an active seat.");

    const scheduled = new Date(data.scheduled_at);
    if (scheduled.getTime() < Date.now() + 60 * 60 * 1000) {
      throw new Error("Please book at least 1 hour in advance.");
    }

    // Conflict check: no other scheduled session on same seat within 30 min
    const lower = new Date(scheduled.getTime() - 30 * 60 * 1000).toISOString();
    const upper = new Date(scheduled.getTime() + 30 * 60 * 1000).toISOString();
    const { data: conflicts } = await supabaseAdmin
      .from("consult_sessions")
      .select("id")
      .eq("seat_id", seat.id)
      .eq("status", "scheduled")
      .gte("scheduled_at", lower)
      .lte("scheduled_at", upper);
    if (conflicts && conflicts.length > 0) {
      throw new Error("You already have a call near that time.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("consult_sessions")
      .insert({
        seat_id: seat.id,
        user_id: context.userId,
        scheduled_at: scheduled.toISOString(),
        status: "scheduled",
        video_link: seat.zoom_link_override ?? defaultZoomLink(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const cancelSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await supabaseAdmin
      .from("consult_sessions")
      .update({ status: "canceled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "scheduled");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Checkout / cancel subscription (existing — kept)
// ============================================================================

export const createConsultCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error("Checkout is not live yet — enable Stripe in Lovable Cloud first.");
    }

    // Require approved application
    const { data: app } = await supabaseAdmin
      .from("consult_applications")
      .select("id, status")
      .eq("user_id", context.userId)
      .eq("status", "approved")
      .maybeSingle();
    if (!app) {
      throw new Error("Your application hasn't been approved yet.");
    }

    // Enforce seat cap
    const taken = await activeSeatCount();
    if (taken >= SEAT_CAP) {
      throw new Error("All 6 seats are currently full. You'll be notified when one opens.");
    }

    const priceId = process.env.STRIPE_CONSULT_PRICE_ID;
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PRICE_CENTS,
            recurring: { interval: "month" as const },
            product_data: {
              name: "P's Inner Circle — Weekly 1:1",
              description: "One 20-minute private call per week with P. 6 seats only.",
            },
          },
        };

    const { data: existing } = await supabaseAdmin
      .from("consult_subscription")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const { data: profile } = await supabaseAdmin
        .from("user_profile")
        .select("email, first_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      const customer = await stripe.customers.create({
        email: profile?.email ?? undefined,
        name: profile?.first_name ?? undefined,
        metadata: { supabase_user_id: context.userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [lineItem],
      success_url: `${data.origin}/app/consult/seat?ok=1`,
      cancel_url: `${data.origin}/app/consult?canceled=1`,
      client_reference_id: context.userId,
      automatic_tax: { enabled: false },
      subscription_data: {
        metadata: { supabase_user_id: context.userId, application_id: app.id },
      },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url };
  });

export const cancelConsult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured.");

    const { data } = await supabaseAdmin
      .from("consult_subscription")
      .select("stripe_subscription_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data?.stripe_subscription_id) {
      throw new Error("No active subscription found.");
    }

    await stripe.subscriptions.update(data.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await supabaseAdmin
      .from("consult_subscription")
      .update({ cancel_at_period_end: true })
      .eq("user_id", context.userId);

    return { ok: true };
  });

// Legacy waitlist (kept for backwards compatibility — superseded by applications)
export const joinConsultWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        phone: z.string().max(40).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await supabaseAdmin.from("consult_waitlist").insert({
      user_id: context.userId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Admin
// ============================================================================

export const adminListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ status: z.enum(["pending", "approved", "rejected", "waitlist", "all"]).default("pending") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("consult_applications")
      .select("id, user_id, want, obstacle, why_now, extra, status, reviewer_notes, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: apps, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((apps ?? []).map((a) => a.user_id)));
    const profilesMap = new Map<string, { first_name: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profile")
        .select("user_id, first_name, email")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p) =>
        profilesMap.set(p.user_id, { first_name: p.first_name, email: p.email }),
      );
    }

    return {
      applications: (apps ?? []).map((a) => ({
        ...a,
        profile: profilesMap.get(a.user_id) ?? null,
      })),
      seatsTaken: await activeSeatCount(),
      seatsTotal: SEAT_CAP,
    };
  });

export const adminDecideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "waitlist"]),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.decision === "approved") {
      const taken = await activeSeatCount();
      if (taken >= SEAT_CAP) {
        throw new Error(`All ${SEAT_CAP} seats are full. Move someone to waitlist instead.`);
      }
    }

    const { data: app, error } = await supabaseAdmin
      .from("consult_applications")
      .update({
        status: data.decision,
        reviewer_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id)
      .select("user_id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, user_id: app.user_id };
  });

export const adminListSeats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: seats } = await supabaseAdmin
      .from("consult_seats")
      .select("id, user_id, status, slot_dow, slot_time, started_at, zoom_link_override")
      .eq("status", "active")
      .order("started_at", { ascending: true });

    const userIds = (seats ?? []).map((s) => s.user_id);
    const profilesMap = new Map<string, { first_name: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profile")
        .select("user_id, first_name, email")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p) =>
        profilesMap.set(p.user_id, { first_name: p.first_name, email: p.email }),
      );
    }

    return {
      seats: (seats ?? []).map((s) => ({ ...s, profile: profilesMap.get(s.user_id) ?? null })),
      seatsTaken: seats?.length ?? 0,
      seatsTotal: SEAT_CAP,
    };
  });

export const adminUpsertAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        slots: z
          .array(
            z.object({
              dow: z.number().int().min(0).max(6),
              start_time: z.string().regex(/^\d{2}:\d{2}$/),
              end_time: z.string().regex(/^\d{2}:\d{2}$/),
              timezone: z.string().max(40).default("America/New_York"),
            }),
          )
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("consult_availability").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (data.slots.length > 0) {
      const { error } = await supabaseAdmin.from("consult_availability").insert(
        data.slots.map((s) => ({
          dow: s.dow,
          start_time: s.start_time,
          end_time: s.end_time,
          timezone: s.timezone,
          active: true,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminListTodaySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 7);

    const { data: sessions } = await supabaseAdmin
      .from("consult_sessions")
      .select("id, user_id, scheduled_at, status, brief_json, p_notes, action_items, video_link")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });

    const userIds = Array.from(new Set((sessions ?? []).map((s) => s.user_id)));
    const profilesMap = new Map<string, { first_name: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profile")
        .select("user_id, first_name, email")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p) =>
        profilesMap.set(p.user_id, { first_name: p.first_name, email: p.email }),
      );
    }

    return {
      sessions: (sessions ?? []).map((s) => ({
        ...s,
        action_items: (s.action_items as ActionItem[] | null) ?? [],
        profile: profilesMap.get(s.user_id) ?? null,
      })),
    };
  });

export const adminSaveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        p_notes: z.string().max(5000).optional().nullable(),
        action_items: z
          .array(z.object({ id: z.string(), text: z.string().min(1).max(300), done: z.boolean() }))
          .max(20)
          .optional(),
        status: z.enum(["scheduled", "completed", "no_show"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    type SessionUpdate = Database["public"]["Tables"]["consult_sessions"]["Update"];
    const patch: SessionUpdate = {};
    if (data.p_notes !== undefined) patch.p_notes = data.p_notes;
    if (data.action_items !== undefined) patch.action_items = data.action_items;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "completed") patch.completed_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("consult_sessions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============================================================================
// AI brief generator
// ============================================================================

export const generateSessionBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ session_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: session } = await supabaseAdmin
      .from("consult_sessions")
      .select("id, user_id, scheduled_at")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!session) throw new Error("Session not found.");

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceDate = since.toISOString().slice(0, 10);

    const [profileRes, checkinsRes, foodRes, journalRes, mindsetRes] = await Promise.all([
      supabaseAdmin
        .from("user_profile")
        .select("first_name, goals, physique_focus, training_days_per_week, sleep_hours, stress_level")
        .eq("user_id", session.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("daily_checkins")
        .select("date, mood, energy, sleep_hours, stress, workout_completed, notes")
        .eq("user_id", session.user_id)
        .gte("date", sinceDate)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("food_log")
        .select("date, meal, name, calories, protein_g")
        .eq("user_id", session.user_id)
        .gte("date", sinceDate)
        .order("logged_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("ai_coach_messages")
        .select("content, created_at, role")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("mindset_logs")
        .select("date, state, prompt_text, completed_at")
        .eq("user_id", session.user_id)
        .gte("date", sinceDate)
        .order("date", { ascending: false }),
    ]);

    const checkins = checkinsRes.data ?? [];
    const workouts = checkins.filter((c) => c.workout_completed).length;
    const avgMood =
      checkins.length > 0
        ? checkins.reduce((s, c) => s + (c.mood ?? 0), 0) / checkins.length
        : null;
    const avgEnergy =
      checkins.length > 0
        ? checkins.reduce((s, c) => s + (c.energy ?? 0), 0) / checkins.length
        : null;
    const avgStress =
      checkins.length > 0
        ? checkins.reduce((s, c) => s + (c.stress ?? 0), 0) / checkins.length
        : null;

    const summary = {
      name: profileRes.data?.first_name ?? "Client",
      goals: profileRes.data?.goals ?? [],
      week: {
        checkins_logged: checkins.length,
        workouts_completed: workouts,
        avg_mood: avgMood ? Number(avgMood.toFixed(1)) : null,
        avg_energy: avgEnergy ? Number(avgEnergy.toFixed(1)) : null,
        avg_stress: avgStress ? Number(avgStress.toFixed(1)) : null,
      },
      nutrition: {
        meals_logged: foodRes.data?.length ?? 0,
      },
      mindset_sessions: mindsetRes.data?.filter((m) => m.completed_at).length ?? 0,
      recent_questions: (journalRes.data ?? []).map((j) => j.content?.slice(0, 200)),
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    let aiNarrative = "AI narrative unavailable (LOVABLE_API_KEY not set).";
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are prepping P for a 20-minute 1:1 coaching call. Read the JSON summary of the client's last 7 days and return a concise brief: (1) 2-sentence state of play, (2) Top 3 wins, (3) Top 2 sticking points, (4) 3 talking points P should raise. No fluff, no preamble. Use bullet points.",
              },
              { role: "user", content: JSON.stringify(summary) },
            ],
            temperature: 0.4,
            max_tokens: 600,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res && res.ok) {
          const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          aiNarrative = body.choices?.[0]?.message?.content?.trim() ?? aiNarrative;
        }
      } catch {
        // keep fallback
      }
    }

    const brief = { summary, narrative: aiNarrative, generated_at: new Date().toISOString() };

    await supabaseAdmin
      .from("consult_sessions")
      .update({ brief_json: brief, brief_generated_at: brief.generated_at })
      .eq("id", data.session_id);

    return brief;
  });
