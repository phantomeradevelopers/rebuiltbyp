// Server-only helpers for identity contracts.

export const IDENTITY_MILESTONES = [3, 6, 9, 12] as const;

export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
