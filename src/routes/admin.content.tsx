import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminContent,
  adminSaveModule,
  adminSetModulePublished,
  adminDeleteModule,
} from "@/lib/admin-app.functions";
import { Empty, Loading } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/content")({
  component: ContentTab,
});

type Draft = { id?: string; slug: string; title: string; summary: string; sort_order: number; published: boolean };

const BLANK: Draft = { slug: "", title: "", summary: "", sort_order: 0, published: true };

function ContentTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-content"], queryFn: () => adminContent() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = q.data;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-content"] });
  }

  async function save() {
    if (!draft) return;
    if (!draft.slug.trim() || !draft.title.trim()) return toast.error("Slug and title are required.");
    try {
      await adminSaveModule({ data: draft });
      toast.success("Saved.");
      setDraft(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg">Content</h2>
        <p className="text-sm text-muted-foreground">Publish, edit and unpublish what members see in the app.</p>
      </div>

      <Loading q={q} />

      <section className="card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="label-mono text-[10px] text-gold">COURSE MODULES</p>
          <button
            onClick={() => setDraft({ ...BLANK, sort_order: (d?.modules.length ?? 0) + 1 })}
            className="h-9 px-3 rounded-md border border-gold/50 text-gold text-xs"
          >
            Add module
          </button>
        </div>

        {draft && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title"
              className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
            />
            <input
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="slug"
              className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
            />
            <textarea
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              placeholder="Summary"
              rows={2}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => void save()} className="h-10 px-4 rounded-md bg-gold text-background text-sm font-medium">
                Save
              </button>
              <button onClick={() => setDraft(null)} className="h-10 px-4 rounded-md border border-border text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {d && d.modules.length === 0 && <Empty what="No modules yet" />}
        <ul className="space-y-2">
          {(d?.modules ?? []).map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-3">
              <div className="flex justify-between gap-3">
                <p className="text-sm truncate">{m.title}</p>
                <span className={`text-[10px] uppercase shrink-0 ${m.published ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {m.published ? "live" : "unpublished"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{m.summary || m.slug}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() =>
                    setDraft({
                      id: m.id,
                      slug: m.slug,
                      title: m.title,
                      summary: m.summary,
                      sort_order: m.order,
                      published: m.published,
                    })
                  }
                  className="h-9 px-3 rounded-md border border-border text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    await adminSetModulePublished({ data: { id: m.id, published: !m.published } });
                    await refresh();
                  }}
                  className="h-9 px-3 rounded-md border border-border text-xs"
                >
                  {m.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={async () => {
                    await adminDeleteModule({ data: { id: m.id } });
                    await refresh();
                  }}
                  className="h-9 px-3 rounded-md border border-destructive/50 text-destructive text-xs"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">NUTRITION ACADEMY LESSONS</p>
        {d && d.lessons.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="text-xs space-y-1">
            {(d?.lessons ?? []).map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="truncate">{l.title}</span>
                <span className="text-muted-foreground shrink-0">{l.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">DAILY QUOTES · {d?.quotes.length ?? 0}</p>
        {d && d.quotes.length === 0 ? (
          <Empty what="No activity yet" />
        ) : (
          <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {(d?.quotes ?? []).slice(0, 50).map((qt) => (
              <li key={qt.id} className="truncate text-muted-foreground">
                {qt.content}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        The meal library has its own editor at <a className="text-gold underline" href="/admin/meals">/admin/meals</a>.
      </p>
    </div>
  );
}
