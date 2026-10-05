// Universal calendar export. .ics works on iOS (Calendar), Android (Google Calendar / default),
// macOS, Outlook, etc. No SDK, no auth required.

export type ReminderInput = {
  time: string;          // "HH:MM" local
  title: string;
  description?: string;
  startDate?: Date;      // defaults to today
};

function pad(n: number) { return n.toString().padStart(2, "0"); }

function toIcsLocal(d: Date) {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
}

function toIcsUtc(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildReminderIcs({ time, title, description = "", startDate }: ReminderInput) {
  const [hh, mm] = time.split(":").map((x) => Number(x));
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(hh || 6, mm || 0, 0, 0);
  // If today's time has already passed, start tomorrow.
  if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@rebuilt`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//REBUILT//Daily Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsLocal(start)}`,
    `DTEND:${toIcsLocal(end)}`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(title)}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl({ time, title, description = "", startDate }: ReminderInput) {
  const [hh, mm] = time.split(":").map((x) => Number(x));
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(hh || 6, mm || 0, 0, 0);
  if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    dates: `${toIcsUtc(start)}/${toIcsUtc(end)}`,
    recur: "RRULE:FREQ=DAILY",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
