import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getLesson } from "@/lib/nutrition-academy.functions";

export const Route = createFileRoute("/app/nutrition/lessons/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Lesson` }] }),
  component: LessonPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-3 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Lesson not found.</div>,
});

function LessonPage() {
  const { slug } = Route.useParams();
  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", slug],
    queryFn: () => getLesson({ data: { slug } }),
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  if (!lesson) return <div className="p-6">Not found.</div>;

  return (
    <article className="px-4 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto">
      <Link to={"/app/nutrition/academy" as never} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Academy</Link>

      <header className="mt-5">
        <p className="label-mono text-[10px] text-gold">{lesson.read_minutes} MIN READ · {lesson.category.toUpperCase()}</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">{lesson.title}</h1>
        <p className="mt-3 text-base text-muted-foreground italic">{lesson.summary}</p>
      </header>

      <div className="mt-6 prose prose-invert max-w-none">
        {lesson.body.split("\n\n").map((para, i) => (
          <p key={i} className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{para}</p>
        ))}
      </div>
    </article>
  );
}
