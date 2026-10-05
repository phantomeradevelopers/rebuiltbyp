import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppBootstrap } from "@/components/AppBootstrap";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { TrackProvider } from "@/lib/track";
import { TimeFormatProvider } from "@/lib/time-format";
import { installWindowErrorReporter } from "@/lib/install-window-error-reporter";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { AdminSignatureMark } from "@/components/AdminSignatureMark";
import { NativeShell } from "@/components/NativeShell";
import "@/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="label-mono">404</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl text-foreground">Lost the path.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That page doesn't exist here. Come back to the way.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Take me home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="label-mono">Something gave way</p>
        <h1 className="mt-4 font-display text-3xl text-foreground">We hit a wall.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no",
      },
      { name: "theme-color", content: "#0C0C0E" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "REBUILT" },
      { title: "REBUILT by Playboy P — From the wreck to the way back" },
      {
        name: "description",
        content:
          "REBUILT is your daily companion for recovery, training, and identity work. From the wreck to the way back — coaching, nutrition, and accountability in one app.",
      },
      { name: "og:site_name", content: "REBUILT" },
      { property: "og:site_name", content: "REBUILT" },
      { property: "og:title", content: "REBUILT by Playboy P — From the wreck to the way back" },
      {
        property: "og:description",
        content:
          "Your daily companion for recovery, training, and identity work. Coaching, nutrition, and accountability in one app.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rebuilt-pathway.lovable.app/" },
      { property: "og:image", content: "https://rebuilt-pathway.lovable.app/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "REBUILT — From the wreck to the way back" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "REBUILT by Playboy P — From the wreck to the way back" },
      {
        name: "twitter:description",
        content:
          "Your daily companion for recovery, training, and identity work. Coaching, nutrition, and accountability in one app.",
      },
      { name: "twitter:image", content: "https://rebuilt-pathway.lovable.app/og-image.png" },
      { name: "twitter:image:alt", content: "REBUILT — From the wreck to the way back" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://rebuiltbyp.com/" },
      { rel: "manifest", href: "/manifest.webmanifest", crossOrigin: "use-credentials" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=Inter:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent as unknown as import("@tanstack/react-router").ErrorRouteComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline script avoids a light-mode flash before ThemeProvider hydrates.
  const themeInit = `(function(){try{var c=localStorage.getItem('rebuilt:theme')||'system';var r=c==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):c;var e=document.documentElement;e.classList.toggle('dark',r==='dark');e.classList.toggle('light',r==='light');e.style.colorScheme=r;var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content',r==='dark'?'#0C0C0E':'#2C2925');}catch(e){document.documentElement.classList.add('dark');}})();`;
  // Time-of-day tint attribute — dawn/day/dusk/night. Re-checks every 10 min.
  const todInit = `(function(){function b(h){return h<6?'night':h<9?'dawn':h<17?'day':h<20?'dusk':'night';}function s(){try{document.documentElement.setAttribute('data-tod',b(new Date().getHours()));}catch(e){}}s();setInterval(s,600000);})();`;

  // Boot splash: brand mark visible from first paint, removed once React mounts.
  const bootSplashCss = `#boot-splash{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0C0C0E;color:#F2EDE4;font-family:Inter,system-ui,sans-serif;font-weight:200;font-size:14px;letter-spacing:0.35em;text-transform:uppercase;transition:opacity .4s ease}body.app-ready #boot-splash{opacity:0;pointer-events:none}`;
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: bootSplashCss }} />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: todInit }} />

      </head>
      <body className="overflow-x-hidden">
        <div id="boot-splash" aria-hidden="true">
          REBUILT
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthInvalidator() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-center" richColors />;
}

function AnalyticsTag() {
  // The private admin console is excluded from the site analytics tracker.
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/admin(\/|$)/.test(path)) return null;
  return <script src="https://agent-amber-glow.lovable.app/t.js" data-site="rebuiltbyp.com" defer />;
}

function AdminAwareSignatureMark() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/admin(\/|$)/.test(path)) return null;
  return <AdminSignatureMark />;
}

/** First-party page + click tracking that feeds the admin Analytics tab. */
function FirstPartyTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    void import("@/lib/web-track").then((m) => {
      m.installWebTracker();
      m.trackPageView(path);
      if (/[?&](checkout|purchase)=success/.test(window.location.search)) {
        m.trackEvent("purchase_completed", { conversion: true });
      }
    });
  }, [path]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    installWindowErrorReporter();
  }, []);
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TrackProvider>
            <TimeFormatProvider>
              <AppBootstrap />
              <NativeShell />
              <AuthInvalidator />
              <PaymentTestModeBanner />
              <Outlet />
              <AdminAwareSignatureMark />
              <ThemedToaster />
              <AnalyticsTag />
              <FirstPartyTracker />

            </TimeFormatProvider>
          </TrackProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
