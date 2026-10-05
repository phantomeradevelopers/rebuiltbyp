import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Sparkles, ChevronRight, BookHeart, Target, RefreshCw } from "lucide-react";
import { getTodayMindset, completeMindsetRep } from "@/lib/mindset.functions";
import { getTodayAnchor } from "@/lib/spirit.functions";
import { toast } from "sonner";
import { SignatureSeal } from "@/components/brand/SignatureSeal";

type Props = {
  date: string;
  faithEnabled: boolean;
  dailyQuote: string | null;
};

const INTENTION_KEY = (d: string) => `rebuilt.intention.${d}`;

/**
 * Merged reflect card — replaces the four separate reflection modules:
 * morning line, mindset quote, set today's intention, and today's anchor.
 * Rotates through the reflection sources; intention input stays pinned.
 */
export function MergedReflectCard({ date, faithEnabled, dailyQuote }: Props) {
  const qc = useQueryClient();
  const mindsetKey = ["mindset-today-todo", date] as const;
  const mindset = useQuery({
    queryKey: mindsetKey,
    queryFn: () => getTodayMindset({ data: { date } }),
    staleTime: 30_000,
  });
  const anchor = useQuery({
    queryKey: ["spirit-today-todo", date],
    queryFn: () => getTodayAnchor({ data: { date } }),
    staleTime: 30_000,
    enabled: faithEnabled,
  });

  const cards = useMemo(() => {
    const list: { kind: string; label: string; body: string }[] = [];
    if (dailyQuote) list.push({ kind: "line", label: "Fresh each morning", body: dailyQuote });
    if (mindset.data?.prompt)
      list.push({ kind: "mindset", label: mindset.data.chip, body: mindset.data.prompt });
    if (faithEnabled && anchor.data?.anchor?.theme)
      list.push({ kind: "anchor", label: "Today's anchor", body: anchor.data.anchor.theme });
    return list;
  }, [dailyQuote, mindset.data, anchor.data, faithEnabled]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (idx >= cards.length && cards.length > 0) setIdx(0);
  }, [cards.length, idx]);

  const [intention, setIntention] = useState<string>("");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(INTENTION_KEY(date));
      setIntention(v ?? "");
    } catch {
      /* noop */
    }
  }, [date]);

  function saveIntention(v: string) {
    setIntention(v);
    try {
      window.localStorage.setItem(INTENTION_KEY(date), v);
    } catch {
      /* noop */
    }
  }

  async function markRep() {
    try {
      await completeMindsetRep({ data: { date } });
      qc.invalidateQueries({ queryKey: mindsetKey });
      toast.success("Rep done.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const active = cards[idx];
  const mindsetDone = !!mindset.data?.completedAt;

  return (
    <section
      className="card-elevated p-5 animate-count-up space-y-4"
      style={{ animationDelay: "160ms" }}
    >
      <div className="flex items-center justify-between">
        <p className="label-mono text-gold flex items-center gap-1.5">
          <Brain className="h-3 w-3" /> Reflect
        </p>
        {cards.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {cards.map((_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-gold" : "bg-foreground/20"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % cards.length)}
              aria-label="Next reflection"
              className="h-8 w-8 grid place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {active ? (
        <div className="border-l-2 border-gold/60 pl-3 min-h-[64px]">
          <p className="label-mono text-[11px] text-gold/70 mb-1">{active.label}</p>
          <p className="font-display text-base leading-snug italic text-foreground/90">
            "{active.body}"
          </p>
          <div className="mt-2 flex justify-end">
            <SignatureSeal size="xs" prefix="—" opacity={0.55} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading today's reflection…</p>
      )}

      {/* Set today's intention */}
      <div>
        <label className="label-mono text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Target className="h-3 w-3" /> Set today's intention
        </label>
        <input
          value={intention}
          onChange={(e) => saveIntention(e.target.value)}
          placeholder="One line. What wins today?"
          maxLength={140}
          className="w-full h-11 rounded-md border border-border bg-input px-3 text-sm focus:border-gold focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={markRep}
          disabled={mindsetDone}
          className={`flex-1 h-11 rounded-md text-sm font-medium transition-all ${
            mindsetDone
              ? "border border-gold/40 bg-gold/10 text-gold"
              : "btn-gold"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {mindsetDone ? "Rep done" : "Mark mental rep done"}
          </span>
        </button>
        {faithEnabled && (
          <Link
            to="/app/spirit"
            search={{ from: "today", date }}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-md border border-border text-sm text-foreground hover:border-gold/60 transition-colors"
          >
            <BookHeart className="h-4 w-4" /> Anchor <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}
