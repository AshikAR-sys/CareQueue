// CareQueue session management.
// Roles: "patient" | "receptionist" | "admin" (admin is for automated tests only — bypasses guards).
// Demo-only session handling. The PIN is checked client-side, not by secure server-side authentication.
(function () {
  "use strict";
  const KEY = "carequeue-session";
  const TTL = 8 * 60 * 60 * 1000; // 8 hours

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - s.timestamp > TTL) { localStorage.removeItem(KEY); return null; }
      return s;
    } catch (_) { return null; }
  }

  function set(role, data) {
    localStorage.setItem(KEY, JSON.stringify(Object.assign({ role, timestamp: Date.now() }, data)));
  }

  function clear() { localStorage.removeItem(KEY); }

  // Redirect to index.html if the required role is not active.
  // "admin" role bypasses every guard (automated tests only).
  function guard(requiredRole) {
    const s = get();
    if (s && (s.role === requiredRole || s.role === "admin")) return true;
    window.location.replace("index.html");
    return false;
  }

  // Demo PIN — stored and checked client-side only. Not production security.
  function checkPin(pin) { return pin === "1234"; }

  window.CareAuth = { get, set, clear, guard, checkPin };
})();
