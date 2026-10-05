import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Dumbbell, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { onGymEntry } from "@/hooks/useGymGeofence";

type Entry = {
  title: string;
  body: string;
  gymName: string | null;
  streakDays: number;
};

export function GymEntryOverlay() {
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    const unsub = onGymEntry((e) => {
      setEntry(e);
      // Try a vibration too (mobile)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.([40, 40, 80]); } catch {}
      }
    });
    return unsub;
  }, []);

  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          key="gym-entry"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 backdrop-blur-sm px-6"
          onClick={() => setEntry(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-full max-w-sm rounded-2xl border border-gold/40 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 label-mono text-xs text-gold">
              <Flame className="h-3 w-3" />
              Gym check-in
              {entry.streakDays > 1 && <span className="text-muted-foreground">· {entry.streakDays}-day streak</span>}
            </div>
            <h2 className="font-display text-3xl leading-tight mt-3">{entry.title}</h2>
            {entry.gymName && (
              <p className="text-xs text-muted-foreground mt-1">at {entry.gymName}</p>
            )}
            <p className="text-sm text-foreground/80 mt-3">{entry.body}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                to={"/app" as never}
                onClick={() => setEntry(null)}
                className="rounded-md border border-gold bg-gold/10 px-3 py-2.5 text-sm font-medium text-gold flex items-center justify-center gap-1"
              >
                <Dumbbell className="h-3.5 w-3.5" /> Today's session
              </Link>
              <button
                onClick={() => setEntry(null)}
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-1"
              >
                Freelance <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => setEntry(null)}
              className="mt-3 w-full text-[11px] label-mono text-muted-foreground"
            >
              Dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
