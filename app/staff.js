(function () {
  "use strict";
  const { DATA, time, startClock, deptByCode, minutes, el } = window.Screens;
  const Q = window.TokenQueue;
  const $ = (id) => document.getElementById(id);
  const PREF_KEY = "careplus-staff-dept";

  let code = readPref() || DATA.departments[0].code;
  let lastSignature = "";

  function readPref() { try { return localStorage.getItem(PREF_KEY); } catch (e) { return null; } }
  function writePref(c) { try { localStorage.setItem(PREF_KEY, c); } catch (e) { /* per-tab only */ } }

  function patientLine(p) {
    if (!p) return "";
    const bits = [p.name];
    if (p.age !== "" && p.age != null) bits.push(p.age + " y");
    if (p.gender) bits.push(p.gender);
    return bits.join(", ");
  }

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
    const v = Q.view(code);
    const allCounts = DATA.departments.map((d) => Q.view(d.code).waiting.length).join(",");
    // Rebuild only when something visible changed, so keyboard focus is not lost every second.
    const signature = JSON.stringify([code, allCounts, v.serving && v.serving.number, v.waiting.map((t) => t.number + t.minutes),
      v.missed.map((t) => t.number), v.served, Math.floor(now / 60000)]);
    if (!force && signature === lastSignature) return;
    const focusedId = document.activeElement && document.activeElement.id;
    const focusedCode = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.code;
    lastSignature = signature;

    const dept = deptByCode(code);
    renderTabs();
    $("serving-dept").textContent = dept.name;

    if (v.serving) {
      $("serving-number").textContent = v.serving.number;
      $("serving-number").classList.remove("empty");
      $("serving-name").textContent = patientLine(v.serving.patient) || "Patient";
      const since = minutes(now - v.serving.calledAt);
      $("serving-meta").textContent = "Called at " + time(new Date(v.serving.calledAt)) + " · " + since + " min at the counter" +
        (v.serving.patient && v.serving.patient.doctor ? " · " + v.serving.patient.doctor : "");
    } else {
      $("serving-number").textContent = "—";
      $("serving-number").classList.add("empty");
      $("serving-name").textContent = v.waiting.length ? "No one is being served" : "No one is waiting";
      $("serving-meta").textContent = v.waiting.length ? "Press Call Next to call " + v.waiting[0].number + "." : "New tokens from the token page appear here.";
    }

    const callBtn = $("call-next");
    callBtn.disabled = !v.serving && v.waiting.length === 0;
    callBtn.querySelector(".btn-label").textContent = v.waiting.length ? "Call Next · " + v.waiting[0].number : (v.serving ? "Finish " + v.serving.number : "Call Next");
    $("skip").disabled = !v.serving;
    $("skip").title = v.serving ? "Move " + v.serving.number + " to Missed" : "Nobody is being served";

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
      tr.append(el("td", "num", String(i + 1)), el("td", "token", t.number), el("td", null, patientLine(t.patient)),
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
      btn.addEventListener("click", () => act(() => Q.recall(t.number), (r) => r ? "Recalled " + r.number + "." : ""));
      const td = el("td", "num"); td.append(btn);
      tr.append(el("td", "token", t.number), el("td", null, patientLine(t.patient)), el("td", "num", time(new Date(t.skippedAt))), td);
      missed.append(tr);
    }

    // Put focus back where it was after a rebuild.
    if (focusedId && $(focusedId) && document.activeElement !== $(focusedId)) $(focusedId).focus();
    else if (focusedCode) { const t = document.querySelector('.dept-tab[data-code="' + focusedCode + '"]'); if (t) t.focus(); }
  }

  function act(fn, message) {
    const result = fn();
    $("serving-hint").textContent = message(result) || "";
    render(true);
  }

  $("call-next").addEventListener("click", () => act(() => Q.callNext(code),
    (r) => r ? "Called " + r.number + ". It is now on the display." : "No one is waiting."));
  $("skip").addEventListener("click", () => act(() => Q.skip(code),
    (r) => r ? r.number + " moved to Missed. Recall it when the patient arrives." : ""));

  $("storage-note").hidden = Q.isPersistent();
  startClock();
  render(true);
  Q.subscribe(() => render(false));
})();
