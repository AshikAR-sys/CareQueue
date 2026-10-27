(function () {
  "use strict";

  // Auth guard: redirect to login if no receptionist session.
  if (window.CareAuth && !window.CareAuth.guard("receptionist")) return;

  const { DATA, time, startClock, deptByCode, minutes, el } = window.Screens;
  const Q = window.TokenQueue;
  const $ = (id) => document.getElementById(id);
  const PREF_KEY = "carequeue-staff-dept";
  const BILLING = DATA.departments.find((d) => d.billing) || null;   // US-04: the queue patients are sent on to

  let code = readPref() || DATA.departments[0].code;
  let lastSignature = "";

  function readPref(key = PREF_KEY) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writePref(c, key = PREF_KEY) { try { localStorage.setItem(key, c); } catch (e) { /* per-tab only */ } }

  // US-11: the counter this receptionist works at, remembered per department (Counter 1 by default).
  function counterKey() { return PREF_KEY + "-counter-" + code; }
  function myCounter() {
    const n = Number(readPref(counterKey()));
    return n >= 1 && n <= window.QueueCore.MAX_COUNTERS ? n : 1;
  }

  function patientLine(p) {
    if (!p) return "";
    const bits = [p.name];
    if (p.age !== "" && p.age != null) bits.push(p.age + " y");
    if (p.gender) bits.push(p.gender);
    return bits.join(", ");
  }

  // "from G001" on a token that was sent on from another queue (AC-04.2).
  function fromText(t) { return t && t.linkedFrom ? " · from " + t.linkedFrom : ""; }

  function renderTabs() {
    const box = $("dept-tabs");
    box.textContent = "";
    for (const d of DATA.departments) {
      const v = Q.view(d.code);
      const b = el("button", "dept-tab");
      b.type = "button";
      b.setAttribute("aria-pressed", String(d.code === code));
      b.dataset.code = d.code;
      b.append(el("span", "dept-tab-name", d.name), el("span", "dept-tab-count", String(v.waiting.length)));
      b.setAttribute("aria-label", d.name + ", " + v.waiting.length + " waiting");
      b.addEventListener("click", () => { code = d.code; writePref(code); render(true); });
      box.append(b);
    }
  }

  function render(force) {
    const now = Date.now();
    const counter = myCounter();
    const v = Q.view(code, counter);
    const allCounts = DATA.departments.map((d) => Q.view(d.code).waiting.length).join(",");
    // Rebuild only when something visible changed, so keyboard focus is not lost every second.
    const signature = JSON.stringify([code, counter, v.counters.map((c) => [c.open, c.serving && c.serving.number]),
      allCounts, v.serving && v.serving.number, v.waiting.map((t) => t.number + t.minutes),
      v.missed.map((t) => t.number), v.served, Math.floor(now / 60000)]);
    if (!force && signature === lastSignature) return;
    const focusedId = document.activeElement && document.activeElement.id;
    const focusedCode = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.code;
    lastSignature = signature;

    const dept = deptByCode(code);
    renderTabs();
    $("serving-dept").textContent = dept.name;
    $("serving-counter").textContent = "Counter " + counter;
    renderCounters(v, counter);
    const paused = !v.counters[counter - 1].open;

    if (v.serving) {
      $("serving-number").textContent = v.serving.number;
      $("serving-number").classList.remove("empty");
      $("serving-name").textContent = patientLine(v.serving.patient) || "Patient";
      const since = minutes(now - v.serving.calledAt);
      $("serving-meta").textContent = "Called at " + time(new Date(v.serving.calledAt)) + " · " + since + " min at the counter" +
        (v.serving.patient && v.serving.patient.doctor ? " · " + v.serving.patient.doctor : "") + fromText(v.serving);
    } else {
      $("serving-number").textContent = "—";
      $("serving-number").classList.add("empty");
      $("serving-name").textContent = paused ? "Counter " + counter + " is paused" : v.waiting.length ? "No one is being served" : "No one is waiting";
      $("serving-meta").textContent = paused ? "Open it to call patients here." :
        v.waiting.length ? "Press Call Next to call " + v.waiting[0].number + "." : "New tokens from the token page appear here.";
    }

    const callBtn = $("call-next");
    callBtn.disabled = paused || (!v.serving && v.waiting.length === 0);
    callBtn.querySelector(".btn-label").textContent = v.waiting.length ? "Call Next · " + v.waiting[0].number : (v.serving ? "Finish " + v.serving.number : "Call Next");
    $("skip").disabled = !v.serving;
    $("skip").title = v.serving ? "Move " + v.serving.number + " to Missed" : "Nobody is being served";
    const sendBtn = $("send-billing");
    const canSend = !!BILLING && code !== BILLING.code;
    sendBtn.hidden = !canSend;
    sendBtn.closest(".serving-actions").classList.toggle("no-billing", !canSend);
    sendBtn.disabled = !v.serving;
    sendBtn.title = v.serving ? "Finish " + v.serving.number + " here and add the patient to Billing" : "Nobody is being served";

    $("stat-waiting").textContent = String(v.waiting.length);
    $("stat-served").textContent = String(v.served);
    const ast = $("stat-ast");
    ast.textContent = (Math.round(v.averageServiceMs / 6000) / 10) + " min ";
    if (v.served < 3) ast.append(el("small", null, "default"));

    const rows = $("waiting-rows");
    rows.textContent = "";
    if (!v.waiting.length) {
      const tr = el("tr", "empty-row"); const td = el("td", null, "No one is waiting.");
      td.colSpan = 5; tr.append(td); rows.append(tr);
    }
    v.waiting.forEach((t, i) => {
      const tr = el("tr");
      tr.append(el("td", "num", String(i + 1)), el("td", "token", t.number), el("td", null, patientLine(t.patient) + fromText(t)),
        el("td", "num", minutes(now - t.createdAt) + " min"), el("td", "num", t.minutes === 0 ? "Next" : t.minutes + " min"));
      rows.append(tr);
    });

    const missed = $("missed-rows");
    missed.textContent = "";
    $("missed-card").hidden = v.missed.length === 0;
    for (const t of v.missed) {
      const tr = el("tr");
      const btn = el("button", "text-btn recall-btn", "Recall");
      btn.type = "button"; btn.id = "recall-" + t.number;
      btn.addEventListener("click", () => act(() => Q.recall(t.number, myCounter()), (r) => r ? "Recalled " + r.number + " to Counter " + r.counter + "." : ""));
      const td = el("td", "num"); td.append(btn);
      tr.append(el("td", "token", t.number), el("td", null, patientLine(t.patient)), el("td", "num", time(new Date(t.skippedAt))), td);
      missed.append(tr);
    }

    // Put focus back where it was after a rebuild.
    if (focusedId && $(focusedId) && document.activeElement !== $(focusedId)) $(focusedId).focus();
    else if (focusedCode) { const t = document.querySelector('.dept-tab[data-code="' + focusedCode + '"]'); if (t) t.focus(); }
  }

  // Counter chips: pick your counter; each shows its patient, "Free" or "Paused". The link opens or pauses it.
  function renderCounters(v, counter) {
    const box = $("counter-chips");
    box.textContent = "";
    for (const c of v.counters) {
      const b = el("button", "counter-chip" + (c.open ? "" : " paused"));
      b.type = "button";
      b.id = "counter-" + c.counter;
      b.setAttribute("aria-pressed", String(c.counter === counter));
      const status = !c.open ? "Paused" : c.serving ? c.serving.number : "Free";
      b.append(el("span", "counter-name", "Counter " + c.counter), el("span", "counter-status", status));
      b.addEventListener("click", () => { writePref(String(c.counter), counterKey()); $("serving-hint").textContent = ""; render(true); });
      box.append(b);
    }
    const toggle = $("counter-toggle");
    const mine = v.counters[counter - 1];
    toggle.textContent = (mine.open ? "Pause" : "Open") + " Counter " + counter;
    toggle.dataset.open = String(mine.open);
  }

  $("counter-toggle").addEventListener("click", () => {
    const counter = myCounter();
    const open = $("counter-toggle").dataset.open !== "true";
    act(() => Q.setCounter(code, counter, open), () => "Counter " + counter + (open ? " is open." : " is paused."));
  });

  // Queue actions go to the server and return promises: wait for the result before confirming it.
  async function act(fn, message) {
    try {
      const result = await fn();
      $("serving-hint").textContent = message(result) || "";
    } catch (error) {
      $("serving-hint").textContent = (error && error.message) || "The queue action failed. Try again.";
    }
    render(true);
  }

  $("call-next").addEventListener("click", () => act(() => Q.callNext(code, myCounter()),
    (r) => r ? "Called " + r.number + " to Counter " + r.counter + ". It is now on the display." : "No one is waiting."));
  $("skip").addEventListener("click", () => act(() => Q.skip(code, myCounter()),
    (r) => r ? r.number + " moved to Missed. Recall it when the patient arrives." : ""));
  $("send-billing").addEventListener("click", () => act(() => (BILLING ? Q.sendTo(code, BILLING.code, myCounter()) : null),
    (r) => r ? r.linkedFrom + " sent to Billing as " + r.number + "." : "Nobody is being served."));

  const session = window.CareAuth ? window.CareAuth.get() : null;
  const sessionChip = $("session-chip"), soBtn = $("signout-btn");
  if (session && sessionChip) { sessionChip.textContent = session.name || ""; sessionChip.style.display = ""; }
  if (soBtn) {
    soBtn.style.display = "";
    soBtn.addEventListener("click", () => { if (window.CareAuth) window.CareAuth.clear(); window.location.replace("index.html"); });
  }

  $("storage-note").hidden = Q.isPersistent();
  startClock();
  render(true);
  Q.subscribe(() => {
    $("storage-note").hidden = Q.isPersistent();
    render(false);
  });
})();
