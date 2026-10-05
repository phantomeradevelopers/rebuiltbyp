import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminMembers, adminMemberDetail } from "@/lib/admin-app.functions";
import { Stat, Empty, Loading, money } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/members")({
  component: MembersTab,
});

function MembersTab() {
  const q = useQuery({ queryKey: ["admin-members"], queryFn: () => adminMembers() });
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const f = filter.trim().toLowerCase();
  const rows = (q.data?.members ?? []).filter(
    (m) => !f || m.name.toLowerCase().includes(f) || m.email.toLowerCase().includes(f),
  );

  if (open) return <MemberDetail userId={open} onBack={() => setOpen(null)} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">Members</h2>
        <p className="text-sm text-muted-foreground">
          Everyone signed up, newest first. Active means they logged something in the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Members" value={q.data?.total ?? "—"} />
        <Stat label="Active" value={q.data?.active ?? "—"} tone="gold" />
        <Stat label="Lapsed" value={q.data?.lapsed ?? "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(q.data?.byPlan ?? []).map((p) => (
          <span key={p.tier} className="text-[11px] rounded-full border border-border px-2.5 py-1">
            {p.label} · {p.count}
          </span>
        ))}
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full h-11 rounded-md border border-border bg-input px-3 text-sm"
      />

      <Loading q={q} />
      {q.data && rows.length === 0 && <Empty what="No activity yet" />}

      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.user_id}>
            <button
              onClick={() => setOpen(m.user_id)}
              className="w-full text-left card-elevated p-3 active:scale-[0.99] transition"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium truncate">{m.name || m.email || "—"}</p>
                <span
                  className={`text-[10px] uppercase tracking-wide shrink-0 ${
                    m.state === "active" ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                >
                  {m.state}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {m.plan} · joined {m.joined || "—"} · last opened {m.lastSeen ?? "never"}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {q.data && <p className="text-[11px] text-muted-foreground">{rows.length} shown.</p>}
    </div>
  );
}

function MemberDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const q = useQuery({
    queryKey: ["admin-member", userId],
    queryFn: () => adminMemberDetail({ data: { userId } }),
  });
  const p = q.data?.profile;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="h-10 px-3 rounded-md border border-border text-sm text-muted-foreground">
        ← All members
      </button>
      <Loading q={q} />
      {p && (
        <>
          <div>
            <h2 className="font-display text-xl">{p.name || p.email || "Member"}</h2>
            <p className="text-sm text-muted-foreground">{p.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Plan" value={p.plan} />
            <Stat label="Joined" value={p.joined || "—"} />
            <Stat label="Last opened" value={p.lastSeen ?? "never"} />
            <Stat label="Onboarded" value={p.onboarded ? "Yes" : "No"} />
          </div>

          <section className="card-elevated p-4">
            <p className="label-mono text-[10px] text-gold mb-2">WHAT THEY USE</p>
            <ul className="text-sm space-y-1">
              {(q.data?.counts ?? []).map((c) => (
                <li key={c.label} className="flex justify-between">
                  <span>{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">{c.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-elevated p-4">
            <p className="label-mono text-[10px] text-gold mb-2">BILLING</p>
            {q.data && q.data.subscriptions.length === 0 && q.data.payments.length === 0 && q.data.purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <ul className="text-xs space-y-1">
                {(q.data?.subscriptions ?? []).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">{s.product}</span>
                    <span className="text-muted-foreground">
                      {s.status} · {s.environment} · ends {s.periodEnd ?? "—"}
                    </span>
                  </li>
                ))}
                {(q.data?.payments ?? []).map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.product ?? "payment"}</span>
                    <span className="text-muted-foreground">
                      {money(t.amount)} · {t.status} · {t.at}
                    </span>
                  </li>
                ))}
                {(q.data?.purchases ?? []).map((c, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>Course · {c.plan}</span>
                    <span className="text-muted-foreground">
                      {money(c.amount)} · {c.at}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-elevated p-4">
            <p className="label-mono text-[10px] text-gold mb-2">COURSE PROGRESS</p>
            {q.data && q.data.courseProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <ul className="text-xs space-y-1">
                {(q.data?.courseProgress ?? []).map((c) => (
                  <li key={c.module} className="flex justify-between gap-2">
                    <span>{c.module}</span>
                    <span className="text-muted-foreground">
                      started {c.started} · {c.completed ? `finished ${c.completed}` : "not finished"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-elevated p-4">
            <p className="label-mono text-[10px] text-gold mb-2">SUPPORT & APPLICATIONS</p>
            {q.data && q.data.support.length === 0 && q.data.coachingApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <ul className="text-xs space-y-1">
                {(q.data?.support ?? []).map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate">{m.subject || m.body.slice(0, 40)}</span>
                    <span className="text-muted-foreground">{m.at}</span>
                  </li>
                ))}
                {(q.data?.coachingApplications ?? []).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>1-on-1 application</span>
                    <span className="text-muted-foreground">
                      {a.status} · {a.at}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
