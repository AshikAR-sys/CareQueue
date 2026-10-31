// Queue rules for CareQueue, shared by the token page, the staff console and the display.
// Pure functions over one day's record; storage lives in queue.js. Works in the browser
// (window.QueueCore) and in Node for the tests (module.exports).
//
// A day record: { date: "YYYY-MM-DD", counters: { G: 3 }, openCounters: { G: [1, 2] }, tokens: [Token] }
//   counters     = the last token number issued per queue today
//   openCounters = the service counters open per queue (US-11); a queue not listed has Counter 1 open
//   delays       = a doctor delay notice per queue (US-21): { reason, until }, until = when it ends (ms)
// A token:      { number, code, seq, status, counter, priority, patient, createdAt, calledAt, doneAt }
// status: "waiting" -> "serving" -> "done", or "serving" -> "missed" -> "serving" (recall)
// counter: the service counter that called the token (1-3)
// priority: null, or why the patient is seen first (US-17): "senior" | "pregnant" | "emergency"
// rating: null, or the patient's 1-5 star rating of a finished visit (US-20)
// estimateMin: the wait estimate (minutes) shown when the token was issued, saved by the server (US-24)
// awayUntil: null, or until when a waiting patient has stepped out (US-22); once set, it stays (one step-out each)
(function (root) {
  "use strict";

  const DEFAULT_AST_MS = 3 * 60 * 1000; // PRD: default service time until 3 tokens are served
  const MIN_SERVED_FOR_AVERAGE = 3;
  const AVERAGE_WINDOW = 10;           // PRD: average of the last 10 served
  const ALMOST_AHEAD = 2;              // US-13: "Almost your turn" when 2 or fewer patients are ahead
  const MAX_COUNTERS = 3;              // US-11: up to 3 service counters per queue
  const PRIORITY_LABELS = { senior: "Senior citizen", pregnant: "Pregnant", emergency: "Emergency" }; // US-17

  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function emptyDay(date) {
    return { date, counters: {}, openCounters: {}, tokens: [] };
  }

  function inQueue(day, code) { return day.tokens.filter((t) => t.code === code); }
  // The waiting line in calling order: priority tokens first (US-17), then the rest, each in issue order.
  function waitingIn(day, code) {
    return day.tokens.filter((t) => t.code === code && t.status === "waiting")
      .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.seq - b.seq);
  }
  function counterOf(t) { return t.counter || 1; }   // tokens called before US-11 have no counter
  function servingAll(day, code) {
    return day.tokens.filter((t) => t.code === code && t.status === "serving").sort((a, b) => counterOf(a) - counterOf(b));
  }
  // US-22: a waiting patient who stepped out is passed over by Call Next until they are back.
  function isAway(t, now) { return !!t.awayUntil && t.awayUntil > now; }
  function nextUp(day, code, now) { return waitingIn(day, code).find((t) => !isAway(t, now)) || null; }

  function servingAt(day, code, counter) { return servingAll(day, code).find((t) => counterOf(t) === counter) || null; }

  function openCounters(day, code) {
    const open = day.openCounters && day.openCounters[code];
    return open && open.length ? open.slice().sort((a, b) => a - b) : [1];
  }

  function checkCounter(counter) {
    if (!Number.isInteger(counter) || counter < 1 || counter > MAX_COUNTERS) throw new Error("Choose Counter 1, 2 or 3.");
  }

  function checkOpen(day, code, counter) {
    checkCounter(counter);
    if (!openCounters(day, code).includes(counter)) throw new Error("Counter " + counter + " is paused. Open it to call patients.");
  }

  // Opens or pauses a counter. A counter serving a patient cannot be paused, and one counter always stays open.
  function setCounter(day, code, counter, open) {
    checkCounter(counter);
    const current = openCounters(day, code);
    let next;
    if (open) {
      next = current.includes(counter) ? current : current.concat(counter).sort((a, b) => a - b);
    } else {
      const serving = servingAt(day, code, counter);
      if (serving && current.includes(counter)) throw new Error(serving.number + " is at Counter " + counter + ". Finish or skip it before pausing.");
      next = current.filter((c) => c !== counter);
      if (!next.length) throw new Error("Keep at least one counter open.");
    }
    day.openCounters = Object.assign({}, day.openCounters, { [code]: next });
    return next;
  }

  function issue(day, { code, patient, priority }, now) {
    const seq = (day.counters[code] || 0) + 1;
    if (seq > 999) throw new Error("Today's token limit for this department has been reached.");
    day.counters[code] = seq;
    const token = {
      number: code + String(seq).padStart(3, "0"),
      code, seq, status: "waiting", counter: null, priority: priority || null,
      patient: patient || null,
      createdAt: now, calledAt: null, doneAt: null
    };
    day.tokens.push(token);
    return token;
  }

  function completeAt(day, code, counter, now) {
    const current = servingAt(day, code, counter);
    if (current) { current.status = "done"; current.doneAt = now; }
  }

  // Calls the next waiting token to a counter; the patient at that counter is completed first.
  function callNext(day, code, now, counter = 1) {
    checkOpen(day, code, counter);
    completeAt(day, code, counter, now);
    const next = nextUp(day, code, now);
    if (!next) return null;
    next.status = "serving";
    next.calledAt = now;
    next.counter = counter;
    return next;
  }

  function skip(day, code, now, counter = 1) {
    const current = servingAt(day, code, counter);
    if (!current) return null;
    current.status = "missed";
    current.doneAt = null;
    current.skippedAt = now;
    return current;
  }

  // Send to Billing (US-04): the patient at a counter is completed there and joins the end of another queue
  // (Billing) with a new token carrying the same patient details. The two tokens are linked.
  function sendTo(day, fromCode, toCode, now, counter = 1) {
    if (fromCode === toCode) return null;
    const current = servingAt(day, fromCode, counter);
    if (!current) return null;
    const patient = current.patient ? Object.assign({}, current.patient, { doctor: "" }) : null;
    const next = issue(day, { code: toCode, patient, priority: current.priority }, now);
    next.linkedFrom = current.number;
    current.status = "done";
    current.doneAt = now;
    current.forwardedTo = next.number;
    return next;
  }

  // Recalls a missed token to a counter; the patient at that counter is completed first.
  function recall(day, number, now, counter = 1) {
    const token = day.tokens.find((t) => t.number === number && t.status === "missed");
    if (!token) return null;
    checkOpen(day, token.code, counter);
    completeAt(day, token.code, counter, now);
    token.status = "serving";
    token.calledAt = now;
    token.counter = counter;
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

  // US-21: the delay notice of a queue while it lasts, with whole minutes left (rounded up), or null.
  function delayIn(day, code, now) {
    const d = day.delays && day.delays[code];
    if (!d || d.until <= now) return null;
    return { reason: d.reason, minutesLeft: Math.ceil((d.until - now) / 60000) };
  }

  // EWT = R + (N / C) x AST (PRD M3 + S5), rounded up to the minute. C = open counters; R = time until the first
  // open counter is free (0 if one is idle); N = tokens ahead.
  function estimate(day, number, now) {
    const token = day.tokens.find((t) => t.number === number);
    if (!token) return null;
    if (token.status === "serving") return { status: "serving", counter: counterOf(token) };
    if (token.status !== "waiting") {
      return token.forwardedTo ? { status: token.status, forwardedTo: token.forwardedTo } : { status: token.status };
    }
    const ast = averageServiceMs(day, token.code);
    const ahead = waitingIn(day, token.code).indexOf(token);
    const open = openCounters(day, token.code);
    const left = open.map((c) => {
      const current = servingAt(day, token.code, c);
      return current ? Math.max(0, ast - (now - current.calledAt)) : 0;
    });
    const remaining = Math.min(...left);
    const d = day.delays && day.delays[token.code];
    const delayMs = d ? Math.max(0, d.until - now) : 0;   // US-21: the doctor's delay comes first
    const minutes = Math.ceil((delayMs + remaining + ahead / open.length * ast) / 60000);
    return { status: "waiting", ahead, minutes };
  }

  // Everything a staff screen needs for one queue, seen from one counter (serving = the patient at that counter).
  function view(day, code, now, counter = 1) {
    const open = openCounters(day, code);
    const all = servingAll(day, code);
    return {
      code,
      counter,
      serving: servingAt(day, code, counter),
      servingAll: all,
      next: nextUp(day, code, now),           // US-22: the first waiting patient who has not stepped out
      counters: Array.from({ length: MAX_COUNTERS }, (_, i) => ({
        counter: i + 1, open: open.includes(i + 1), serving: servingAt(day, code, i + 1)
      })),
      waiting: waitingIn(day, code).map((t) => Object.assign({}, t, estimate(day, t.number, now))),
      missed: inQueue(day, code).filter((t) => t.status === "missed"),
      served: inQueue(day, code).filter((t) => t.status === "done").length,
      averageServiceMs: averageServiceMs(day, code)
    };
  }

  // What the waiting-room display may show: token numbers, counters and estimates, no patient details.
  function publicView(day, code, now, limit = 5) {
    const v = view(day, code, now);
    return {
      code,
      serving: v.servingAll.map((t) => ({ number: t.number, counter: counterOf(t) })),
      openCounters: openCounters(day, code),
      delay: delayIn(day, code, now),
      waiting: v.waiting.slice(0, limit).map((t) => ({ number: t.number, minutes: t.minutes, priority: !!t.priority, away: isAway(t, now) })),
      waitingCount: v.waiting.length
    };
  }

  // What a patient's phone may show for one token (US-13): no patient details, only numbers and the estimate.
  function track(day, number, now) {
    const token = day.tokens.find((t) => t.number === number);
    if (!token) return null;
    const result = Object.assign(
      { number, code: token.code, serving: servingAll(day, token.code).map((t) => t.number), delay: delayIn(day, token.code, now) },
      estimate(day, number, now)
    );
    result.almost = result.status === "waiting" && result.ahead <= ALMOST_AHEAD;
    // US-20: a finished visit can be rated once; a patient sent on to Billing rates at the end, on the billing token.
    result.rating = token.rating || null;
    result.canRate = token.status === "done" && !token.forwardedTo && !token.rating;
    result.awayUntil = token.awayUntil || null;
    result.away = isAway(token, now);
    result.canStepOut = token.status === "waiting" && !token.awayUntil;
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

  // US-24 / PRD success metric: share of estimates within 5 minutes of the real wait (issue -> call), counted from
  // the 4th token of each queue on ("after the first 3 tokens").
  const ACCURACY_TARGET = 80;
  const ACCURACY_MARGIN_MIN = 5;
  function accuracy(tokens) {
    const checked = tokens.filter((t) => t.seq > 3 && t.estimateMin != null && t.calledAt != null);
    const within = checked.filter((t) => Math.abs((t.calledAt - t.createdAt) / 60000 - t.estimateMin) <= ACCURACY_MARGIN_MIN);
    return {
      accuracyChecked: checked.length,
      accuracyWithin: within.length,
      accuracyPct: checked.length ? Math.round(within.length / checked.length * 100) : null
    };
  }

  function summarise(tokens) {
    const rated = tokens.filter((t) => t.rating).map((t) => t.rating);
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
      avgServiceMin: averageMin(finished.map((t) => t.doneAt - t.calledAt)),
      ratingCount: rated.length,
      avgRating: rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length * 10) / 10 : null,
      ...accuracy(tokens)
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
    return { departments, total, hours, busiest, accuracyTarget: ACCURACY_TARGET };
  }

  function reportCsv(rep, nameOf) {
    const cell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const row = (name, code, r) => [name, code, r.issued, r.served, r.waiting, r.serving, r.missed, r.sentToBilling,
      r.avgWaitMin, r.avgServiceMin, r.avgRating, r.ratingCount, r.accuracyPct, r.accuracyChecked].map(cell).join(",");
    const lines = ["Department,Code,Issued,Served,Waiting,Serving,Missed,Sent to Billing,Average wait (min),Average service (min)," +
      "Average rating (1-5),Ratings,Estimates within 5 min (%),Estimates checked"];
    for (const d of rep.departments) lines.push(row(nameOf(d.code), d.code, d));
    lines.push(row("Total", "", rep.total));
    return lines.join("\n") + "\n";
  }

  // ---------- US-25 best time to visit: usual tokens per hour from earlier days ----------
  const MIN_HISTORY_DAYS = 3;

  // rows: [code, createdAt, date] for tokens issued on earlier days (numbers only, no patient details).
  // Per department: the average tokens per hour over the days on record (a day with none in an hour counts as 0),
  // the two quietest hours and the busiest hour. hourOf turns a time into the local hour; tests pass a fixed zone.
  function bestTimes(rows, hourOf = (ms) => new Date(ms).getHours()) {
    const days = new Set(rows.map((r) => r[2])).size;
    const counts = {};
    for (const [code, createdAt] of rows) {
      const h = hourOf(createdAt);
      counts[code] = counts[code] || {};
      counts[code][h] = (counts[code][h] || 0) + 1;
    }
    const departments = {};
    for (const [code, byHour] of Object.entries(counts)) {
      const used = Object.keys(byHour).map(Number);
      const hours = [];
      for (let h = Math.min(...used); h <= Math.max(...used); h++) {
        hours.push({ hour: h, avg: Math.round((byHour[h] || 0) / days * 10) / 10 });
      }
      const byQuiet = hours.slice().sort((a, b) => a.avg - b.avg || a.hour - b.hour);
      const byBusy = hours.slice().sort((a, b) => b.avg - a.avg || a.hour - b.hour);
      departments[code] = {
        hours,
        quietest: byQuiet.slice(0, 2).map((h) => h.hour).sort((a, b) => a - b),
        busiest: byBusy[0].hour
      };
    }
    return { days, enough: days >= MIN_HISTORY_DAYS, departments };
  }

  const api = { bestTimes, DEFAULT_AST_MS, MAX_COUNTERS, PRIORITY_LABELS, delayIn, nextUp, openCounters, setCounter, dayKey, emptyDay, issue, callNext, skip, recall, sendTo, averageServiceMs, estimate, view, publicView, track, trackPath, report, reportCsv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QueueCore = api;
})(typeof window !== "undefined" ? window : globalThis);
