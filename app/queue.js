// Queue service: keeps today's queue in this browser's localStorage and shares it live between the
// token page, the staff console and the waiting-room display open on the same machine.
// There is no server: other computers do not see this queue. The rules live in queue-core.js.
//
// The token page calls TokenQueue.issue(details), which resolves to
//   { number, issuedAt: Date, mode: "local", estimate }
// To connect a hospital backend later, keep these function names and replace load/save with API calls.
(function () {
  "use strict";
  const Core = window.QueueCore;
  const PREFIX = "carequeue-queue:";
  const listeners = new Set();
  let memoryDay = null;      // used only when localStorage is unavailable
  let persistent = true;

  function todayKey() { return Core.dayKey(new Date()); }
  function storageKey() { return PREFIX + todayKey(); }

  function load() {
    try {
      const raw = window.localStorage.getItem(storageKey());
      if (raw) return JSON.parse(raw);
      return Core.emptyDay(todayKey());
    } catch (e) {
      persistent = false;
      if (!memoryDay || memoryDay.date !== todayKey()) memoryDay = Core.emptyDay(todayKey());
      return memoryDay;
    }
  }

  function save(day) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(day));
    } catch (e) {
      persistent = false;
      memoryDay = day;
    }
    listeners.forEach((fn) => fn());
  }

  function change(fn) {
    const day = load();
    const result = fn(day, Date.now());
    save(day);
    return result;
  }

  // Other tabs: the storage event fires within milliseconds. The interval also keeps estimates
  // ticking as time passes, and covers browsers that do not deliver storage events.
  function subscribe(fn) {
    listeners.add(fn);
    window.addEventListener("storage", (e) => { if (e.key === null || e.key === storageKey()) fn(); });
    const timer = setInterval(fn, 1000);
    return () => { listeners.delete(fn); clearInterval(timer); };
  }

  async function issue(details) {
    if (!details || !details.department || !details.department.code) {
      throw new Error("No department selected.");
    }
    return change((day, now) => {
      const token = Core.issue(day, {
        code: details.department.code,
        patient: {
          name: details.name, age: details.age, gender: details.gender,
          phone: details.phone, doctor: details.doctor || ""
        }
      }, now);
      return { number: token.number, issuedAt: new Date(now), mode: "local", estimate: Core.estimate(day, token.number, now) };
    });
  }

  window.TokenQueue = {
    issue,
    callNext: (code) => change((day, now) => Core.callNext(day, code, now)),
    skip: (code) => change((day, now) => Core.skip(day, code, now)),
    recall: (number) => change((day, now) => Core.recall(day, number, now)),
    estimate: (number) => Core.estimate(load(), number, Date.now()),
    view: (code) => Core.view(load(), code, Date.now()),
    publicView: (code) => Core.publicView(load(), code, Date.now()),
    codesInUse: () => Object.keys(load().counters),
    isPersistent: () => { load(); return persistent; },
    subscribe
  };
})();
