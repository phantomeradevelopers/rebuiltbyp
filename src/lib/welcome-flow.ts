// Onboarding auto-advance helper.
// Given the current welcome status, return the next incomplete step URL,
// or null if everything is done (caller should send the user to /app/welcome
// to celebrate, then on to /app).

export type WelcomeStatus = {
  hasIdentityContract: boolean;
  hasFirstReadiness: boolean;
  hasFirstCoachMessage: boolean;
};

export const WELCOME_FLAG = "rebuilt_welcome_completed_v1";

export function isWelcomeFlagged(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(WELCOME_FLAG) === "1"; } catch { return false; }
}

/**
 * Returns the next incomplete onboarding step URL, treating `justCompleted`
 * as already done (since the caller just finished it but status may not yet
 * reflect that). Returns null when all three steps are complete.
 */
export function nextWelcomeStep(
  status: WelcomeStatus,
  justCompleted?: "identity" | "readiness" | "coach",
): "/app/identity" | "/app/readiness" | "/app/coach" | null {
  const identity = status.hasIdentityContract || justCompleted === "identity";
  const readiness = status.hasFirstReadiness || justCompleted === "readiness";
  const coach = status.hasFirstCoachMessage || justCompleted === "coach";
  if (!identity) return "/app/identity";
  if (!readiness) return "/app/readiness";
  if (!coach) return "/app/coach";
  return null;
}
