import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  Video,
  Check,
  X as XIcon,
  Mic,
} from "lucide-react";
import {
  getMySeat,
  listAvailability,
  bookSession,
  cancelSession,
} from "@/lib/consult.functions";

export const Route = createFileRoute("/app/consult/seat")({
  component: SeatPage,
  validateSearch: (s: Record<string, unknown>) => ({
    ok: s.ok === "1" || s.ok === 1,
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SeatPage() {
  const { ok } = useSearch({ from: "/app/consult/seat" });
  const fetchSeat = useServerFn(getMySeat);
  const fetchAvail = useServerFn(listAvailability);
  const book = useServerFn(bookSession);
  const cancel = useServerFn(cancelSession);
  const qc = useQueryClient();

  const seatQ = useQuery({ queryKey: ["my-seat"], queryFn: () => fetchSeat() });
  const availQ = useQuery({ queryKey: ["consult-avail"], queryFn: () => fetchAvail() });

  useEffect(() => {
    if (ok) toast.success("Welcome to the Inner Circle. P will be in touch.");
  }, [ok]);

  const bookMut = useMutation({
    mutationFn: (scheduled_at: string) => book({ data: { scheduled_at } }),
    onSuccess: () => {
      toast.success("Booked. P will see you then.");
      qc.invalidateQueries({ queryKey: ["my-seat"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Canceled.");
      qc.invalidateQueries({ queryKey: ["my-seat"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (seatQ.isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const seat = seatQ.data;
  if (!seat) {
    return (
      <div className="px-6 pt-safe pt-6 max-w-md mx-auto space-y-4">
        <Link to="/app" className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-gold">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="font-display text-2xl">No active seat yet.</p>
        <p className="text-sm text-muted-foreground">
          Apply for the Inner Circle to get a weekly 1:1 call with P.
        </p>
        <Link to="/app/consult" search={{ ok: false, canceled: false }} className="btn-gold inline-block h-11 px-5 rounded-md text-sm leading-[44px] font-medium">
          View details
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-12">
      <Link to="/app" className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <header className="space-y-1">
        <p className="label-mono text-gold">Inner Circle · Seat active</p>
        <h1 className="font-display text-3xl leading-tight">Your weekly with P</h1>
      </header>

      {/* Upcoming call */}
      <section className="card-elevated p-5 border border-gold/40 space-y-3">
        <p className="label-mono text-xs text-muted-foreground">Next call</p>
        {seat.upcoming ? (
          <>
            <p className="font-display text-2xl leading-tight">
              {formatDateTime(seat.upcoming.scheduled_at)}
            </p>
            <div className="flex gap-2 pt-2">
              {seat.upcoming.video_link && (
                <a
                  href={seat.upcoming.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold flex-1 h-11 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <Video className="h-4 w-4" /> Join call
                </a>
              )}
              <button
                onClick={() => {
                  if (confirm("Cancel this call?")) cancelMut.mutate(seat.upcoming!.id);
                }}
                className="h-11 px-4 rounded-md border border-border text-xs label-mono text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing booked. Pick a slot below.
          </p>
        )}
      </section>

      {/* Booking */}
      <section className="space-y-3">
        <p className="label-mono text-xs text-muted-foreground">Book next call</p>
        <BookingCalendar
          availability={availQ.data?.availability ?? []}
          blackouts={availQ.data?.blackouts ?? []}
          onPick={(iso) => bookMut.mutate(iso)}
          busy={bookMut.isPending}
        />
      </section>

      {/* Last call recap */}
      {seat.last_completed && (
        <section className="card-elevated p-5 space-y-3">
          <p className="label-mono text-xs text-muted-foreground">
            Last call · {formatDateTime(seat.last_completed.scheduled_at)}
          </p>
          {seat.last_completed.p_notes && (
            <div>
              <p className="text-xs label-mono text-gold mb-1">P's notes</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {seat.last_completed.p_notes}
              </p>
            </div>
          )}
          {seat.last_completed.action_items.length > 0 && (
            <div>
              <p className="text-xs label-mono text-gold mb-2">Action items</p>
              <ul className="space-y-1.5">
                {seat.last_completed.action_items.map((ai) => (
                  <li key={ai.id} className="flex items-start gap-2 text-sm">
                    {ai.done ? (
                      <Check className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    ) : (
                      <span className="h-4 w-4 rounded-sm border border-border shrink-0 mt-0.5" />
                    )}
                    <span className={ai.done ? "line-through text-muted-foreground" : ""}>
                      {ai.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {seat.last_completed.voice_note_url && (
            <a
              href={seat.last_completed.voice_note_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
            >
              <Mic className="h-4 w-4" /> Listen to voice note
            </a>
          )}
        </section>
      )}

      {/* Slot preference */}
      {(seat.slot_dow != null && seat.slot_time) && (
        <p className="text-xs text-muted-foreground text-center">
          Preferred recurring slot: {DOW_LABELS[seat.slot_dow]} at {seat.slot_time.slice(0, 5)}
        </p>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BookingCalendar({
  availability,
  blackouts,
  onPick,
  busy,
}: {
  availability: Array<{ dow: number; start_time: string; end_time: string }>;
  blackouts: Array<{ start_date: string; end_date: string }>;
  onPick: (iso: string) => void;
  busy: boolean;
}) {
  const days = useMemo(() => {
    const out: Array<{ date: Date; slots: Date[] }> = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().slice(0, 10);
      const blackedOut = blackouts.some(
        (b) => dateStr >= b.start_date && dateStr <= b.end_date,
      );
      if (blackedOut) continue;

      const dayAvail = availability.filter((a) => a.dow === d.getDay());
      if (dayAvail.length === 0) continue;

      const slots: Date[] = [];
      for (const a of dayAvail) {
        const [sh, sm] = a.start_time.split(":").map(Number);
        const [eh, em] = a.end_time.split(":").map(Number);
        const start = new Date(d);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(d);
        end.setHours(eh, em, 0, 0);
        const cursor = new Date(start);
        while (cursor.getTime() + 20 * 60 * 1000 <= end.getTime()) {
          if (cursor.getTime() > Date.now() + 60 * 60 * 1000) {
            slots.push(new Date(cursor));
          }
          cursor.setMinutes(cursor.getMinutes() + 30);
        }
      }
      if (slots.length > 0) out.push({ date: d, slots });
    }
    return out;
  }, [availability, blackouts]);

  const [openDay, setOpenDay] = useState<string | null>(null);

  if (availability.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-4 rounded-md bg-muted/30">
        P hasn't set availability yet. You'll be notified when slots open.
      </p>
    );
  }

  if (days.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-4 rounded-md bg-muted/30">
        No open slots in the next 2 weeks. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {days.map(({ date, slots }) => {
        const key = date.toISOString().slice(0, 10);
        const isOpen = openDay === key;
        return (
          <div key={key} className="rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setOpenDay(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30"
            >
              <span>{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span className="text-xs label-mono text-muted-foreground">
                {slots.length} open
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-muted/10">
                {slots.map((s) => (
                  <button
                    key={s.toISOString()}
                    disabled={busy}
                    onClick={() => onPick(s.toISOString())}
                    className="h-9 rounded-md border border-gold/40 text-xs hover:bg-gold/10 disabled:opacity-40"
                  >
                    {s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
