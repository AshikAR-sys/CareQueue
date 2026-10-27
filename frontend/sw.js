// Service worker for the "your turn is near" phone notifications (US-19).
// It only shows notifications and brings the tracking page forward when one is tapped; it caches nothing.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((pages) => (pages[0] ? pages[0].focus() : undefined)));
});
