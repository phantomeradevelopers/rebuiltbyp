import { createFileRoute, redirect } from "@tanstack/react-router";

// Old/shared links to /app/today go to the real Today screen.
export const Route = createFileRoute("/app/today")({
  beforeLoad: () => {
    throw redirect({ to: "/app" as never, replace: true });
  },
});
