// Track My Token (US-13): the page a patient's phone opens from the QR code on the token slip.
// No sign-in. It reads the public queue state (numbers only) and updates itself every second.
(function () {
  "use strict";
  const { time, deptByCode } = window.Screens;
  const Core = window.QueueCore;
  const Q = window.TokenQueue;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(window.location.search);
  const number = (params.get("t") || "").trim().toUpperCase();
  const issuedOn = params.get("d") || "";
  const card = $("track-card");

  function setText(id, text) { $(id).textContent = text; }

  function waitText(t) {
    if (t.minutes === 0) return "You're next";
    return "About " + t.minutes + " min";
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

  function render() {
    const live = $("track-live");
    live.textContent = Q.isPersistent() ? "Live · " + time(new Date()) : "Reconnecting…";
    live.classList.toggle("offline", !Q.isPersistent());
    setText("track-number", number || "···");
    if (!/^[A-Z]\d{3}$/.test(number)) return message("invalid", "This link has no token number. Scan the QR code on your token again.");
    if (!Q.isPersistent()) return; // keep the last view until the server answers

    const day = Q.day();
    if (issuedOn && issuedOn !== day.date) {
      return message("stale", "This token was for " + issuedOn + ". Tokens start again each day; please get a new one.");
    }
    const t = Core.track(day, number, Date.now());
    if (!t) return message("notfound", "We can't find this token today. Please ask at the reception desk.");

    const dept = deptByCode(t.code);
    setText("track-dept", dept ? dept.name : t.code);
    const where = $("track-where");
    where.hidden = !dept;
    if (dept) where.lastChild.textContent = dept.location;

    const serving = t.serving.length ? t.serving.join(", ") : "None yet";
    if (t.status === "waiting") {
      show(t.almost ? "almost" : "waiting", {
        alert: t.almost ? "Almost your turn. Please be near " + (dept ? dept.name : "the department") + "." : "",
        wait: waitText(t),
        ahead: String(t.ahead),
        serving
      });
    } else if (t.status === "serving") {
      show("serving", { alert: "It's your turn now. Please go to " + (dept ? dept.name : "the department") + ", Counter " + t.counter + ".", wait: "Now", ahead: "0", serving });
    } else if (t.status === "missed") {
      show("missed", { alert: "Your number was called and missed. Please tell the reception desk.", serving });
    } else if (t.forwardedTo) {
      show("forwarded", { alert: "Sent to Billing. Your billing token is " + t.forwardedTo + ".", serving });
      const link = document.createElement("a");
      link.href = Core.trackPath(t.forwardedTo, day.date);
      link.textContent = "Track " + t.forwardedTo;
      link.id = "track-next";
      $("track-alert-text").append(" ", link);
    } else {
      show("done", { alert: "Visit completed. Thank you.", serving });
    }
  }

  Q.subscribe(render);
})();
