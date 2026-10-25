(function () {
  "use strict";
  const { DATA, startClock, deptByCode, waitWords, el } = window.Screens;
  const Q = window.TokenQueue;
  const grid = document.getElementById("display-grid");
  let lastSignature = "";
  const lastServing = {};

  // Departments shown: those with tokens today, in the hospital's department order.
  function activeCodes() {
    const used = new Set(Q.codesInUse());
    return DATA.departments.map((d) => d.code).filter((c) => used.has(c));
  }

  function render() {
    const views = activeCodes().map((c) => Q.publicView(c));
    const signature = JSON.stringify(views);
    if (signature === lastSignature) return;
    lastSignature = signature;

    grid.textContent = "";
    grid.dataset.count = String(views.length);
    if (!views.length) {
      const p = el("section", "glass display-empty");
      p.append(el("h2", null, "No tokens issued yet today"), el("p", null, "Get your token at the reception desk or on the token page."));
      grid.append(p);
      return;
    }
    for (const v of views) {
      const dept = deptByCode(v.code);
      const panel = el("section", "glass display-panel");
      panel.setAttribute("aria-label", dept.name);
      const head = el("div", "panel-head");
      head.append(el("h2", null, dept.name), el("span", "panel-loc", dept.location));
      const now = el("div", "panel-now");
      now.append(el("p", "panel-label", "Now serving"));
      const num = el("p", "panel-number" + (v.serving ? "" : " empty"), v.serving || "No patients being served");
      if (v.serving && lastServing[v.code] && lastServing[v.code] !== v.serving) num.classList.add("changed");
      lastServing[v.code] = v.serving;
      now.append(num);

      const next = el("div", "panel-next");
      next.append(el("p", "panel-label", v.waitingCount ? "Next" + (v.waitingCount > v.waiting.length ? " (" + v.waitingCount + " waiting)" : "") : "Next"));
      const list = el("ol", "next-list");
      if (!v.waiting.length) list.append(el("li", "next-empty", "No one waiting"));
      for (const t of v.waiting) {
        const li = el("li");
        li.append(el("span", "next-number", t.number), el("span", "next-wait", waitWords(t)));
        list.append(li);
      }
      next.append(list);
      panel.append(head, now, next);
      grid.append(panel);
    }
  }

  // ---------- US-08 voice announcements ----------
  const A = window.CareQueueAnnouncer;
  const soundBtn = document.getElementById("sound-toggle");
  let lastCalls = null;   // previous snapshot; null until the first queue state arrives (opening is silent)

  function setSoundButton(on) {
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.querySelector(".sound-label").textContent = on ? "Sound on" : "Turn on sound";
    soundBtn.querySelector("use").setAttribute("href", on ? "#i-volume" : "#i-volume-off");
    soundBtn.title = on ? "Announcements are on. Press to mute." : "Press to hear each called token announced.";
  }
  soundBtn.addEventListener("click", () => {
    A.setEnabled(!A.isEnabled());
    setSoundButton(A.isEnabled());
  });
  setSoundButton(false);

  function announceNewCalls() {
    const snapshot = {};
    for (const d of DATA.departments) {
      const serving = Q.view(d.code).serving;
      snapshot[d.code] = serving ? { number: serving.number, calledAt: serving.calledAt } : null;
    }
    // Skip the empty state before the first server response, so tokens already serving are not announced.
    const loaded = Q.codesInUse().length > 0 || Q.isPersistent();
    if (!loaded) return;
    for (const call of A.newCalls(lastCalls, snapshot)) {
      A.announce(A.announcementText(call.number, deptByCode(call.code).name));
    }
    lastCalls = snapshot;
  }

  startClock();
  render();
  Q.subscribe(() => { render(); announceNewCalls(); });
})();
