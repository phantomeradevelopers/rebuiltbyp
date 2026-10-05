import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Daylight", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-muted/60 border border-border">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setChoice(value)}
            className={`h-10 rounded text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
              active ? "bg-card text-gold shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        );
      })}
    </div>
  );
}
