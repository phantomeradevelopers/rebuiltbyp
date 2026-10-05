import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Sparkles, ArrowRight } from "lucide-react";
import { listLessons, type Lesson } from "@/lib/nutrition-academy.functions";
import { PageHeader } from "@/components/rebuilt/PageHeader";


export const Route = createFileRoute("/app/nutrition/academy")({
  head: () => ({ meta: [{ title: "Course — Rebuilt" }] }),
  component: AcademyIndex,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function AcademyIndex() {
  const q = useQuery({
    queryKey: ["nutrition-lessons"],
    queryFn: () => listLessons(),
    staleTime: 5 * 60_000,
  });

  const lessons: Lesson[] = q.data ?? [];

  return (
    <div className="min-h-dvh bg-[color:var(--background)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-24">
        <PageHeader
          eyebrow="Course"
          title="Short reads. Real food."
          subtitle="Protein, fiber, fats, timing — the stuff that actually moves the needle."
          backTo="/app/nutrition"
          backLabel="Fuel"
        />

        <Link
          to="/app/nutrition/mogul-bonuses"
          preload="intent"
          className="mt-8 block rounded-2xl border border-[color:var(--rebuilt-gold)]/40 bg-[color:var(--rebuilt-gold-dim)] p-4 hover:border-[color:var(--rebuilt-gold)] active:scale-[0.99] transition"
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-black/40 border border-[color:var(--rebuilt-gold)]/60">
              <Sparkles className="h-5 w-5 text-[color:var(--rebuilt-gold-bright)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[color:var(--rebuilt-gold-bright)]">
                New module
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-[color:var(--text-primary)] leading-tight">
                Mogul Bonuses
              </p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-snug">
                Four downloadable guides — income, AI, brand, launch.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-[color:var(--rebuilt-gold-bright)] mt-3 shrink-0" />
          </div>
        </Link>



        {q.isLoading && (
          <p className="mt-8 text-sm text-[color:var(--text-tertiary)] text-center">
            Loading lessons…
          </p>
        )}

        {!q.isLoading && lessons.length === 0 && (
          <div className="mt-8 rounded-2xl border border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] p-6 text-center">
            <BookOpen className="h-6 w-6 text-[color:var(--rebuilt-gold)] mx-auto mb-2" />
            <p className="text-sm text-[color:var(--text-secondary)]">
              Lessons coming soon.
            </p>
          </div>
        )}

        {lessons.length > 0 && (
          <ul className="mt-8 space-y-3">
            {lessons.map((l, i) => (
              <li key={l.slug}>
                <Link
                  to="/app/nutrition/lessons/$slug"
                  params={{ slug: l.slug }}
                  preload="intent"
                  className="block rounded-2xl border border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] p-4 hover:border-[color:var(--rebuilt-gold)]/60 active:scale-[0.99] transition"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-[color:var(--rebuilt-gold-dim)] border border-[color:var(--rebuilt-gold)]/40 font-mono text-sm font-bold text-[color:var(--rebuilt-gold-bright)] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold text-[color:var(--text-primary)] leading-tight">
                        {l.title}
                      </p>
                      {l.summary && (
                        <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-snug line-clamp-2">
                          {l.summary}
                        </p>
                      )}
                      {l.read_minutes != null && (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                          <Clock className="h-3 w-3" /> {l.read_minutes} min read
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
