import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "system" | "dark" | "light";
type Resolved = "dark" | "light";

const STORAGE_KEY = "rebuilt:theme";

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "system" || v === "dark" ? v : "system";
}


function systemPrefers(): Resolved {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(choice: ThemeChoice): Resolved {
  return choice === "system" ? systemPrefers() : choice;
}

function apply(resolved: Resolved) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.classList.toggle("light", resolved === "light");
  el.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0C0C0E" : "#2C2925");
}


type Ctx = {
  choice: ThemeChoice;
  resolved: Resolved;
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");
  const [resolved, setResolved] = useState<Resolved>("dark");

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = readStored();
    setChoiceState(stored);
    const r = resolve(stored);
    setResolved(r);
    apply(r);
  }, []);

  // Listen for system changes when in 'system' mode
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const r = mq.matches ? "light" : "dark";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  function setChoice(c: ThemeChoice) {
    setChoiceState(c);
    window.localStorage.setItem(STORAGE_KEY, c);
    const r = resolve(c);
    setResolved(r);
    apply(r);
  }

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
