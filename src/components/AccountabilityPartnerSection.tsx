import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Check, X, Bell, LinkIcon, UserX, Loader2 } from "lucide-react";
import {
  getPartnerStatus, invitePartnerByCode, acceptPartnerInvite, unpairPartner, nudgePartner,
  type PartnerStatus,
} from "@/lib/accountability.functions";
import { useTranslation } from "react-i18next";

export function AccountabilityPartnerSection() {
  const { i18n } = useTranslation();
  const isEs = i18n.language?.startsWith("es");
  const load = useServerFn(getPartnerStatus);
  const invite = useServerFn(invitePartnerByCode);
  const accept = useServerFn(acceptPartnerInvite);
  const unpair = useServerFn(unpairPartner);
  const nudge = useServerFn(nudgePartner);

  const [status, setStatus] = useState<PartnerStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      const r = await load();
      setStatus(r);
    } catch (e) {
      console.error("partner status", e);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await invite({ data: { code: code.trim() } });
      if (r.sent) toast.success(isEs ? "Invitación enviada." : "Invite sent.");
      else if (r.reason === "exists") toast.info(isEs ? "Ya hay una invitación con esa persona." : "Already have an invite with that person.");
      else toast.info(isEs ? "No pudimos enviar la invitación." : "Could not send the invite.");
      setCode("");
      await refresh();
    } catch (e2) { toast.error((e2 as Error).message); }
    finally { setBusy(false); }
  }

  async function onAccept(pair_id: string) {
    setBusy(true);
    try { await accept({ data: { pair_id } }); toast.success(isEs ? "Compañero conectado." : "Partner connected."); await refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onReject(pair_id: string) {
    setBusy(true);
    try { await unpair({ data: { pair_id } }); await refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onUnpair(pair_id: string) {
    if (!confirm(isEs ? "¿Desconectar a tu compañero?" : "Unpair your partner?")) return;
    setBusy(true);
    try { await unpair({ data: { pair_id } }); toast.success(isEs ? "Desconectados." : "Unpaired."); await refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onNudge(pair_id: string) {
    setBusy(true);
    try {
      const r = await nudge({ data: { pair_id } });
      if ((r as any).ok) toast.success(isEs ? "Aviso enviado." : "Nudge sent.");
      else if ((r as any).reason === "rate_limited") toast.info(isEs ? "Ya enviaste un aviso reciente." : "You already sent a nudge recently.");
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!loaded) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="h-4 w-48 bg-muted/40 rounded animate-pulse" />
      </section>
    );
  }

  const partner = status?.partner ?? null;

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <p className="label-mono text-gold flex items-center gap-1.5">
          <Users className="h-3 w-3" /> {isEs ? "Compañero de responsabilidad" : "Accountability partner"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isEs
            ? "Solo se comparte si hiciste el check-in de hoy — nunca notas, salud ni ánimo. Puedes desconectar cuando quieras."
            : "Only your check-in status is shared — never journal, health, or mood. Unpair anytime."}
        </p>
      </div>

      {status?.pending_incoming && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-3 space-y-2">
          <p className="text-sm">
            {isEs ? "Invitación entrante de " : "Invite from "}
            <span className="font-medium text-foreground">
              {status.pending_incoming.from_name ?? (status.pending_incoming.from_code ?? (isEs ? "un miembro" : "a member"))}
            </span>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(status.pending_incoming!.pair_id)}
              disabled={busy}
              className="min-tap flex-1 rounded-md btn-gold text-sm font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" /> {isEs ? "Aceptar" : "Accept"}
            </button>
            <button
              onClick={() => onReject(status.pending_incoming!.pair_id)}
              disabled={busy}
              className="min-tap flex-1 rounded-md border border-border text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-accent"
            >
              <X className="h-4 w-4" /> {isEs ? "Rechazar" : "Decline"}
            </button>
          </div>
        </div>
      )}

      {partner ? (
        <div className="rounded-md border border-border bg-input/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {isEs ? "Emparejado con" : "Paired with"}
              </p>
              <p className="font-display text-xl truncate">
                {partner.partner_name ?? (isEs ? "Compañero" : "Partner")}
              </p>
            </div>
            <StatusPill checked={partner.partner_checked_in_today} isEs={isEs} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <Cell
              label={isEs ? "Tu check-in" : "Your check-in"}
              value={partner.my_checked_in_today ? (isEs ? "Hecho" : "Done") : (isEs ? "Aún no" : "Not yet")}
              accent={partner.my_checked_in_today}
            />
            <Cell
              label={isEs ? "Racha del compañero" : "Partner streak"}
              value={`${partner.partner_streak}d`}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onNudge(partner.pair_id)}
              disabled={busy || partner.partner_checked_in_today}
              title={partner.partner_checked_in_today ? (isEs ? "Ya hizo check-in hoy" : "Already checked in today") : ""}
              className="min-tap flex-1 rounded-md btn-gold text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Bell className="h-4 w-4" />
              {isEs ? "Enviar aviso cálido" : "Send warm nudge"}
            </button>
            <button
              onClick={() => onUnpair(partner.pair_id)}
              disabled={busy}
              className="min-tap rounded-md border border-border px-3 text-sm inline-flex items-center justify-center gap-1.5 hover:bg-accent"
              aria-label={isEs ? "Desconectar" : "Unpair"}
            >
              <UserX className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : status?.pending_outgoing ? (
        <div className="rounded-md border border-border bg-input/40 p-3 flex items-center justify-between gap-2">
          <p className="text-sm">
            <Loader2 className="h-3 w-3 inline animate-spin text-gold mr-1.5" />
            {isEs ? "Esperando que " : "Waiting on "}
            <span className="font-medium text-foreground">
              {status.pending_outgoing.to_name ?? (isEs ? "tu invitado" : "your invite")}
            </span>
            {isEs ? " acepte." : " to accept."}
          </p>
          <button
            onClick={() => onReject(status.pending_outgoing!.pair_id)}
            disabled={busy}
            className="min-tap rounded-md border border-border px-2 text-xs hover:bg-accent"
          >
            {isEs ? "Cancelar" : "Cancel"}
          </button>
        </div>
      ) : (
        <form onSubmit={submitInvite} className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            {isEs ? "Introduce el código de referido de tu amigo" : "Enter your friend's referral code"}
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RB-XXXXX"
              maxLength={16}
              className="flex-1 h-11 rounded-md border border-border bg-background px-3 font-mono text-sm tracking-[0.15em] focus:outline-none focus:border-gold"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 4}
              className="min-tap rounded-md btn-gold px-4 text-sm font-medium disabled:opacity-50"
            >
              {isEs ? "Invitar" : "Invite"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isEs
              ? "Solo se compartirá el estado del check-in (hecho / aún no). Nunca notas ni salud."
              : "Only check-in status (done / not-yet) is shared. Never journal or health data."}
          </p>
        </form>
      )}
    </section>
  );
}

function StatusPill({ checked, isEs }: { checked: boolean; isEs: boolean }) {
  if (checked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">
        <Check className="h-3 w-3" />
        {isEs ? "Hecho hoy" : "Done today"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
      {isEs ? "Aún no" : "Not yet"}
    </span>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <p className={`font-display text-lg ${accent ? "text-gold" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
