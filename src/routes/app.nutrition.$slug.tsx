import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark } from "lucide-react";
import { getFood, toggleBookmark } from "@/lib/nutrition-academy.functions";

export const Route = createFileRoute("/app/nutrition/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Nutrition Academy` }] }),
  component: FoodDetailPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-3 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Food not found.</div>,
});

function FoodDetailPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: food, isLoading } = useQuery({
    queryKey: ["food", slug],
    queryFn: () => getFood({ data: { slug } }),
  });
  const bookmark = useMutation({
    mutationFn: () => toggleBookmark({ data: { foodId: food!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", slug] });
      qc.invalidateQueries({ queryKey: ["nutrition-foods"] });
    },
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  if (!food) return <div className="p-6">Not found.</div>;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto">
      <Link to={"/app/nutrition/academy" as never} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Academy</Link>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-gold capitalize">{food.category}</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl leading-tight">{food.name}</h1>
        </div>
        <button onClick={() => bookmark.mutate()}
          className={`h-10 w-10 rounded-md border grid place-items-center transition ${food.bookmarked ? "bg-gold/15 border-gold text-gold" : "border-border text-muted-foreground hover:border-gold"}`}>
          <Bookmark className={`h-4 w-4 ${food.bookmarked ? "fill-gold" : ""}`} />
        </button>
      </header>

      <section className="mt-5 card-elevated p-5">
        <p className="label-mono text-[10px] text-muted-foreground">PER 100G</p>
        <div className="mt-3 grid grid-cols-4 gap-3 text-center">
          <Macro label="kcal" value={food.kcal_per_100g} />
          <Macro label="P" value={`${Number(food.protein_g)}g`} />
          <Macro label="C" value={`${Number(food.carbs_g)}g`} />
          <Macro label="F" value={`${Number(food.fat_g)}g`} />
        </div>
        {Number(food.fiber_g) > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Fiber: {Number(food.fiber_g)}g</p>
        )}
      </section>

      <section className="mt-5">
        <p className="label-mono text-gold">Why it matters</p>
        <p className="mt-2 text-sm leading-relaxed">{food.why_it_matters}</p>
      </section>

      <section className="mt-5">
        <p className="label-mono text-gold">Best use</p>
        <p className="mt-2 text-sm">{food.best_use}</p>
      </section>

      {food.swaps && (
        <section className="mt-5">
          <p className="label-mono text-gold">Swaps</p>
          <p className="mt-2 text-sm">{food.swaps}</p>
        </section>
      )}

      {food.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {food.tags.map((t) => (
            <span key={t} className="text-[10px] label-mono px-2 py-1 rounded bg-muted/60 text-muted-foreground">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-xl">{value}</p>
      <p className="label-mono text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
