import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

/**
 * One-tap theme cycle: Dark → Daylight → System → Dark.
 * Compact icon button suitable for headers / near back links.
 */
export function QuickThemeToggle({ className = "" }: { className?: string }) {
  const { choice, resolved, setChoice } = useTheme();

  const next: Record<ThemeChoice, ThemeChoice> = {
    dark: "light",
    light: "system",
    system: "dark",
  };
  const nextLabel: Record<ThemeChoice, string> = {
    dark: "Switch to Daylight",
    light: "Switch to System",
    system: "Switch to Dark",
  };
  const Icon = choice === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  const label =
    choice === "system" ? "System" : choice === "dark" ? "Dark" : "Daylight";

  return (
    <button
      type="button"
      onClick={() => setChoice(next[choice])}
      aria-label={nextLabel[choice]}
      title={nextLabel[choice]}
      className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-card/60 text-xs label-mono text-foreground hover:text-gold hover:border-gold/40 transition-colors ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
