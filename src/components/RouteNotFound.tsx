import { Link } from "@tanstack/react-router";

export function RouteNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 pt-safe">
      <div className="max-w-md text-center">
        <p className="label-mono text-gold">404</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl text-foreground">Lost the path.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That page doesn't exist here. Come back to the way.
        </p>
        <div className="mt-8">
          <Link
            to="/app"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}
