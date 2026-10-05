/**
 * REBUILT brand splash — PURE BLACK + WHITE.
 *
 * Do not theme this component. The wordmark is silent and minimal by design;
 * the Sacred Ember palette only activates once the user is inside the app.
 */
export function BrandSplash({ label }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: "#000000", color: "#ffffff" }}
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="font-wordmark text-3xl sm:text-4xl tracking-[0.32em] leading-none"
          style={{ color: "#ffffff" }}
        >
          REBUILT
        </span>
        {label ? (
          <span
            className="label-mono text-xs"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
