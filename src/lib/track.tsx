import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAccessStatus } from "@/lib/access.functions";
import { setTrack as setTrackFn, type Track } from "@/lib/track.functions";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "rebuilt:track";

function readStored(): Track {
  if (typeof window === "undefined") return "men";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "angels" || v === "men" ? v : "men";
}

function apply(t: Track) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-track", t);
}

type Ctx = {
  track: Track;
  setTrack: (t: Track) => Promise<void>;
  saving: boolean;
};

const TrackContext = createContext<Ctx | null>(null);

export function TrackProvider({ children }: { children: ReactNode }) {
  const [track, setTrackState] = useState<Track>("men");
  const [saving, setSaving] = useState(false);

  // Hydrate: localStorage first (instant), then reconcile with server.
  useEffect(() => {
    const cached = readStored();
    setTrackState(cached);
    apply(cached);
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      try {
        const s = await getAccessStatus();
        if (cancelled) return;
        const server = ((s as unknown as { track?: Track }).track ?? "men") as Track;
        if (server !== cached) {
          setTrackState(server);
          apply(server);
          try { window.localStorage.setItem(STORAGE_KEY, server); } catch { /* noop */ }
        }
      } catch { /* offline — stay on cached */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function setTrack(next: Track) {
    setSaving(true);
    try {
      await setTrackFn({ data: { track: next } });
      setTrackState(next);
      apply(next);
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
    } finally {
      setSaving(false);
    }
  }

  return (
    <TrackContext.Provider value={{ track, setTrack, saving }}>
      {children}
    </TrackContext.Provider>
  );
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used inside <TrackProvider>");
  return ctx;
}

export type { Track };
