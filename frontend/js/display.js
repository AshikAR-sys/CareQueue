(function () {
  "use strict";
  const { DATA, startClock, deptByCode, el } = window.Screens;
  const Q = window.TokenQueue;
  const I = window.CareQueueI18n;
  const grid = document.getElementById("display-grid");
  let lastSignature = "";
  const lastServing = {};

  // ---------- US-18 language: English or Tamil, remembered on this screen ----------
  let lang = I.load();
  const tr = (key, vars) => I.t(lang, key, vars);
  const deptName = (d) => I.deptName(lang, d.code, d.name);
  function waitWords(t) { return t.minutes === 0 ? tr("next.soon") : tr("about", { n: t.minutes }); }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.getElementById("display-title").textContent = tr("display.title");
    document.getElementById("display-foot").textContent = tr("display.foot");
    document.querySelectorAll(".lang-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    setSoundButton(A.isEnabled());
    updateVoiceNote();
    lastSignature = "";
    render();
  }

  document.querySelectorAll(".lang-switch button").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang;
    I.save(lang);
    applyLanguage();
  }));

  // Departments shown: those with tokens today, in the hospital's department order.
  function activeCodes() {
    const used = new Set(Q.codesInUse());
    return DATA.departments.map((d) => d.code).filter((c) => used.has(c));
  }

  function render() {
    const views = activeCodes().map((c) => Q.publicView(c));
    const signature = lang + JSON.stringify(views);
    if (signature === lastSignature) return;
    lastSignature = signature;

    grid.textContent = "";
    grid.dataset.count = String(views.length);
    if (!views.length) {
      const p = el("section", "glass display-empty");
      p.append(el("h2", null, tr("empty.title")), el("p", null, tr("empty.body")));
      grid.append(p);
      return;
    }
    for (const v of views) {
      const dept = deptByCode(v.code);
      const panel = el("section", "glass display-panel");
      panel.setAttribute("aria-label", deptName(dept));
      const head = el("div", "panel-head");
      head.append(el("h2", null, deptName(dept)), el("span", "panel-loc", I.place(lang, dept.location)));
      const now = el("div", "panel-now");
      now.append(el("p", "panel-label", tr("now")));
      // US-11: one slot per serving counter, each with its token number and counter.
      now.dataset.count = String(v.serving.length);
      if (!v.serving.length) now.append(el("p", "panel-number empty", tr("none.serving")));
      const slots = el("div", "serving-slots");
      for (const s of v.serving) {
        const key = v.code + "#" + s.counter;
        const slot = el("div", "serving-slot");
        const num = el("p", "panel-number", s.number);
        if (lastServing[key] && lastServing[key] !== s.number) num.classList.add("changed");
        lastServing[key] = s.number;
        slot.append(num, el("p", "panel-counter", tr("counter", { n: s.counter })));
        slots.append(slot);
      }
      if (v.serving.length) now.append(slots);

      const next = el("div", "panel-next");
      next.append(el("p", "panel-label", v.waitingCount > v.waiting.length ? tr("next.count", { n: v.waitingCount }) : tr("next")));
      const list = el("ol", "next-list");
      if (!v.waiting.length) list.append(el("li", "next-empty", tr("none.waiting")));
      for (const t of v.waiting) {
        const li = el("li");
        const num = el("span", "next-number", t.number);
        if (t.priority) num.append(el("span", "next-priority", tr("priority")));   // US-17: the mark only, never the reason
        li.append(num, el("span", "next-wait", waitWords(t)));
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
    soundBtn.querySelector(".sound-label").textContent = on ? tr("sound.on") : tr("sound.off");
    soundBtn.querySelector("use").setAttribute("href", on ? "#i-volume" : "#i-volume-off");
    soundBtn.title = on ? "Announcements are on. Press to mute." : "Press to hear each called token announced.";
  }
  soundBtn.addEventListener("click", () => {
    A.setEnabled(!A.isEnabled());
    setSoundButton(A.isEnabled());
    updateVoiceNote();
  });

  // AC-18.2: Tamil is spoken only if this device has a Tamil voice; otherwise the screen says calls are in English.
  function speechLang() { return lang === "ta" && A.hasVoice("ta") ? "ta" : "en"; }
  function updateVoiceNote() {
    const note = document.getElementById("voice-note");
    note.hidden = !(lang === "ta" && A.isEnabled() && !A.hasVoice("ta"));
    note.textContent = tr("voice.missing");
  }
  if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", updateVoiceNote);

  function announceNewCalls() {
    const snapshot = {};
    for (const d of DATA.departments) {
      for (const c of Q.view(d.code).counters) {
        const t = c.serving;
        snapshot[d.code + "#" + c.counter] = t ? { code: d.code, counter: c.counter, number: t.number, calledAt: t.calledAt } : null;
      }
    }
    // Skip the empty state before the first server response, so tokens already serving are not announced.
    const loaded = Q.codesInUse().length > 0 || Q.isPersistent();
    if (!loaded) return;
    for (const call of A.newCalls(lastCalls, snapshot)) {
      const d = deptByCode(call.code);
      if (speechLang() === "ta") A.announce(I.announcementTa(call.number, call.code, d.name, call.counter), "ta");
      else A.announce(A.announcementText(call.number, d.name, call.counter));
    }
    lastCalls = snapshot;
  }

  startClock();
  applyLanguage();
  Q.subscribe(() => { render(); announceNewCalls(); });
})();
