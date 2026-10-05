/* REBUILT push service worker — push delivery only, no caching. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

// Allow page to trigger immediate activation of a waiting SW.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "REBUILT", body: "Time to show up.", url: "/app" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (_) { /* keep defaults */ }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "rebuilt-daily",
    data: { url: payload.url || "/app" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = new URL(targetUrl, self.location.origin);
    // 1. Already focused on the exact URL? Just focus.
    for (const client of all) {
      const clientUrl = new URL(client.url);
      if (clientUrl.pathname === target.pathname && clientUrl.search === target.search) {
        if ("focus" in client) return client.focus();
      }
    }
    // 2. Same-origin client open? Navigate it.
    for (const client of all) {
      if (new URL(client.url).origin === target.origin && "navigate" in client) {
        try { await client.navigate(target.href); return client.focus(); } catch (_) {}
      }
    }
    // 3. Open new window.
    if (self.clients.openWindow) return self.clients.openWindow(target.href);
  })());
});

// Re-subscribe when the browser rotates the subscription. We can't auth here,
// so we stash the new subscription via Cache and the app picks it up on next open.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
      const appServerKey = (event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey) || null;
      if (!appServerKey) return;
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
      const json = newSub.toJSON();
      const cache = await caches.open("rebuilt-push-pending");
      await cache.put(
        new Request("/__pending-push-sub"),
        new Response(JSON.stringify({ oldEndpoint, newSubscription: json, at: Date.now() }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch (e) {
      // best-effort
    }
  })());
});
