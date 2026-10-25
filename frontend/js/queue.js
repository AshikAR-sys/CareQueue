// Browser adapter for the CareQueue API. Queue data is stored by SQLite on the server.
(function () {
  "use strict";
  const Core = window.QueueCore;
  const listeners = new Set();
  const isPublicScreen = document.body.classList.contains("screen-display");
  let day = Core.emptyDay(Core.dayKey(new Date()));
  let connected = false;
  let refreshInFlight = null;

  async function refresh(force = false) {
    if (refreshInFlight) {
      if (!force) return refreshInFlight;
      await refreshInFlight;
    }
    refreshInFlight = (async () => {
      try {
        const path = isPublicScreen ? "/api/queue/public-state" : "/api/queue/state";
        const response = await fetch(path, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Queue service is unavailable.");
        day = payload;
        connected = true;
      } catch (_error) {
        connected = false;
      } finally {
        listeners.forEach((listener) => {
          try { listener(); } catch (error) { console.error("Queue subscriber failed:", error); }
        });
      }
    })();
    try { await refreshInFlight; } finally { refreshInFlight = null; }
  }

  async function request(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The queue action failed.");
    return payload;
  }

  async function issue(details) {
    if (!details || !details.department || !details.department.code) {
      throw new Error("No department selected.");
    }
    const payload = await request("/api/tokens", {
      code: details.department.code,
      patient: {
        name: details.name, age: details.age, gender: details.gender,
        phone: details.phone, doctor: details.doctor || ""
      }
    });
    await refresh(true);
    const token = payload.token;
    return {
      number: token.number,
      issuedAt: new Date(token.createdAt),
      mode: "server",
      estimate: Core.estimate(day, token.number, Date.now())
    };
  }

  async function callNext(code) {
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/call-next", {});
    await refresh(true);
    return result.token;
  }

  async function skip(code) {
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/skip", {});
    await refresh(true);
    return result.token;
  }

  // US-04 Send to Billing: finish the patient being served in fromCode and add them to toCode.
  async function sendTo(fromCode, toCode) {
    const result = await request("/api/queue/" + encodeURIComponent(fromCode) + "/send-to/" + encodeURIComponent(toCode), {});
    await refresh(true);
    return result.token;
  }

  async function recall(number) {
    const result = await request("/api/tokens/" + encodeURIComponent(number) + "/recall", {});
    await refresh(true);
    return result.token;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener();
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { listeners.delete(listener); clearInterval(timer); };
  }

  window.TokenQueue = {
    issue,
    callNext,
    skip,
    recall,
    sendTo,
    estimate: (number) => Core.estimate(day, number, Date.now()),
    view: (code) => Core.view(day, code, Date.now()),
    publicView: (code) => Core.publicView(day, code, Date.now()),
    codesInUse: () => Object.keys(day.counters),
    isPersistent: () => connected,
    subscribe
  };
})();
