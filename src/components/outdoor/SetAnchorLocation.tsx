import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Loader2, Check } from "lucide-react";
import { setHomeLocation, setWorkLocation } from "@/lib/outdoor.functions";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Kind = "home" | "work";

type Props = {
  kind?: Kind;
  onDone?: () => void;
  onSaved?: (info: { countryCode?: string }) => void;
  compact?: boolean;
};

type Suggestion = {
  placePrediction: any;
  main: string;
  secondary: string;
};

const COPY: Record<Kind, { title: string; sub: string; placeholder: string; toast: string; label: string }> = {
  home: {
    title: "Where do you start your runs?",
    sub: "Tell me where home is and I'll map a daily loop right out your door.",
    placeholder: "123 Main St, City, State",
    toast: "Home locked in. Mapping your daily loop.",
    label: "Home",
  },
  work: {
    title: "Where's your workplace?",
    sub: "Add it and we'll map loops + nearby hikes from work too — perfect for a lunch walk.",
    placeholder: "Office address",
    toast: "Workplace saved. Loops from work are ready.",
    label: "Work",
  },
};
export function SetAnchorLocation({ kind = "home", onDone, onSaved, compact = false }: Props) {
  const [saved, setSaved] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggLoading, setSuggLoading] = useState(false);
  const saveHome = useServerFn(setHomeLocation);
  const saveWork = useServerFn(setWorkLocation);
  const save = kind === "work" ? saveWork : saveHome;
  const copy = COPY[kind];

  const placesRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled) return;
        const places = await google.maps.importLibrary("places");
        placesRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  function onChangeAddress(value: string) {
    setAddress(value);
    setActiveIdx(-1);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const places = placesRef.current;
    if (!places || value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setSuggLoading(true);
      try {
        const { suggestions: out } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            sessionToken: sessionTokenRef.current,
          });
        if (myReq !== reqIdRef.current) return;
        const mapped: Suggestion[] = (out ?? [])
          .filter((s: any) => s.placePrediction)
          .slice(0, 6)
          .map((s: any) => {
            const p = s.placePrediction;
            const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
            const secondary = p.structuredFormat?.secondaryText?.text ?? "";
            return { placePrediction: p, main, secondary };
          });
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch {
        if (myReq === reqIdRef.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (myReq === reqIdRef.current) setSuggLoading(false);
      }
    }, 200);
  }

  async function selectSuggestion(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setBusy(true);
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ["location", "formattedAddress", "addressComponents"] });
      const loc = place.location;
      const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
      const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
      const formatted = place.formattedAddress ?? `${s.main} ${s.secondary}`.trim();
      // Pull the ISO country code out of addressComponents if present.
      let countryCode: string | undefined;
      try {
        const comps: any[] = (place as any).addressComponents ?? [];
        const country = comps.find((c) => (c.types ?? []).includes("country"));
        const code = country?.shortText ?? country?.short_name;
        if (typeof code === "string" && /^[A-Z]{2}$/.test(code)) countryCode = code;
      } catch { /* ignore */ }
      setAddress(formatted);
      if (typeof lat !== "number" || typeof lng !== "number") {
        throw new Error("Couldn't read coordinates for that place.");
      }
      const payload = kind === "work" ? { lat, lng, label: formatted } : { lat, lng };
      await save({ data: payload });
      toast.success(copy.toast);
      setSaved(true);
      const places = placesRef.current;
      if (places) sessionTokenRef.current = new places.AutocompleteSessionToken();
      onSaved?.({ countryCode });
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }




  function useGeo() {
    if (!navigator.geolocation) return toast.error("Geolocation not available.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await save({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          toast.success(copy.toast);
          setSaved(true);
          onDone?.();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        toast.error(err.message || "Couldn't get your location.");
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); return; }
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[activeIdx]); return; }
    }
  }

  return (
    <div className={compact ? "" : "card-elevated p-5"}>
      {!compact && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-gold" />
            <p className="label-mono text-gold">{copy.label}</p>
          </div>
          <h3 className="font-display text-xl mb-1">{copy.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{copy.sub}</p>
        </>
      )}
      <div className="relative mb-2">
        <input
          value={address}
          onChange={(e) => onChangeAddress(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
            blurTimerRef.current = window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={copy.placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 pr-9 text-sm focus:border-gold focus:outline-none"
          onKeyDown={onKeyDown}
        />
        {suggLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {open && suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={i}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`px-4 py-2.5 cursor-pointer text-sm border-b border-border last:border-b-0 ${
                  i === activeIdx ? "bg-muted text-gold" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">{s.main}</div>
                {s.secondary && <div className="text-xs text-muted-foreground truncate">{s.secondary}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={useGeo}
          disabled={busy}
          className="flex-1 h-10 px-4 rounded-xl border border-border text-sm hover:border-gold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Use my location
            </>
          )}
        </button>
        {saved && !busy && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gold">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {saved
          ? "Saved automatically. Pick a different address anytime to update."
          : "Start typing and pick from the dropdown — it saves automatically."}
      </p>
      {!compact && (
        <p className="mt-3 text-xs text-muted-foreground">
          Saved privately. Only the map is shown — never your address.
        </p>
      )}
    </div>
  );
}
