import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type TimeFormatChoice = "system" | "12h" | "24h";
type Resolved = "12h" | "24h";

const STORAGE_KEY = "rebuilt:time-format";

function readStored(): TimeFormatChoice {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "12h" || v === "24h" || v === "system" ? v : "system";
}

function systemPrefers(): Resolved {
  if (typeof Intl === "undefined") return "12h";
  try {
    const h12 = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
    return h12 === false ? "24h" : "12h";
  } catch {
    return "12h";
  }
}

function resolve(choice: TimeFormatChoice): Resolved {
  return choice === "system" ? systemPrefers() : choice;
}

/** Format an "HH:MM" 24-hour string for display. Returns fallback if invalid. */
export function formatTime(hhmm: string | null | undefined, resolved: Resolved, fallback = "—"): string {
  if (!hhmm) return fallback;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return fallback;
  if (resolved === "24h") return `${String(h).padStart(2, "0")}:${min}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${period}`;
}

type Ctx = {
  choice: TimeFormatChoice;
  resolved: Resolved;
  setChoice: (c: TimeFormatChoice) => void;
  format: (hhmm: string | null | undefined, fallback?: string) => string;
};

const TimeFormatContext = createContext<Ctx | null>(null);

export function TimeFormatProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<TimeFormatChoice>("system");
  const [resolved, setResolved] = useState<Resolved>("12h");

  useEffect(() => {
    const stored = readStored();
    setChoiceState(stored);
    setResolved(resolve(stored));
  }, []);

  function setChoice(c: TimeFormatChoice) {
    setChoiceState(c);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, c);
    setResolved(resolve(c));
  }

  const format = useCallback(
    (hhmm: string | null | undefined, fallback = "—") => formatTime(hhmm, resolved, fallback),
    [resolved]
  );

  return (
    <TimeFormatContext.Provider value={{ choice, resolved, setChoice, format }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat() {
  const ctx = useContext(TimeFormatContext);
  if (!ctx) throw new Error("useTimeFormat must be used inside <TimeFormatProvider>");
  return ctx;
}
