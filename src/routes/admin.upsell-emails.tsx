import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { adminTestUpsellEmail } from "@/lib/upsell-test.functions";

export const Route = createFileRoute("/admin/upsell-emails")({
  component: UpsellEmailsAdmin,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="font-display text-xl">Upsell emails</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <button className="mt-4 btn-gold h-10 px-4 rounded-md text-sm" onClick={() => { router.invalidate(); reset(); }}>Retry</button>
      </div>
    );
  },
});

function UpsellEmailsAdmin() {
  const [email, setEmail] = useState("eeeinternationalllc@gmail.com");
  const [firstName, setFirstName] = useState("");
  const [templateName, setTemplateName] = useState<"upsell-go-annual" | "upsell-plus-to-pro">("upsell-go-annual");

  const send = useMutation({
    mutationFn: () =>
      adminTestUpsellEmail({
        data: {
          templateName,
          recipientEmail: email.trim(),
          firstName: firstName.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      if ((res as { ok: boolean }).ok) {
        toast.success(`Queued to ${email}`);
      } else {
        toast.error(`Not sent: ${(res as { reason: string }).reason}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="label-mono text-gold text-[10px]">REBUILT ADMIN</p>
          <h1 className="font-display text-2xl">Upsell emails · test hook</h1>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">Back</Link>
      </header>

      <div className="card-elevated p-6 space-y-4">
        <div>
          <label className="label-mono text-[10px] text-muted-foreground">Template</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {[
              { key: "upsell-go-annual", label: "Go Annual (ALLIN)" },
              { key: "upsell-plus-to-pro", label: "Plus → Pro (NEXTLEVEL20)" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTemplateName(t.key as typeof templateName)}
                className={`h-9 px-3 rounded-md text-xs border ${
                  templateName === t.key ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-mono text-[10px] text-muted-foreground">Recipient email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mt-2 w-full rounded-md border border-border bg-input p-2 text-sm"
          />
        </div>

        <div>
          <label className="label-mono text-[10px] text-muted-foreground">First name (optional)</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-input p-2 text-sm"
            placeholder="James"
          />
        </div>

        <button
          onClick={() => send.mutate()}
          disabled={send.isPending || !email.includes("@")}
          className="w-full h-10 btn-gold rounded-md text-sm font-medium disabled:opacity-50"
        >
          {send.isPending ? "Sending…" : "Send test email"}
        </button>

        <p className="text-[11px] text-muted-foreground">
          Bypasses per-user campaign guard. Still honors the suppression list.
          Watch delivery in Cloud → Emails.
        </p>
      </div>
    </div>
  );
}
