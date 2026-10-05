import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { coachListMissed, coachNudgeClient } from "@/lib/witness.functions";
import { Eye, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Coach-only card: shows clients who missed yesterday's check-in with a
 * one-tap "Nudge" button that sends a pre-written encouraging admin message
 * from the coach + push notification.
 */
export function CoachWitnessCard() {
  const listFn = useServerFn(coachListMissed);
  const nudgeFn = useServerFn(coachNudgeClient);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["coach-witness-missed"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const nudge = useMutation({
    mutationFn: (userId: string) => nudgeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Nudge sent. Warm, not shaming.");
      qc.invalidateQueries({ queryKey: ["coach-witness-missed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading witness list…
      </div>
    );
  }

  const missed = q.data?.missed ?? [];
  const date = q.data?.date ?? "";

  return (
    <div className="rounded-2xl border border-gold/40 bg-card p-5">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-gold" />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
          Witness · missed {date}
        </p>
      </div>
      <h2 className="mt-2 font-display text-2xl">
        {missed.length === 0
          ? "Clean sweep. Everyone showed up."
          : `${missed.length} ${missed.length === 1 ? "client" : "clients"} could use a nudge`}
      </h2>
      {missed.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Nudge sends one warm, pre-written message from you. Never shaming.
        </p>
      )}
      {missed.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {missed.map((c) => (
            <li key={c.user_id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.first_name ?? c.email ?? "Unnamed"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Streak {c.streak} · last check-in {c.last_checkin_date ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => nudge.mutate(c.user_id)}
                disabled={nudge.isPending && nudge.variables === c.user_id}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-gold text-black text-xs font-semibold disabled:opacity-50"
              >
                {nudge.isPending && nudge.variables === c.user_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Nudge
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
