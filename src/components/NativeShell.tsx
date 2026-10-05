import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { isNative } from "@/lib/health-sync";

/**
 * Native (Capacitor) shell behaviour. No-op on the web.
 * - Tags <html> with `native-app` so web-only chrome (marketing nav/footer) is hidden.
 * - Sends marketing pages straight into the app (tab bar experience).
 * - Hides the splash screen and styles the status bar.
 */
const WEB_ONLY = /^\/($|pricing$|course$|subscribe$|checkout)/;

export function NativeShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const native = typeof window !== "undefined" && isNative();

  useEffect(() => {
    if (!native) return;
    document.documentElement.classList.add("native-app");
    void import("@capacitor/splash-screen")
      .then((m) => m.SplashScreen.hide())
      .catch(() => {});
    void import("@capacitor/status-bar")
      .then((m) => m.StatusBar.setStyle({ style: m.Style.Dark }))
      .catch(() => {});
  }, [native]);

  useEffect(() => {
    if (!native) return;
    if (WEB_ONLY.test(path)) navigate({ to: "/app" as never, replace: true });
  }, [native, path, navigate]);

  return null;
}
