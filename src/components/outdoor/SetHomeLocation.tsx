import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";
import { setHomeLocation } from "@/lib/outdoor.functions";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = { onDone?: () => void };

type Suggestion = {
  placePrediction: any;
  main: string;
  secondary: string;
};

export function SetHomeLocation({ onDone }: Props) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggLoading, setSuggLoading] = useState(false);
  const save = useServerFn(setHomeLocation);

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
      .catch(() => {
        // Silent fallback to plain text input.
      });
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
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const loc = place.location;
      const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
      const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
      const formatted = place.formattedAddress ?? `${s.main} ${s.secondary}`.trim();
      setAddress(formatted);
      if (typeof lat !== "number" || typeof lng !== "number") {
        throw new Error("Couldn't read coordinates for that place.");
      }
      await save({ data: { lat, lng } });
      toast.success("Home locked in. Mapping your daily loop.");
      // Reset session token for next editing session.
      const places = placesRef.current;
      if (places) sessionTokenRef.current = new places.AutocompleteSessionToken();
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress() {
    if (!address.trim()) return;
    // If a suggestion is highlighted, prefer it.
    if (open && activeIdx >= 0 && suggestions[activeIdx]) {
      await selectSuggestion(suggestions[activeIdx]);
      return;
    }
    setBusy(true);
    try {
      await save({ data: { address: address.trim() } });
      toast.success("Home locked in. Mapping your daily loop.");
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
          toast.success("Home locked in. Mapping your daily loop.");
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter") {
        if (activeIdx >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIdx]);
          return;
        }
      }
    }
    if (e.key === "Enter") saveAddress();
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-gold" />
        <p className="label-mono text-gold">Step outside</p>
      </div>
      <h3 className="font-display text-xl mb-1">Where do you start your runs?</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tell me where home is and I'll map a daily loop right out your door.
      </p>
      <div className="relative mb-2">
        <input
          value={address}
          onChange={(e) => onChangeAddress(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
            blurTimerRef.current = window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder="123 Main St, City, State"
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 pr-9 text-sm focus:border-gold focus:outline-none"
          onKeyDown={onKeyDown}
        />
        {suggLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <li
                key={i}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`px-4 py-2.5 cursor-pointer text-sm border-b border-border last:border-b-0 ${
                  i === activeIdx ? "bg-muted text-gold" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">{s.main}</div>
                {s.secondary && (
                  <div className="text-xs text-muted-foreground truncate">
                    {s.secondary}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={saveAddress}
          disabled={busy || !address.trim()}
          className="btn-gold flex-1 h-10 rounded-xl text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save"}
        </button>
        <button
          onClick={useGeo}
          disabled={busy}
          className="h-10 px-4 rounded-xl border border-border text-sm hover:border-gold transition-colors"
        >
          Use my location
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Saved privately. Only the map is shown — never your address.
      </p>
    </div>
  );
}
