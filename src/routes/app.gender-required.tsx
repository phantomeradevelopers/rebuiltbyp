import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { setGender } from "@/lib/access.functions";

export const Route = createFileRoute("/app/gender-required")({
  component: GenderRequiredPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />

});

function GenderRequiredPage() {
  const navigate = useNavigate();
  const save = useServerFn(setGender);
  const [busy, setBusy] = useState<"male" | "female" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const choose = async (g: "male" | "female") => {
    setErr(null);
    setBusy(g);
    try {
      await save({ data: { gender: g } });
      navigate({ to: "/app" as never, replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center gap-8 max-w-md mx-auto">
      <div>
        <p className="label-mono text-gold mb-3">One quick question</p>
        <h1 className="font-display text-3xl">So we address you right.</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Your coach, your contract, and your check-ins all read differently depending on your gender.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {(["male", "female"] as const).map((g) => (
          <button
            key={g}
            type="button"
            disabled={busy !== null}
            onClick={() => choose(g)}
            className={`rounded-lg border border-border hover:border-gold hover:bg-card p-6 transition-colors disabled:opacity-50 ${busy === g ? "border-gold bg-card text-gold" : ""}`}
          >
            <p className="font-display text-xl">{g === "male" ? "Man" : "Woman"}</p>
          </button>
        ))}
      </div>

      {err && <p className="label-mono text-destructive">{err}</p>}
    </div>
  );
}
