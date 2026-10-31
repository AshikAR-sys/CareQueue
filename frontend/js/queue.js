// Browser adapter for the CareQueue API. Queue data is stored by SQLite on the server.
(function () {
  "use strict";
  const Core = window.QueueCore;
  const listeners = new Set();
  // Only the staff console may load patient details; every other page (patient, display, track, reports) gets the
  // public state.
  const isStaffScreen = document.body.classList.contains("screen-staff") && !document.body.classList.contains("screen-reports");
  let day = Core.emptyDay(Core.dayKey(new Date()));
  let connected = false;
  let refreshInFlight = null;

  // QA fix 3: staff requests carry the staff pass from sign-in. If the server refuses it (expired, or the server
  // restarted with a new key), the staff console goes back to the sign-in page.
  function headers(extra) {
    const token = window.CareAuth ? window.CareAuth.staffToken() : "";
    return Object.assign({}, extra, token ? { Authorization: "Bearer " + token } : {});
  }

  function signInAgain() {
    if (window.CareAuth) window.CareAuth.clear();
    window.location.replace("index.html");
  }

  async function refresh(force = false) {
    if (refreshInFlight) {
      if (!force) return refreshInFlight;
      await refreshInFlight;
    }
    refreshInFlight = (async () => {
      try {
        const path = isStaffScreen ? "/api/queue/state" : "/api/queue/public-state";
        const response = await fetch(path, { cache: "no-store", headers: headers() });
        if (response.status === 401 && isStaffScreen) return signInAgain();
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
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body || {})
    });
    if (response.status === 401) { signInAgain(); throw new Error("Please sign in as staff again."); }
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
      priority: details.priority || null,
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

  // US-11: every queue action is for one service counter (Counter 1 unless given).
  async function callNext(code, counter = 1) {
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/call-next", { counter });
    await refresh(true);
    return result.token;
  }

  async function skip(code, counter = 1) {
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/skip", { counter });
    await refresh(true);
    return result.token;
  }

  // US-04 Send to Billing: finish the patient being served in fromCode and add them to toCode.
  async function sendTo(fromCode, toCode, counter = 1) {
    const result = await request("/api/queue/" + encodeURIComponent(fromCode) + "/send-to/" + encodeURIComponent(toCode), { counter });
    await refresh(true);
    return result.token;
  }

  async function recall(number, counter = 1) {
    const result = await request("/api/tokens/" + encodeURIComponent(number) + "/recall", { counter });
    await refresh(true);
    return result.token;
  }

  // US-21: post a doctor delay notice for a queue, or clear it (reason null).
  async function setDelay(code, reason, minutes) {
    const body = reason ? { reason, minutes } : { clear: true };
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/delay", body);
    await refresh(true);
    return result.delay;
  }

  // US-20: a patient's 1-5 star rating of their finished visit (no sign-in).
  async function rate(number, rating) {
    const result = await request("/api/tokens/" + encodeURIComponent(number) + "/rating", { rating });
    await refresh(true);
    return result.token;
  }

  async function setCounter(code, counter, open) {
    const result = await request("/api/queue/" + encodeURIComponent(code) + "/counters/" + counter, { open });
    await refresh(true);
    return result.openCounters;
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
    setCounter,
    rate,
    setDelay,
    delay: (code) => Core.delayIn(day, code, Date.now()),
    estimate: (number) => Core.estimate(day, number, Date.now()),
    view: (code, counter) => Core.view(day, code, Date.now(), counter),
    publicView: (code) => Core.publicView(day, code, Date.now()),
    codesInUse: () => Object.keys(day.counters),
    day: () => day,
    isPersistent: () => connected,
    subscribe
  };
})();
