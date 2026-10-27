// CareQueue session management.
// Roles: "patient" | "receptionist" | "admin" (admin is for automated tests only — bypasses guards).
// The receptionist PIN is checked by the server (POST /api/staff/sign-in), which returns a signed staff pass.
// The pass is kept in the session and sent with every staff request; the page guards here are only for navigation.
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

  // Asks the server to check the PIN. Resolves to the staff pass, or rejects with a message to show.
  async function staffSignIn(pin) {
    let response;
    try {
      response = await fetch("/api/staff/sign-in", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin })
      });
    } catch (_) {
      throw new Error("Can't reach the CareQueue server. Check the connection and try again.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Sign-in failed. Please try again.");
    return payload.token;
  }

  // The staff pass for API requests, or "" when not signed in as staff.
  function staffToken() { const s = get(); return (s && s.token) || ""; }

  window.CareAuth = { get, set, clear, guard, staffSignIn, staffToken };
})();
