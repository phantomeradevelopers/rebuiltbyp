import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listMyAdminMessages, markMessageRead, dismissMessage } from "@/lib/inbox.functions";
import { X, ChevronRight } from "lucide-react";

export function AdminMessageInbox() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-inbox"],
    queryFn: () => listMyAdminMessages(),
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissMessage({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inbox"] }),
  });

  const unreadIds = (q.data?.messages ?? []).filter((m) => !m.read_at).map((m) => m.id);
  useEffect(() => {
    if (unreadIds.length === 0) return;
    Promise.all(unreadIds.map((id) => markMessageRead({ data: { id } }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join(",")]);

  const messages = q.data?.messages ?? [];
  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.map((m) => {
        // Automated messages are ones where the sender is the recipient (system-generated).
        // Real coach messages come from a different sender_user_id — those get the gold accent.
        const isAutomated = m.sender_user_id === m.recipient_user_id;
        const target = m.cta_url && m.cta_url.startsWith("/") ? m.cta_url : null;

        const cardBase = "card-elevated p-4 relative animate-count-up block";
        const cardTone = isAutomated
          ? "border-border/60"
          : "border-gold/70 shadow-[0_0_0_1px_var(--rebuilt-gold,rgba(212,175,55,0.4))]";

        const inner = (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss.mutate(m.id);
              }}
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <p className={`label-mono text-xs ${isAutomated ? "text-muted-foreground" : "text-gold"}`}>
              {isAutomated ? "Automated nudge" : "From Coach P"}
            </p>
            <p className="font-display text-lg mt-1 pr-6 first-letter:uppercase">
              {m.subject}
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
              {m.body}
            </p>
            {target && m.cta_label && (
              <span className="mt-3 inline-flex items-center gap-1 h-9 px-4 btn-gold rounded-md text-sm leading-9">
                {m.cta_label} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
            {!target && m.cta_url && m.cta_label && (
              <a
                href={m.cta_url}
                className="mt-3 inline-block h-9 px-4 btn-gold rounded-md text-sm leading-9"
                target="_blank"
                rel="noreferrer"
              >
                {m.cta_label}
              </a>
            )}
          </>
        );

        return target ? (
          <Link key={m.id} to={target as never} className={`${cardBase} ${cardTone}`}>
            {inner}
          </Link>
        ) : (
          <div key={m.id} className={`${cardBase} ${cardTone}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
