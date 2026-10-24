// Queue service. The page talks only to `TokenQueue.issue(details)`, which resolves to
//   { number, issuedAt: Date, mode, estimate }
// `estimate` is { minMinutes, maxMinutes } when a live queue supplies one, otherwise null.
//
// This prototype ships with a local demo queue only: numbers are counted per department per
// day in this browser. It knows nothing about the real hospital queue, so it never returns a
// waiting time or a position. Connect a backend by replacing `issue` with a call to it.
(function () {
  const memory = {};

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return memory[key] ?? null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { memory[key] = value; }
  }
  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function issue(details) {
    if (!details || !details.department || !details.department.code) {
      throw new Error("No department selected.");
    }
    const now = new Date();
    const key = "careplus-demo-count:" + dayKey(now) + ":" + details.department.code;
    const next = (parseInt(storageGet(key) || "0", 10) || 0) + 1;
    if (next > 999) throw new Error("Today's token limit for this department has been reached.");
    storageSet(key, String(next));
    return {
      number: details.department.code + String(next).padStart(3, "0"),
      issuedAt: now,
      mode: "demo",
      estimate: null
    };
  }

  window.TokenQueue = { issue };
})();
