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

    const dept = deptByCode(t.code);
    const name = dept ? I.deptName(lang, dept.code, dept.name) : tr("the.department");
    setText("track-dept", dept ? name : t.code);
    const where = $("track-where");
    where.hidden = !dept;
    if (dept) where.lastChild.textContent = I.place(lang, dept.location);

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
