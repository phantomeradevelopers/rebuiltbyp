import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, X as XIcon, Clock, Calendar, Users, Sparkles } from "lucide-react";
import {
  adminListApplications,
  adminDecideApplication,
  adminListSeats,
  adminListTodaySessions,
  adminSaveSession,
  adminUpsertAvailability,
  generateSessionBrief,
} from "@/lib/consult.functions";
import { isAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/consult")({
  component: AdminConsultPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="font-display text-xl">Inner Circle admin</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <button
          className="mt-4 btn-gold h-10 px-4 rounded-md text-sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </button>
      </div>
    );
  },
});

type Tab = "applications" | "seats" | "sessions" | "availability";

function AdminConsultPage() {
  const me = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const [tab, setTab] = useState<Tab>("applications");

  if (me.isLoading) return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!me.data?.isAdmin) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="font-display text-xl">Admin only</p>
        <Link to="/app" className="mt-4 inline-block btn-gold h-10 px-4 rounded-md text-sm leading-10">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="label-mono text-gold text-[10px]">INNER CIRCLE · ADMIN</p>
          <h1 className="font-display text-3xl">P's Coaching</h1>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>
      </header>

      <nav className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(
          [
            ["applications", "Applications", Clock],
            ["seats", "Seats", Users],
            ["sessions", "This week", Calendar],
            ["availability", "Availability", Calendar],
          ] as Array<[Tab, string, typeof Clock]>
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 h-9 rounded-md text-xs label-mono inline-flex items-center gap-1.5 shrink-0 ${
              tab === t ? "bg-gold text-gold-foreground" : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      {tab === "applications" && <ApplicationsTab />}
      {tab === "seats" && <SeatsTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "availability" && <AvailabilityTab />}
    </div>
  );
}

function ApplicationsTab() {
  const list = useServerFn(adminListApplications);
  const decide = useServerFn(adminDecideApplication);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "waitlist" | "all">("pending");

  const q = useQuery({
    queryKey: ["admin-applications", filter],
    queryFn: () => list({ data: { status: filter } }),
  });

  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" | "waitlist"; notes?: string }) =>
      decide({ data: v }),
    onSuccess: () => {
      toast.success("Decision saved.");
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(["pending", "approved", "waitlist", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 h-7 rounded text-[11px] label-mono ${
                filter === f ? "bg-foreground text-background" : "bg-muted/30 text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {q.data && (
          <p className="text-xs label-mono text-gold">
            {q.data.seatsTaken} / {q.data.seatsTotal} seats taken
          </p>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.applications.length === 0 && (
        <p className="text-sm text-muted-foreground p-4 rounded-md bg-muted/20">No applications.</p>
      )}

      <ul className="space-y-3">
        {q.data?.applications.map((a) => (
          <li key={a.id} className="card-elevated p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{a.profile?.first_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{a.profile?.email ?? a.user_id}</p>
                <p className="text-[11px] label-mono text-muted-foreground mt-0.5">
                  {new Date(a.created_at).toLocaleString()} · {a.status}
                </p>
              </div>
            </div>
            <AppField label="Wants" value={a.want} />
            <AppField label="Obstacle" value={a.obstacle} />
            <AppField label="Why now" value={a.why_now} />
            {a.extra && <AppField label="Extra" value={a.extra} />}
            {a.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button
                  disabled={decideMut.isPending}
                  onClick={() => decideMut.mutate({ id: a.id, decision: "approved" })}
                  className="btn-gold flex-1 h-9 rounded text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  disabled={decideMut.isPending}
                  onClick={() => decideMut.mutate({ id: a.id, decision: "waitlist" })}
                  className="flex-1 h-9 rounded text-xs font-medium border border-gold/40 text-gold"
                >
                  Waitlist
                </button>
                <button
                  disabled={decideMut.isPending}
                  onClick={() => decideMut.mutate({ id: a.id, decision: "rejected" })}
                  className="flex-1 h-9 rounded text-xs font-medium border border-border text-muted-foreground"
                >
                  <XIcon className="h-3.5 w-3.5 inline" /> Pass
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] label-mono text-gold">{label}</p>
      <p className="text-sm whitespace-pre-line leading-relaxed">{value}</p>
    </div>
  );
}

function SeatsTab() {
  const list = useServerFn(adminListSeats);
  const q = useQuery({ queryKey: ["admin-seats"], queryFn: () => list() });
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs label-mono text-gold">
        {q.data?.seatsTaken ?? 0} / {q.data?.seatsTotal ?? 6} seats active
      </p>
      {q.data?.seats.length === 0 && (
        <p className="text-sm text-muted-foreground p-4 rounded-md bg-muted/20">No active seats yet.</p>
      )}
      <ul className="space-y-2">
        {q.data?.seats.map((s) => (
          <li key={s.id} className="card-elevated p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{s.profile?.first_name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">{s.profile?.email}</p>
              <p className="text-[11px] label-mono text-muted-foreground">
                Started {new Date(s.started_at).toLocaleDateString()}
                {s.slot_dow != null && s.slot_time && ` · ${DOW[s.slot_dow]} ${s.slot_time.slice(0, 5)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionsTab() {
  const list = useServerFn(adminListTodaySessions);
  const save = useServerFn(adminSaveSession);
  const brief = useServerFn(generateSessionBrief);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sessions-week"], queryFn: () => list() });

  const briefMut = useMutation({
    mutationFn: (id: string) => brief({ data: { session_id: id } }),
    onSuccess: () => {
      toast.success("Brief generated.");
      qc.invalidateQueries({ queryKey: ["admin-sessions-week"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data?.sessions.length) {
    return <p className="text-sm text-muted-foreground p-4 rounded-md bg-muted/20">No sessions in the next 7 days.</p>;
  }

  return (
    <ul className="space-y-3">
      {q.data.sessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          onGenerateBrief={() => briefMut.mutate(s.id)}
          generating={briefMut.isPending}
          onSave={async (patch) => {
            try {
              await save({ data: { id: s.id, ...patch } });
              toast.success("Saved.");
              qc.invalidateQueries({ queryKey: ["admin-sessions-week"] });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      ))}
    </ul>
  );
}

type SessionRowProps = {
  session: {
    id: string;
    user_id: string;
    scheduled_at: string;
    status: string;
    brief_json: unknown;
    p_notes: string | null;
    action_items: Array<{ id: string; text: string; done: boolean }>;
    profile: { first_name: string | null; email: string } | null;
  };
  onSave: (patch: {
    p_notes?: string;
    action_items?: Array<{ id: string; text: string; done: boolean }>;
    status?: "scheduled" | "completed" | "no_show";
  }) => void;
  onGenerateBrief: () => void;
  generating: boolean;
};

function SessionRow({ session, onSave, onGenerateBrief, generating }: SessionRowProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(session.p_notes ?? "");
  const [items, setItems] = useState(session.action_items);
  const [newItem, setNewItem] = useState("");

  const brief = session.brief_json as { narrative?: string; summary?: Record<string, unknown> } | null;

  return (
    <li className="card-elevated p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">{session.profile?.first_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(session.scheduled_at).toLocaleString()} · {session.status}
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs label-mono text-gold"
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={onGenerateBrief}
              disabled={generating}
              className="text-xs h-8 px-3 rounded border border-gold/40 text-gold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> {generating ? "Generating…" : brief ? "Regenerate brief" : "Generate brief"}
            </button>
          </div>

          {brief?.narrative && (
            <div className="rounded-md bg-muted/20 p-3 text-xs whitespace-pre-line leading-relaxed">
              {brief.narrative}
            </div>
          )}

          <div>
            <p className="text-[10px] label-mono text-gold mb-1">Your notes (visible to client)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
              placeholder="What did you talk about. What did you decide."
            />
          </div>

          <div>
            <p className="text-[10px] label-mono text-gold mb-1">Action items</p>
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() =>
                      setItems(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))
                    }
                  />
                  <span className={it.done ? "line-through text-muted-foreground" : ""}>{it.text}</span>
                  <button
                    onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                    className="text-muted-foreground hover:text-destructive text-xs ml-auto"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="New action item"
                className="flex-1 h-9 px-3 rounded-md bg-background border border-border text-sm"
              />
              <button
                onClick={() => {
                  if (!newItem.trim()) return;
                  setItems([...items, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                  setNewItem("");
                }}
                className="h-9 px-3 rounded-md bg-gold text-gold-foreground text-xs label-mono"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onSave({ p_notes: notes, action_items: items })}
              className="btn-gold flex-1 h-9 rounded text-xs font-medium"
            >
              Save
            </button>
            <button
              onClick={() => onSave({ p_notes: notes, action_items: items, status: "completed" })}
              className="flex-1 h-9 rounded text-xs font-medium border border-gold/40 text-gold"
            >
              Mark completed
            </button>
            <button
              onClick={() => onSave({ status: "no_show" })}
              className="h-9 px-3 rounded text-xs border border-border text-muted-foreground"
            >
              No-show
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AvailabilityTab() {
  const upsert = useServerFn(adminUpsertAvailability);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [slots, setSlots] = useState<
    Array<{ dow: number; start_time: string; end_time: string; timezone: string }>
  >([{ dow: 2, start_time: "09:00", end_time: "12:00", timezone: "America/New_York" }]);

  async function onSave() {
    try {
      await upsert({ data: { slots } });
      toast.success("Availability saved.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Set your recurring weekly windows. Clients book 20-min calls inside these ranges, starting on the half hour.
      </p>
      <ul className="space-y-2">
        {slots.map((s, i) => (
          <li key={i} className="card-elevated p-3 flex items-center gap-2">
            <select
              value={s.dow}
              onChange={(e) =>
                setSlots(slots.map((x, j) => (j === i ? { ...x, dow: Number(e.target.value) } : x)))
              }
              className="h-9 px-2 rounded bg-background border border-border text-sm"
            >
              {DOW.map((d, di) => (
                <option key={di} value={di}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={s.start_time}
              onChange={(e) =>
                setSlots(slots.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))
              }
              className="h-9 px-2 rounded bg-background border border-border text-sm"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="time"
              value={s.end_time}
              onChange={(e) =>
                setSlots(slots.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))
              }
              className="h-9 px-2 rounded bg-background border border-border text-sm"
            />
            <button
              onClick={() => setSlots(slots.filter((_, j) => j !== i))}
              className="ml-auto text-muted-foreground hover:text-destructive text-sm"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          onClick={() =>
            setSlots([...slots, { dow: 1, start_time: "09:00", end_time: "12:00", timezone: "America/New_York" }])
          }
          className="h-9 px-3 rounded text-xs border border-border"
        >
          + Add window
        </button>
        <button onClick={onSave} className="btn-gold h-9 px-4 rounded text-xs font-medium ml-auto">
          Save availability
        </button>
      </div>
    </div>
  );
}
