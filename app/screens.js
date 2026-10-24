// Helpers shared by the staff console and the waiting-room display.
window.Screens = (function () {
  "use strict";
  const DATA = window.CAREQUEUE_DATA;
  const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  function time(d) { return timeFmt.format(d).toUpperCase(); }

  function startClock() {
    const t = document.getElementById("clock-time");
    const d = document.getElementById("clock-date");
    const tick = () => {
      const now = new Date();
      if (t) t.textContent = time(now);
      if (d) d.textContent = dateFmt.format(now);
    };
    tick();
    setInterval(tick, 15000);
  }

  function deptByCode(code) { return DATA.departments.find((d) => d.code === code) || null; }

  function minutes(ms) { return Math.max(0, Math.floor(ms / 60000)); }

  function waitWords(t) {
    if (t.minutes === 0) return "Next";
    return "about " + t.minutes + " min";
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  return { DATA, time, startClock, deptByCode, minutes, waitWords, el };
})();
