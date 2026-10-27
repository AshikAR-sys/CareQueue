// Queue rules for CareQueue, shared by the token page, the staff console and the display.
// Pure functions over one day's record; storage lives in queue.js. Works in the browser
// (window.QueueCore) and in Node for the tests (module.exports).
//
// A day record: { date: "YYYY-MM-DD", counters: { G: 3 }, tokens: [Token] }
// A token:      { number, code, seq, status, patient, createdAt, calledAt, doneAt }
// status: "waiting" -> "serving" -> "done", or "serving" -> "missed" -> "serving" (recall)
(function (root) {
  "use strict";

  const DEFAULT_AST_MS = 3 * 60 * 1000; // PRD: default service time until 3 tokens are served
  const MIN_SERVED_FOR_AVERAGE = 3;
  const AVERAGE_WINDOW = 10;           // PRD: average of the last 10 served
  const ALMOST_AHEAD = 2;              // US-13: "Almost your turn" when 2 or fewer patients are ahead

  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function emptyDay(date) {
    return { date, counters: {}, tokens: [] };
  }

  function inQueue(day, code) { return day.tokens.filter((t) => t.code === code); }
  function servingIn(day, code) { return day.tokens.find((t) => t.code === code && t.status === "serving") || null; }
  function waitingIn(day, code) { return day.tokens.filter((t) => t.code === code && t.status === "waiting"); }

  function issue(day, { code, patient }, now) {
    const seq = (day.counters[code] || 0) + 1;
    if (seq > 999) throw new Error("Today's token limit for this department has been reached.");
    day.counters[code] = seq;
    const token = {
      number: code + String(seq).padStart(3, "0"),
      code, seq, status: "waiting",
      patient: patient || null,
      createdAt: now, calledAt: null, doneAt: null
    };
    day.tokens.push(token);
    return token;
  }

  function completeCurrent(day, code, now) {
    const current = servingIn(day, code);
    if (current) { current.status = "done"; current.doneAt = now; }
  }

  // Calls the next waiting token; the patient being served is completed first.
  function callNext(day, code, now) {
    completeCurrent(day, code, now);
    const next = waitingIn(day, code)[0];
    if (!next) return null;
    next.status = "serving";
    next.calledAt = now;
    return next;
  }

  function skip(day, code, now) {
    const current = servingIn(day, code);
    if (!current) return null;
    current.status = "missed";
    current.doneAt = null;
    current.skippedAt = now;
    return current;
  }

  // Send to Billing (US-04): the patient being served in one queue is completed there and joins the end of
  // another queue (Billing) with a new token carrying the same patient details. The two tokens are linked.
  function sendTo(day, fromCode, toCode, now) {
    if (fromCode === toCode) return null;
    const current = servingIn(day, fromCode);
    if (!current) return null;
    const patient = current.patient ? Object.assign({}, current.patient, { doctor: "" }) : null;
    const next = issue(day, { code: toCode, patient }, now);
    next.linkedFrom = current.number;
    current.status = "done";
    current.doneAt = now;
    current.forwardedTo = next.number;
    return next;
  }

  function recall(day, number, now) {
    const token = day.tokens.find((t) => t.number === number && t.status === "missed");
    if (!token) return null;
    completeCurrent(day, token.code, now);
    token.status = "serving";
    token.calledAt = now;
    return token;
  }

  function averageServiceMs(day, code) {
    const served = inQueue(day, code)
      .filter((t) => t.status === "done" && t.calledAt != null && t.doneAt != null)
      .sort((a, b) => a.doneAt - b.doneAt);
    if (served.length < MIN_SERVED_FOR_AVERAGE) return DEFAULT_AST_MS;
    const recent = served.slice(-AVERAGE_WINDOW);
    return recent.reduce((sum, t) => sum + (t.doneAt - t.calledAt), 0) / recent.length;
  }

  // EWT = R + N x AST (PRD M3), rounded up to the minute. One counter per queue.
  function estimate(day, number, now) {
    const token = day.tokens.find((t) => t.number === number);
    if (!token) return null;
    if (token.status === "serving") return { status: "serving" };
    if (token.status !== "waiting") {
      return token.forwardedTo ? { status: token.status, forwardedTo: token.forwardedTo } : { status: token.status };
    }
    const ast = averageServiceMs(day, token.code);
    const queue = waitingIn(day, token.code);
    const ahead = queue.indexOf(token);
    const current = servingIn(day, token.code);
    const remaining = current ? Math.max(0, ast - (now - current.calledAt)) : 0;
    const minutes = Math.ceil((remaining + ahead * ast) / 60000);
    return { status: "waiting", ahead, minutes };
  }

  // Everything a staff screen needs for one queue.
  function view(day, code, now) {
    return {
      code,
      serving: servingIn(day, code),
      waiting: waitingIn(day, code).map((t) => Object.assign({}, t, estimate(day, t.number, now))),
      missed: inQueue(day, code).filter((t) => t.status === "missed"),
      served: inQueue(day, code).filter((t) => t.status === "done").length,
      averageServiceMs: averageServiceMs(day, code)
    };
  }

  // What the waiting-room display may show: token numbers and estimates, no patient details.
  function publicView(day, code, now, limit = 5) {
    const v = view(day, code, now);
    return {
      code,
      serving: v.serving ? v.serving.number : null,
      waiting: v.waiting.slice(0, limit).map((t) => ({ number: t.number, minutes: t.minutes })),
      waitingCount: v.waiting.length
    };
  }

  // What a patient's phone may show for one token (US-13): no patient details, only numbers and the estimate.
  function track(day, number, now) {
    const token = day.tokens.find((t) => t.number === number);
    if (!token) return null;
    const current = servingIn(day, token.code);
    const result = Object.assign(
      { number, code: token.code, serving: current ? current.number : null },
      estimate(day, number, now)
    );
    result.almost = result.status === "waiting" && result.ahead <= ALMOST_AHEAD;
    return result;
  }

  // The QR code on a token slip opens this page; the date tells a stale slip from today's token.
  function trackPath(number, date) {
    return "track.html?t=" + encodeURIComponent(number) + "&d=" + encodeURIComponent(date);
  }

  // ---------- Queue reports (US-15, US-16): today's figures, numbers only ----------
  // Mean of time spans in minutes, to one decimal place; null when there is nothing to average.
  function averageMin(spans) {
    if (!spans.length) return null;
    return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length / 60000 * 10) / 10;
  }

  function summarise(tokens) {
    const called = tokens.filter((t) => t.calledAt != null);
    const finished = tokens.filter((t) => t.status === "done" && t.calledAt != null && t.doneAt != null);
    const count = (status) => tokens.filter((t) => t.status === status).length;
    return {
      issued: tokens.length,
      served: count("done"),
      waiting: count("waiting"),
      serving: count("serving"),
      missed: count("missed"),
      sentToBilling: tokens.filter((t) => t.forwardedTo).length,
      avgWaitMin: averageMin(called.map((t) => t.calledAt - t.createdAt)),
      avgServiceMin: averageMin(finished.map((t) => t.doneAt - t.calledAt))
    };
  }

  // hourOf turns a timestamp into the local hour (0-23); the tests pass a fixed-zone version.
  function report(day, codes, hourOf = (ms) => new Date(ms).getHours()) {
    const departments = codes.map((code) => Object.assign({ code }, summarise(inQueue(day, code))));
    const total = summarise(day.tokens.filter((t) => codes.includes(t.code)));
    const perHour = {};
    for (const t of day.tokens) perHour[hourOf(t.createdAt)] = (perHour[hourOf(t.createdAt)] || 0) + 1;
    const used = Object.keys(perHour).map(Number);
    const hours = [];
    if (used.length) {
      for (let h = Math.min(...used); h <= Math.max(...used); h++) hours.push({ hour: h, count: perHour[h] || 0 });
    }
    const busiest = hours.reduce((best, h) => (!best || h.count > best.count ? h : best), null);
    return { departments, total, hours, busiest };
  }

  function reportCsv(rep, nameOf) {
    const cell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const row = (name, code, r) => [name, code, r.issued, r.served, r.waiting, r.serving, r.missed, r.sentToBilling,
      r.avgWaitMin, r.avgServiceMin].map(cell).join(",");
    const lines = ["Department,Code,Issued,Served,Waiting,Serving,Missed,Sent to Billing,Average wait (min),Average service (min)"];
    for (const d of rep.departments) lines.push(row(nameOf(d.code), d.code, d));
    lines.push(row("Total", "", rep.total));
    return lines.join("\n") + "\n";
  }

  const api = { DEFAULT_AST_MS, dayKey, emptyDay, issue, callNext, skip, recall, sendTo, averageServiceMs, estimate, view, publicView, track, trackPath, report, reportCsv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QueueCore = api;
})(typeof window !== "undefined" ? window : globalThis);
