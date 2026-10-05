import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// The app is now free-to-use. This route is kept only as a soft redirect for
// any deep links that still point at /no-access. We send people straight to
// the pricing page so they can either start free or begin a trial.
export const Route = createFileRoute("/no-access")({ component: NoAccessRedirect });

function NoAccessRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/pricing" as never, replace: true });
  }, [navigate]);
  return (
    <main className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
      Redirecting to pricing…
    </main>
  );
}
