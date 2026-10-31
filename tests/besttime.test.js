// Unit tests for "best time to visit" (US-25) in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const H = 60 * 60 * 1000;
const DAY0 = Date.UTC(2026, 9, 20);
const utcHour = (ms) => new Date(ms).getUTCHours();

// rows: [code, createdAt, date]; per day G gets 4 tokens at 9h, 1 at 10h, 2 at 11h, 3 at 12h.
function history(days) {
  const rows = [];
  for (let d = 0; d < days; d++) {
    const date = "2026-10-" + String(20 + d).padStart(2, "0");
    const base = DAY0 + d * 24 * H;
    [[9, 4], [10, 1], [11, 2], [12, 3]].forEach(([h, n]) => {
      for (let i = 0; i < n; i++) rows.push(["G", base + h * H + i * 60000, date]);
    });
    rows.push(["C", base + 10 * H, date]);
  }
  return rows;
}

test("usual tokens per hour and the quietest hours, per department (AC-25.1)", () => {
  const r = Q.bestTimes(history(4), utcHour);
  assert.equal(r.days, 4);
  const g = r.departments.G;
  assert.deepEqual(g.hours, [{ hour: 9, avg: 4 }, { hour: 10, avg: 1 }, { hour: 11, avg: 2 }, { hour: 12, avg: 3 }]);
  assert.deepEqual(g.quietest, [10, 11]);
  assert.equal(g.busiest, 9);
  assert.deepEqual(r.departments.C.quietest, [10]);
});

test("averages count days with no tokens in that hour as zero", () => {
  const rows = history(3).filter((r) => !(r[0] === "G" && r[2] === "2026-10-21" && utcHour(r[1]) === 12));
  assert.equal(Q.bestTimes(rows, utcHour).departments.G.hours.find((h) => h.hour === 12).avg, 2);
});

test("with fewer than 3 days of records there is no advice (AC-25.2)", () => {
  const r = Q.bestTimes(history(2), utcHour);
  assert.equal(r.enough, false);
  assert.equal(r.days, 2);
  assert.equal(Q.bestTimes(history(3), utcHour).enough, true);
  assert.equal(Q.bestTimes([], utcHour).enough, false);
});
