/**
 * Readiness scoring + readiness-driven top-mission framing.
 *
 * Educational signal only — never prescriptive dosing or medical advice.
 * Drives the top card on the Today screen so the daily mission reflects
 * how the user actually feels, not just the program calendar.
 */

import type { LastCheckin, TodaySnapshot } from "./dashboard.functions";

export type ReadinessScore = "low" | "steady" | "high";

export function scoreReadiness(checkin: LastCheckin | null | undefined): ReadinessScore {
  if (!checkin) return "steady";
  const { energy, sleep_hours, stress } = checkin;
  if (energy <= 4 || sleep_hours < 6 || stress >= 7) return "low";
  if (energy >= 8 && sleep_hours >= 7 && stress <= 4) return "high";
  return "steady";
}

export interface TopMission {
  score: ReadinessScore;
  label: string;
  sub: string;
  reason: string;
  to: "/app/plan" | "/app/checkin/today";
}

export function topMissionFor(
  t: Pick<TodaySnapshot, "lastCheckin" | "todayWorkout" | "checkinDoneToday"> | null | undefined,
): TopMission {
  const checkin = t?.lastCheckin ?? null;
  const score = scoreReadiness(checkin);
  const hasWorkout = !!t?.todayWorkout && (t.todayWorkout.exercises?.length ?? 0) > 0;
  const todayName = t?.todayWorkout?.title ?? "today's session";

  if (!t?.checkinDoneToday && !checkin) {
    return {
      score: "steady",
      label: "Start with a check-in",
      sub: "~90 seconds — then we shape the day.",
      reason: "Tell P where you're at and the mission adjusts to match.",
      to: "/app/checkin/today",
    };
  }

  if (score === "low") {
    return {
      score,
      label: "Active recovery day",
      sub: hasWorkout ? "Swap heavy for a lighter loop." : "Walk, mobility, breath work.",
      reason: "Readiness is low — today's a recovery day.",
      to: "/app/plan",
    };
  }

  if (score === "high") {
    return {
      score,
      label: hasWorkout ? `Push it — ${todayName}` : "Push the intensity",
      sub: hasWorkout ? "Add a set, hold the form." : "Pick something hard and finish it.",
      reason: "Readiness is high — green light to go heavy.",
      to: "/app/plan",
    };
  }

  return {
    score,
    label: hasWorkout ? todayName : "Steady day",
    sub: hasWorkout ? "Show up. Do the work." : "Light movement, hold the line.",
    reason: "Readiness steady — run the program as written.",
    to: "/app/plan",
  };
}
