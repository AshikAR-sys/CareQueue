// "Your turn is near" alerts on the phone tracking page (US-19).
// The rules are plain functions, unit-tested in Node (module.exports). In the browser (window.CareQueueAlerts) they
// also chime, vibrate and show a phone notification.
(function (root) {
  "use strict";

  // Which alert a tracking state calls for: "almost" (2 or fewer ahead) or "turn" (called to a counter), or null.
  function alertFor(t) {
    if (!t) return null;
    if (t.status === "waiting" && t.almost) return { kind: "almost", key: "almost" };
    if (t.status === "serving") return { kind: "turn", key: "turn:" + t.counter, counter: t.counter };
    return null;
  }

  // Remembers what was already alerted. The first state seen (when alerts are turned on) is only a starting point.
  function watcher() {
    const fired = new Set();
    let started = false;
    return {
      next(t) {
        const a = alertFor(t);
        if (!started) { started = true; if (a) fired.add(a.key); return null; }
        if (!a || fired.has(a.key)) return null;
        fired.add(a.key);
        return a;
      }
    };
  }

  const rules = { alertFor, watcher };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = rules;
    return;
  }

  // ---------- browser: notification + vibration (the chime comes from announce.js) ----------
  let registration = null;

  // Called from the "Alert me" button press, so the browser may ask for permission. Resolves to the permission.
  async function enable() {
    if (!("Notification" in root)) return "unsupported";
    try {
      if (!registration && "serviceWorker" in root.navigator) registration = await root.navigator.serviceWorker.register("sw.js");
    } catch (e) { registration = null; }
    if (root.Notification.permission === "default") {
      try { return await root.Notification.requestPermission(); } catch (e) { return "denied"; }
    }
    return root.Notification.permission;
  }

  // Phones show notifications through the service worker; desktop browsers can also use new Notification().
  function notify(title, body) {
    try { if (root.navigator.vibrate) root.navigator.vibrate([300, 150, 300]); } catch (e) { /* no vibration */ }
    if (!("Notification" in root) || root.Notification.permission !== "granted") return false;
    const options = { body, tag: "carequeue-turn", renotify: true, icon: "favicon.svg" };
    try {
      if (registration && registration.showNotification) { registration.showNotification(title, options); return true; }
      new root.Notification(title, options);
      return true;
    } catch (e) { return false; }
  }

  root.CareQueueAlerts = Object.assign({ enable, notify }, rules);
})(typeof window !== "undefined" ? window : globalThis);
