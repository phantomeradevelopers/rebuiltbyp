import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getAccessStatus } from "@/lib/access.functions";
import { ALL_BONUSES, FREE_BONUS_SLUG } from "@/lib/mogul-bonuses";
import { getBonusDownloadUrl, hasMogulBundle } from "@/lib/mogul-bonuses.functions";
import { PageHeader } from "@/components/rebuilt/PageHeader";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";

export const Route = createFileRoute("/app/nutrition/mogul-bonuses")({
  head: () => ({
    meta: [
      { title: "Mogul Bonuses — REBUILT" },
      { name: "description", content: "The REBUILT Mogul bonus stack — 4 guides for members." },
    ],
  }),
  component: MogulBonusesPage,
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  notFoundComponent: () => <RouteNotFound />,
});

function MogulBonusesPage() {
  const access = useQuery({
    queryKey: ["access-status"],
    queryFn: () => getAccessStatus(),
    staleTime: 60_000,
  });

  const bundle = useQuery({
    queryKey: ["mogul-bundle-owned"],
    queryFn: () => hasMogulBundle(),
    staleTime: 60_000,
  });

  const tier = access.data?.tier ?? "free";
  const entitlement = access.data?.entitlement ?? "free";
  const fullAccess =
    bundle.data?.owned === true ||
    entitlement === "lifetime" ||
    entitlement === "subscriber" ||
    tier === "pro" ||
    tier === "elite" ||
    tier === "lifetime_pro";

  return (
    <div className="min-h-dvh bg-[color:var(--background)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-24">
        <PageHeader
          eyebrow="Mogul Bonuses"
          title="THE CODE + the comeback stack."
          subtitle="THE CODE for everyone. Four Mogul guides for members — income, AI, brand, launch."
          backTo="/app/nutrition/academy"
          backLabel="Course"
        />

        {!fullAccess && (
          <div className="mt-8 rounded-2xl border border-[color:var(--rebuilt-gold)]/40 bg-[color:var(--rebuilt-gold-dim)] p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-[color:var(--rebuilt-gold-bright)] mt-0.5" />
              <div>
                <p className="font-display text-base font-semibold text-[color:var(--text-primary)]">
                  THE CODE is yours. Free.
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Unlock the 4 Mogul guides with Pro, the $497 Course, or 1:1 with Coach P.
                </p>
                <Link
                  to="/app/upgrade"
                  search={{ feature: undefined, plan: undefined } as any}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-[color:var(--rebuilt-gold)] text-black px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90"
                >
                  Unlock all 4
                </Link>
              </div>
            </div>
          </div>
        )}

        <ul className="mt-8 space-y-3">
          {ALL_BONUSES.map((b) => {
            const locked = !fullAccess && b.slug !== FREE_BONUS_SLUG;
            return (
              <li key={b.slug}>
                <div
                  className={`block rounded-2xl border p-4 transition ${
                    locked
                      ? "border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] opacity-60"
                      : "border-[color:var(--border-strong,rgba(255,255,255,0.06))] bg-[color:var(--bg-raised)] hover:border-[color:var(--rebuilt-gold)]/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-[color:var(--rebuilt-gold-dim)] border border-[color:var(--rebuilt-gold)]/40 font-mono text-sm font-bold text-[color:var(--rebuilt-gold-bright)] tabular-nums">
                      {b.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold text-[color:var(--text-primary)] leading-tight">
                        {b.title}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)] leading-snug">
                        {b.subtitle}
                      </p>
                      {locked ? (
                        <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                          <Lock className="h-3 w-3" /> Members only
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { url } = await getBonusDownloadUrl({ data: { slug: b.slug } });
                              window.open(url, "_blank", "noopener,noreferrer");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--rebuilt-gold-bright)] hover:text-[color:var(--rebuilt-gold)]"
                        >
                          <Download className="h-3 w-3" /> Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
