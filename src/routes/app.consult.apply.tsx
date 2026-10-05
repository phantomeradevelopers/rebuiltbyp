import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { submitConsultLead } from "@/lib/consult-lead.functions";

export const Route = createFileRoute("/app/consult/apply")({
  component: ApplyPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />,
});

const BUDGETS = [
  "Under $500",
  "$500 – $1,500",
  "$1,500 – $3,000",
  "$3,000+",
  "Not sure yet",
];

function ApplyPage() {
  const submit = useServerFn(submitConsultLead);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    help: "",
    budget: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit =
    form.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
    form.phone.trim().length >= 5 &&
    form.help.trim().length >= 10 &&
    form.budget.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await submit({
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          help: form.help.trim(),
          budget: form.budget,
        },
      });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="px-6 pt-safe pt-6 max-w-md mx-auto space-y-4 pb-12">
        <h1 className="font-display text-3xl leading-tight">Application received.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          P reads every application himself and replies within 48 hours. Check your
          inbox — a confirmation is on its way.
        </p>
        <Link to="/app" className="btn-gold inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-medium">
          Back to the app
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 pt-safe pt-6 max-w-md mx-auto space-y-6 pb-12">
      <Link
        to="/app/consult"
        search={{ ok: false, canceled: false }}
        className="inline-flex items-center gap-1 text-xs label-mono text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <header className="space-y-2">
        <p className="label-mono text-gold">Apply for a seat</p>
        <h1 className="font-display text-3xl leading-tight">
          Tell us where you are.<br />Then we talk.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Limited seats with the founder. This is applied for, not subscribed to.
          Payment is arranged after acceptance.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <TextField label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
        <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
        <TextField label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" />

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">What do you want help with?</span>
          <p className="text-[11px] text-muted-foreground">
            Be specific — where you are now and what you want to change.
          </p>
          <textarea
            value={form.help}
            onChange={(e) => setForm({ ...form, help: e.target.value })}
            rows={5}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Budget</span>
          <select
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            className="w-full h-12 px-3 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="" disabled>Select a range</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="btn-gold w-full h-12 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {loading ? "Sending…" : "Submit application"}
        </button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Payment is arranged after acceptance. Separate from any plan.
        </p>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold"
      />
    </label>
  );
}
