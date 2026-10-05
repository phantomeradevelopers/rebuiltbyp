import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSupport, adminSupportRead } from "@/lib/admin-app.functions";
import { Stat, Empty, Loading } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/support")({
  component: SupportTab,
});

function SupportTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-support"], queryFn: () => adminSupport() });
  const d = q.data;

  async function toggle(id: string, read: boolean) {
    await adminSupportRead({ data: { id, read } });
    await qc.invalidateQueries({ queryKey: ["admin-support"] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">Support</h2>
        <p className="text-sm text-muted-foreground">Messages and feedback in one place. Tap a message to mark it read.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Unread" value={d?.unread ?? "—"} tone="gold" />
        <Stat label="Total" value={d?.total ?? "—"} />
      </div>

      <Loading q={q} />
      {d && d.messages.length === 0 && <Empty what="No activity yet — no messages or feedback." />}

      <ul className="space-y-2">
        {(d?.messages ?? []).map((m) => (
          <li key={m.id}>
            <button
              onClick={() => void toggle(m.id, !m.read)}
              className={`w-full text-left card-elevated p-3 ${m.read ? "opacity-70" : "border-gold/50"}`}
            >
              <div className="flex justify-between gap-3">
                <p className="text-sm font-medium truncate">{m.subject || "(no subject)"}</p>
                <span className="text-[10px] uppercase tracking-wide shrink-0 text-muted-foreground">
                  {m.read ? "read" : "unread"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {m.name || "Anonymous"} · {m.email || "no email"} · {m.at}
              </p>
              <p className="text-xs mt-1 whitespace-pre-wrap">{m.body}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
