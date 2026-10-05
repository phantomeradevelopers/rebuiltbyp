/**
 * First-party page + click tracker. Mirrors what the public tracker sees, but
 * writes into this project's own database so the admin console can read it.
 * Everything is best-effort and silent: no analytics call may ever break a page.
 */

const ENDPOINT = "/api/public/collect";
const VID_KEY = "rb_vid";
const SID_KEY = "rb_sid";

let visitorId = "";
let sessionId = "";
let isNew = false;
let currentPath: string | null = null;
let enteredAt = 0;
let installed = false;

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ids() {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v = rid();
      localStorage.setItem(VID_KEY, v);
      isNew = true;
    }
    visitorId = v;
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) {
      s = rid();
      sessionStorage.setItem(SID_KEY, s);
    }
    sessionId = s;
  } catch {
    visitorId = visitorId || rid();
    sessionId = sessionId || rid();
  }
}

function device(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth || screen.width || 0;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function isAdmin(path: string) {
  return /^\/admin(\/|$)/.test(path);
}

function send(payload: Record<string, unknown>) {
  try {
    if (!sessionId) ids();
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({
      session_id: sessionId,
      visitor_id: visitorId,
      device: device(),
      screen_w: window.innerWidth || null,
      utm_source: q.get("utm_source"),
      utm_medium: q.get("utm_medium"),
      referrer: document.referrer || null,
      ...payload,
    });
    if (navigator.sendBeacon) {
      const okSent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      if (okSent) return;
    }
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(
      () => {},
    );
  } catch {
    /* ignore */
  }
}

function leave() {
  if (!currentPath || isAdmin(currentPath)) return;
  send({
    event_type: "pageleave",
    path: currentPath,
    duration_ms: Math.min(3_600_000, Date.now() - enteredAt),
  });
}

/** Records a page view; call again on every client-side route change. */
export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  ids();
  if (path === currentPath) return;
  leave();
  currentPath = path;
  enteredAt = Date.now();
  if (isAdmin(path)) return;
  send({ event_type: "pageview", path, is_new: isNew });
}

/** Named event: checkout starts, purchases, anything worth a funnel step. */
export function trackEvent(name: string, opts?: { value_cents?: number; currency?: string; conversion?: boolean }) {
  if (typeof window === "undefined") return;
  if (currentPath && isAdmin(currentPath)) return;
  send({
    event_type: opts?.conversion ? "conversion" : "custom",
    name,
    path: currentPath ?? location.pathname,
    value_cents: opts?.value_cents ?? null,
    currency: opts?.currency ?? null,
  });
}

function label(el: Element): string {
  const explicit = el.getAttribute("data-track");
  if (explicit) return explicit.slice(0, 120);
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim().slice(0, 120);
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  return (text || el.getAttribute("title") || "(unnamed)").slice(0, 120);
}

/** Installs click capture + pagehide flush. Safe to call more than once. */
export function installWebTracker() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  ids();

  document.addEventListener(
    "click",
    (e) => {
      try {
        const target = (e.target as Element | null)?.closest?.("a,button,[data-track],[role='button']");
        if (!target) return;
        const path = location.pathname;
        if (isAdmin(path)) return;
        const href = target.getAttribute("href");
        const dead =
          target.tagName === "A" &&
          (!href || href === "#" || href.trim() === "" || href.startsWith("javascript:"));
        send({
          event_type: "click",
          name: label(target),
          path,
          href: href ?? null,
          dead_link: dead,
        });
      } catch {
        /* ignore */
      }
    },
    true,
  );

  addEventListener("pagehide", leave);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leave();
  });
}
