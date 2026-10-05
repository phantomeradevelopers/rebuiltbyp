import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listClients, getClientBriefing, addClientNote } from "@/lib/admin.functions";
import { adminUserUsage } from "@/lib/admin-analytics.functions";
import { MessageComposerDialog } from "@/components/admin/MessageComposerDialog";
import { CoachWitnessCard } from "@/components/admin/CoachWitnessCard";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clients")({
  component: AdminPage,
});

function AdminPage() {
  const clients = useQuery({ queryKey: ["admin-clients"], queryFn: () => listClients() });
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...(clients.data?.clients ?? [])].sort((a, b) => {
    const an = (a.first_name || a.email || "").toLowerCase();
    const bn = (b.first_name || b.email || "").toLowerCase();
    return an.localeCompare(bn);
  });

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <CoachWitnessCard />
      </div>


      <div className="grid md:grid-cols-[1fr_2fr] gap-4">
        <ul className="space-y-2">
          {sorted.map((c) => {
            const loc = c.location as { city?: string; country?: string } | null;
            return (
              <li key={c.user_id}>
                <button
                  onClick={() => setSelected(c.user_id)}
                  className={`w-full text-left card-elevated p-3 hover:border-gold/40 transition ${selected === c.user_id ? "border-gold" : ""}`}
                >
                  <p className="font-medium text-sm">{c.first_name ?? "—"} <span className="text-muted-foreground">· {c.email}</span></p>
                  <p className="label-mono text-[10px] text-muted-foreground mt-0.5">
                    {(loc?.city || "—")}, {(loc?.country || "—")} · started {c.rebuilt_start_date ?? "—"}
                  </p>
                </button>
              </li>
            );
          })}
          {clients.data && sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          )}
        </ul>

        <div>
          {selected ? <ClientBrief clientId={selected} /> : (
            <div className="card-elevated p-6 text-center text-sm text-muted-foreground">Select a client to view briefing.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientBrief({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-briefing", clientId], queryFn: () => getClientBriefing({ data: { clientId } }) });
  const usage = useQuery({ queryKey: ["admin-user-usage", clientId], queryFn: () => adminUserUsage({ data: { userId: clientId } }) });
  const [note, setNote] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data) return null;
  const p = q.data.profile as Record<string, unknown> | null;
  if (!p) return <p className="text-sm text-muted-foreground">No profile.</p>;
  const taste = (p.taste_profile ?? {}) as Record<string, string[] | string>;
  const loc = (p.location ?? {}) as { city?: string; country?: string };
  const goals = (p.goals as string[] | null) ?? [];
  const name = (p.first_name as string) ?? (p.email as string) ?? "client";

  async function submitNote() {
    if (!note.trim()) return;
    try {
      await addClientNote({ data: { clientId, body: note } });
      setNote("");
      toast.success("Note added.");
      qc.invalidateQueries({ queryKey: ["admin-briefing", clientId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <section className="card-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono text-[10px] text-gold">CLIENT</p>
            <h2 className="font-display text-2xl">{name}</h2>
            <p className="text-sm text-muted-foreground">{p.email as string}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Age {(p.age as number) ?? "—"} · {loc.city || "—"}, {loc.country || "—"} · started {(p.rebuilt_start_date as string) ?? "—"}
            </p>
          </div>
          <button onClick={() => setMsgOpen(true)} className="h-9 px-3 btn-gold rounded-md text-xs">Message</button>
        </div>
        {goals.length > 0 && <p className="mt-2 text-xs"><span className="label-mono text-[10px] text-gold mr-1">GOALS</span> {goals.join(" · ")}</p>}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">USAGE · LAST 30 DAYS</p>
        {usage.data ? (
          <div className="grid grid-cols-4 gap-2 text-xs">
            <UsageTile label="Streak" value={`${usage.data.streak}d`} />
            <UsageTile label="Check-ins" value={usage.data.checkins_30d} />
            <UsageTile label="Meals" value={usage.data.meals_30d} />
            <UsageTile label="Mindset" value={usage.data.mindset_30d} />
            <UsageTile label="Journal" value={usage.data.journal_30d} />
            <UsageTile label="Outdoor" value={usage.data.outdoor_30d} />
            <UsageTile label="Readiness" value={usage.data.readiness_30d} />
            <UsageTile label="Last seen" value={usage.data.last_active ?? "—"} />
          </div>
        ) : <p className="text-xs text-muted-foreground">Loading…</p>}
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">TASTE PROFILE</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Diet" value={String(p.dietary_pattern ?? "—")} />
          <Field label="Cooking" value={`${p.cooking_willingness ?? "—"} / 5 · ${p.cooking_minutes_per_day ?? "—"} min`} />
          <Field label="Sweet tooth" value={`${p.sweet_tooth ?? "—"} / 5`} />
          <Field label="Organic" value={String(p.organic_preference ?? "—")} />
        </div>
        <div className="mt-3 text-xs space-y-1">
          {(["proteins","carbs","veggies","fats","sweet_subs","flavors","hard_nos"] as const).map((k) => {
            const v = taste[k];
            if (!Array.isArray(v) || v.length === 0) return null;
            return <p key={k}><span className="label-mono text-[10px] text-muted-foreground mr-1 uppercase">{k.replace("_", " ")}</span>{v.join(", ")}</p>;
          })}
          {Array.isArray(p.restaurants) && (p.restaurants as string[]).length > 0 && (
            <p><span className="label-mono text-[10px] text-muted-foreground mr-1">RESTAURANTS</span>{(p.restaurants as string[]).join(", ")}</p>
          )}
          {Array.isArray(p.grocery_stores) && (p.grocery_stores as string[]).length > 0 && (
            <p><span className="label-mono text-[10px] text-muted-foreground mr-1">STORES</span>{(p.grocery_stores as string[]).join(", ")}</p>
          )}
        </div>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">LAST 14 CHECK-INS</p>
        <ul className="text-xs space-y-0.5">
          {q.data.checkins.map((c) => (
            <li key={c.date} className="flex justify-between"><span>{c.date}</span><span className="text-muted-foreground">mood {c.mood ?? "-"} · energy {c.energy ?? "-"} · sleep {c.sleep_hours ?? "-"}h</span></li>
          ))}
          {q.data.checkins.length === 0 && <li className="text-muted-foreground">None.</li>}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">RECENT MEALS</p>
        <ul className="text-xs space-y-0.5">
          {q.data.food.slice(0, 10).map((f, i) => (
            <li key={i} className="flex justify-between"><span>{f.date} · {f.meal} · {f.name}</span><span className="text-muted-foreground">{f.calories} kcal · {f.protein_g}g P</span></li>
          ))}
          {q.data.food.length === 0 && <li className="text-muted-foreground">None.</li>}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">AI SUGGESTIONS</p>
        <ul className="text-xs space-y-1">
          {q.data.suggestions.slice(0, 8).map((s) => (
            <li key={s.id}><span className="label-mono text-[10px] text-muted-foreground mr-1 uppercase">{s.kind}</span>{s.title}</li>
          ))}
          {q.data.suggestions.length === 0 && <li className="text-muted-foreground">None curated yet.</li>}
        </ul>
      </section>

      <section className="card-elevated p-4">
        <p className="label-mono text-[10px] text-gold mb-2">NOTES</p>
        <ul className="text-xs space-y-2 mb-3">
          {q.data.notes.map((n) => (
            <li key={n.id} className="border-l-2 border-border pl-2"><p>{n.body}</p><p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p></li>
          ))}
          {q.data.notes.length === 0 && <li className="text-muted-foreground">No notes yet.</li>}
        </ul>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note for next meeting…" className="w-full rounded-md border border-border bg-input p-2 text-xs" />
        <button onClick={submitNote} className="mt-2 h-9 px-3 btn-gold rounded-md text-xs">Save note</button>
      </section>

      <MessageComposerDialog
        open={msgOpen}
        onOpenChange={setMsgOpen}
        recipientUserId={clientId}
        recipientName={name}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="label-mono text-[9px] text-muted-foreground">{label}</p>
      <p className="text-xs mt-0.5">{value}</p>
    </div>
  );
}

function UsageTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="label-mono text-[9px] text-muted-foreground">{label}</p>
      <p className="font-display text-base mt-0.5">{value}</p>
    </div>
  );
}
