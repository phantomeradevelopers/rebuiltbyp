import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, Send, Check } from "lucide-react";
import { submitReview } from "@/lib/reviews.functions";

/**
 * Leave-a-review capture. Submits to `public_reviews` as `pending`.
 * Only approved + consented reviews render publicly (RLS enforced).
 * TODO: /admin/reviews moderation UI.
 */
export function LeaveReviewForm() {
  const submit = useServerFn(submitReview);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState("");
  const [track, setTrack] = useState<"men" | "angels" | "any">("any");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!consent) { setErr("Please check the consent box."); return; }
    if (quote.trim().length < 10) { setErr("Please share at least a sentence."); return; }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          display_name: name.trim(),
          city: city.trim() || null,
          rating,
          quote: quote.trim(),
          track,
          consent: true,
        },
      });
      if (res.ok) setDone(true);
      else setErr(res.error ?? "Could not save. Try again.");
    } catch {
      setErr("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
        <Check className="h-6 w-6 mx-auto text-gold" />
        <p className="mt-2 font-display text-lg">Thank you.</p>
        <p className="mt-1 text-sm text-foreground/70">
          We review every submission before it goes live.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 sm:p-6 space-y-4"
      aria-label="Leave a review"
    >
      <div>
        <p className="label-mono text-gold text-xs">Leave a review</p>
        <p className="mt-1 text-sm text-foreground/70">
          Share your experience with the app. Reviews are moderated before they appear.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-foreground/70">
          First name
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-foreground/15 bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-foreground/70">
          City (optional)
          <input
            maxLength={60}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-foreground/15 bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>

      <div>
        <span className="text-xs text-foreground/70">Rating</span>
        <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} stars`}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star
                className={`h-6 w-6 transition ${n <= rating ? "fill-gold text-gold" : "text-foreground/30"}`}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs text-foreground/70">
        Track
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as "men" | "angels" | "any")}
          className="mt-1 w-full h-10 rounded-lg border border-foreground/15 bg-background px-3 text-sm text-foreground"
        >
          <option value="any">Both / prefer not to say</option>
          <option value="men">Men's · Coach P</option>
          <option value="angels">Angels · Coach Grace</option>
        </select>
      </label>

      <label className="block text-xs text-foreground/70">
        Your experience with the app
        <textarea
          required
          minLength={10}
          maxLength={500}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={4}
          placeholder="What did the app help you do? (Please don't include medical or health-outcome claims.)"
          className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
        />
        <span className="mt-1 block text-[10px] text-foreground/50">
          {quote.length}/500
        </span>
      </label>

      <label className="flex items-start gap-2 text-xs text-foreground/75">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-foreground/25"
        />
        <span>
          I consent to REBUILT displaying my first name, city, and review publicly. I understand only
          approved reviews are shown, and this is about the app experience — not medical advice.
        </span>
      </label>

      {err ? <p className="text-xs text-destructive">{err}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {busy ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
