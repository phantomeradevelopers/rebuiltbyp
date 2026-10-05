import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { adminPinChange } from "@/lib/admin-pin.functions";

export const Route = createFileRoute("/admin/pin")({
  component: PinTab,
});

function PinField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="block text-[11px] text-muted-foreground mb-1.5">{help}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        type="password"
        placeholder="••••••"
        className="w-full h-12 rounded-md border border-border bg-input px-3 text-lg tracking-[0.5em]"
      />
    </label>
  );
}

function PinTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (next !== confirm) return toast.error("The new codes do not match.");
    setBusy(true);
    try {
      await adminPinChange({ data: { currentPin: current, newPin: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("PIN changed.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h2 className="font-display text-lg">Entry code</h2>
        <p className="text-sm text-muted-foreground">
          Six digits, nothing else. Five wrong tries locks the door for fifteen minutes.
        </p>
      </div>
      <PinField label="Current code" help="The one you use today." value={current} onChange={setCurrent} />
      <PinField label="New code" help="Six digits." value={next} onChange={setNext} />
      <PinField label="Repeat new code" help="Type it once more." value={confirm} onChange={setConfirm} />
      <button
        onClick={save}
        disabled={busy || current.length !== 6 || next.length !== 6 || confirm.length !== 6}
        className="h-12 px-5 rounded-md btn-gold text-sm disabled:opacity-40"
      >
        {busy ? "Saving…" : "Change code"}
      </button>
      <p className="text-[11px] text-muted-foreground">
        Forgot it? The code can be wiped from the backend with the <code>reset_admin_pin()</code> maintenance action, then
        the next visit to this console asks you to choose a new one.
      </p>
    </div>
  );
}
