/* Service worker QR Pro : notifications des nouvelles demandes (Web Push), rien d'autre (pas de cache hors ligne). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "QR Pro", body: event.data ? event.data.text() : "Nouvelle demande" };
  }
  const title = data.title || "Nouvelle demande";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: true,
      requireInteraction: !!data.urgent,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      vibrate: data.urgent ? [300, 120, 300, 120, 300] : [200, 100, 200],
      data: { url: data.url || "/espace/demandes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/espace/demandes", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
