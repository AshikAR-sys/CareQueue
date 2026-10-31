// Track My Token (US-13): the page a patient's phone opens from the QR code on the token slip.
// No sign-in. It reads the public queue state (numbers only) and updates itself every second.
// US-18: English or Tamil, chosen with the switch at the top and remembered on this phone.
(function () {
  "use strict";
  const { time, deptByCode } = window.Screens;
  const Core = window.QueueCore;
  const Q = window.TokenQueue;
  const I = window.CareQueueI18n;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(window.location.search);
  const number = (params.get("t") || "").trim().toUpperCase();
  const issuedOn = params.get("d") || "";
  const card = $("track-card");
  let lang = I.load();
  const tr = (key, vars) => I.t(lang, key, vars);

  // ---------- US-19 "your turn is near" alerts ----------
  const Al = window.CareQueueAlerts;
  const A = window.CareQueueAnnouncer;
  let alertWatch = null;          // set while alerts are on
  let alertBlocked = false;
  const baseTitle = document.title;

  function setAlertButton() {
    const on = !!alertWatch;
    $("alert-toggle").setAttribute("aria-pressed", String(on));
    setText("alert-label", on ? tr("alert.on") : tr("alert.off"));
    const note = $("alert-note");
    note.hidden = !on;
    note.textContent = alertBlocked ? tr("alert.note.blocked") : tr("alert.note.on");
  }

  $("alert-toggle").addEventListener("click", async () => {
    if (alertWatch) {
      alertWatch = null;
      document.title = baseTitle;
    } else {
      alertWatch = Al.watcher();
      A.chime();                                  // this press lets the browser play sound later
      const permission = await Al.enable();
      alertBlocked = permission !== "granted";
      render();                                   // the current state becomes the starting point
    }
    setAlertButton();
  });

  // ---------- US-22 hold my place while I step out ----------
  function renderStepOut(t) {
    const box = $("step-box");
    box.hidden = !(t && t.status === "waiting");
    if (box.hidden) return;
    setText("step-title", tr(t.canStepOut ? "step.title" : t.away ? "step.title.away" : "step.title.used"));
    $("step-choices").hidden = !t.canStepOut;
    $("step-back").hidden = !t.away;
    setText("step-back", tr("step.back"));
    $("step-choices").querySelectorAll("button").forEach((b) => { b.textContent = tr("step.min", { n: b.dataset.minutes }); });
    if (t.canStepOut) setText("step-help", tr("step.help"));
    else if (t.away) setText("step-help", tr("step.away", { time: time(new Date(t.awayUntil)) }));
    else setText("step-help", tr("step.used"));
    box.classList.toggle("away", t.away);
  }

  async function stepOut(minutes) {
    try { await Q.stepOut(number, minutes); } catch (err) { setText("step-help", (err && err.message) || ""); }
    render();
  }
  $("step-choices").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-minutes]");
    if (b) stepOut(Number(b.dataset.minutes));
  });
  $("step-back").addEventListener("click", () => stepOut(null));

  // ---------- US-23 share with family ----------
  let lastDeptName = "";
  $("share-btn").addEventListener("click", async () => {
    const S = window.CareQueueShare;
    const link = new URL(Core.trackPath(number, Q.day().date), window.location.href).href;
    const result = await S.share(S.shareData(lang, number, lastDeptName || number, link), navigator);
    const status = $("share-status");
    status.hidden = !(result === "copied" || result === "failed");
    if (!status.hidden) status.textContent = tr("share." + result);
  });

  // ---------- US-20 rate my visit ----------
  let rated = null;               // the rating this page just sent, shown before the next refresh

  function renderRating(t) {
    const box = $("rate-box");
    const rating = (t && t.rating) || rated;
    box.hidden = !(t && (t.canRate || rating));
    if (box.hidden) return;
    setText("rate-question", tr("rate.question"));
    box.querySelectorAll(".stars button").forEach((b) => {
      const n = Number(b.dataset.stars);
      b.disabled = !!rating;
      b.classList.toggle("on", !!rating && n <= rating);
      b.setAttribute("aria-label", tr("rate.star", { n }));
    });
    if (rating) setText("rate-msg", tr("rate.thanks", { n: rating }));
  }

  $("stars").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-stars]");
    if (!b || b.disabled) return;
    const n = Number(b.dataset.stars);
    try {
      await Q.rate(number, n);
      rated = n;
    } catch (err) {
      setText("rate-msg", (err && err.message) || tr("rate.failed"));
    }
    render();
  });

  function fireAlert(a, t, name) {
    const title = a.kind === "almost" ? tr("alert.almost.title", { token: number }) : tr("alert.turn.title", { token: number });
    const body = a.kind === "almost" ? tr("alert.almost.body", { dept: name, n: t.ahead }) : tr("alert.turn.body", { dept: name, counter: a.counter });
    A.chime();
    Al.notify(title, body);
    document.title = "🔔 " + title;
    card.classList.remove("alerting");
    void card.offsetWidth;                        // restart the flash animation
    card.classList.add("alerting");
  }

  function setText(id, text) { $(id).textContent = text; }

  function waitText(t) {
    if (t.minutes === 0) return tr("track.next");
    return tr("track.about", { n: t.minutes });
  }

  function show(state, { alert = "", wait = "–", ahead = "–", serving = "–" } = {}) {
    card.dataset.state = state;
    setText("track-serving", serving);
    setText("track-ahead", ahead);
    setText("track-wait", wait);
    $("track-alert").hidden = !alert;
    setText("track-alert-text", alert);
  }

  function message(state, text) {
    show(state);
    $("step-box").hidden = true;
    $("track-delay").hidden = true;
    $("rate-box").hidden = true;
    setText("track-dept", text);
    $("track-where").hidden = true;
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    setText("track-title", tr("track.title"));
    setText("label-serving", tr("track.serving"));
    setText("label-ahead", tr("track.ahead"));
    setText("label-wait", tr("track.wait"));
    setText("track-foot", tr("track.foot"));
    setText("share-label", tr("share.button"));
    setAlertButton();
    document.querySelectorAll(".lang-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    render();
  }

  document.querySelectorAll(".lang-switch button").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang;
    I.save(lang);
    applyLanguage();
  }));

  function render() {
    const live = $("track-live");
    live.textContent = Q.isPersistent() ? tr("track.live", { time: time(new Date()) }) : tr("track.reconnecting");
    live.classList.toggle("offline", !Q.isPersistent());
    setText("track-number", number || "···");
    if (!/^[A-Z]\d{3}$/.test(number)) return message("invalid", tr("track.invalid"));
    if (!Q.isPersistent()) return; // keep the last view until the server answers

    const day = Q.day();
    if (issuedOn && issuedOn !== day.date) return message("stale", tr("track.stale", { date: issuedOn }));
    const t = Core.track(day, number, Date.now());
    if (!t) return message("notfound", tr("track.notfound"));
    renderStepOut(t);
    const delay = $("track-delay");                        // US-21: the doctor delay notice
    delay.hidden = !(t.delay && t.status === "waiting");
    if (t.delay) delay.textContent = I.delayText(lang, t.delay);
    renderRating(t);

    const dept = deptByCode(t.code);
    const name = dept ? I.deptName(lang, dept.code, dept.name) : tr("the.department");
    setText("track-dept", dept ? name : t.code);
    lastDeptName = name;
    const where = $("track-where");
    where.hidden = !dept;
    if (dept) where.lastChild.textContent = I.place(lang, dept.location);

    if (alertWatch) {
      const a = alertWatch.next(t);
      if (a) fireAlert(a, t, name);
    }

    const serving = t.serving.length ? t.serving.join(", ") : tr("track.none");
    if (t.status === "waiting") {
      show(t.almost ? "almost" : "waiting", {
        alert: t.almost ? tr("track.almost", { dept: name }) : "",
        wait: waitText(t),
        ahead: String(t.ahead),
        serving
      });
    } else if (t.status === "serving") {
      show("serving", { alert: tr("track.turn", { dept: name, counter: t.counter }), wait: tr("track.now"), ahead: "0", serving });
    } else if (t.status === "missed") {
      show("missed", { alert: tr("track.missed"), serving });
    } else if (t.forwardedTo) {
      show("forwarded", { alert: tr("track.billing", { token: t.forwardedTo }), serving });
      const link = document.createElement("a");
      link.href = Core.trackPath(t.forwardedTo, day.date);
      link.textContent = tr("track.billing.link", { token: t.forwardedTo });
      link.id = "track-next";
      $("track-alert-text").append(" ", link);
    } else {
      show("done", { alert: tr("track.done"), serving });
    }
  }

  applyLanguage();
  Q.subscribe(render);
})();
