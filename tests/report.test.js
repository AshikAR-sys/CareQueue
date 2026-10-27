// Unit tests for the queue report rules (US-15, US-16) in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const T0 = Date.UTC(2026, 9, 25, 9, 0);       // 09:00 UTC
const utcHour = (ms) => new Date(ms).getUTCHours();

// G: 4 tokens. G001 waited 2 min, served 4 min; G002 waited 6 min, served 2 min; G003 waited 3 min, then missed;
// G004 waiting.
// C: 1 token issued at 11:10, waiting.
function sampleDay() {
  const day = Q.emptyDay("2026-10-25");
  Q.issue(day, { code: "G" }, T0);
  Q.issue(day, { code: "G" }, T0);
  Q.issue(day, { code: "G" }, T0 + 5 * MIN);
  Q.issue(day, { code: "G" }, T0 + HOUR);
  Q.issue(day, { code: "C" }, T0 + 2 * HOUR + 10 * MIN);
  Q.callNext(day, "G", T0 + 2 * MIN);          // G001 called
  Q.callNext(day, "G", T0 + 6 * MIN);          // G001 done (4 min), G002 called
  Q.callNext(day, "G", T0 + 8 * MIN);          // G002 done (2 min), G003 called
  Q.skip(day, "G", T0 + 40 * MIN);             // G003 missed
  return day;
}

test("the report counts issued, served, waiting, serving and missed per department (AC-15.1)", () => {
  const r = Q.report(sampleDay(), ["G", "C"], utcHour);
  const g = r.departments[0];
  assert.deepEqual(
    { code: g.code, issued: g.issued, served: g.served, waiting: g.waiting, serving: g.serving, missed: g.missed },
    { code: "G", issued: 4, served: 2, waiting: 1, serving: 0, missed: 1 });
  assert.equal(r.departments[1].issued, 1);
  assert.equal(r.total.issued, 5);
  assert.equal(r.total.waiting, 2);
});

test("average wait is issued-to-called and average service is called-to-done, in minutes (AC-15.2)", () => {
  const r = Q.report(sampleDay(), ["G", "C"], utcHour);
  const g = r.departments[0];
  // waits: G001 2, G002 6, G003 3 -> 3.7; service: G001 4, G002 2 -> 3
  assert.equal(g.avgWaitMin, 3.7);
  assert.equal(g.avgServiceMin, 3);
  assert.equal(r.departments[1].avgWaitMin, null, "no one called yet in C");
  assert.equal(r.total.avgWaitMin, 3.7);
});

test("tokens sent to Billing are counted as served, and the billing queue as its own row", () => {
  const day = Q.emptyDay("2026-10-25");
  Q.issue(day, { code: "G" }, T0);
  Q.callNext(day, "G", T0 + MIN);
  Q.sendTo(day, "G", "B", T0 + 3 * MIN);
  const r = Q.report(day, ["G", "B"], utcHour);
  assert.equal(r.departments[0].served, 1);
  assert.equal(r.departments[0].sentToBilling, 1);
  assert.equal(r.departments[1].issued, 1);
  assert.equal(r.departments[1].waiting, 1);
});

test("tokens per hour cover every hour from the first to the last token, and name the busiest (AC-16.1)", () => {
  const r = Q.report(sampleDay(), ["G", "C"], utcHour);
  assert.deepEqual(r.hours, [{ hour: 9, count: 3 }, { hour: 10, count: 1 }, { hour: 11, count: 1 }]);
  assert.deepEqual(r.busiest, { hour: 9, count: 3 });
});

test("an empty day has zero counts, no averages and no busiest hour", () => {
  const r = Q.report(Q.emptyDay("2026-10-25"), ["G"], utcHour);
  assert.equal(r.total.issued, 0);
  assert.equal(r.total.avgWaitMin, null);
  assert.deepEqual(r.hours, []);
  assert.equal(r.busiest, null);
});

test("the CSV has one row per department and a total row, with no patient details (AC-16.2)", () => {
  const day = sampleDay();
  day.tokens[0].patient = { name: "Priya Sharma", phone: "9876543210" };
  const csv = Q.reportCsv(Q.report(day, ["G", "C"], utcHour), (code) => ({ G: "General Medicine", C: "Cardiology, OPD" }[code]));
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "Department,Code,Issued,Served,Waiting,Serving,Missed,Sent to Billing,Average wait (min),Average service (min),Average rating (1-5),Ratings");
  assert.equal(lines[1], "General Medicine,G,4,2,1,0,1,0,3.7,3,,0");
  assert.equal(lines[2], '"Cardiology, OPD",C,1,0,1,0,0,0,,,,0');
  assert.equal(lines[3], "Total,,5,2,2,0,1,0,3.7,3,,0");
  assert.ok(!csv.includes("Priya") && !csv.includes("98765"));
});

// ---------- US-20 visit ratings ----------

test("ratings are counted and averaged per department and in total (AC-20.3)", () => {
  const day = sampleDay();
  day.tokens[0].rating = 5;                         // G001
  day.tokens[1].rating = 4;                         // G002
  const r = Q.report(day, ["G", "C"], utcHour);
  assert.equal(r.departments[0].ratingCount, 2);
  assert.equal(r.departments[0].avgRating, 4.5);
  assert.equal(r.departments[1].ratingCount, 0);
  assert.equal(r.departments[1].avgRating, null);
  assert.equal(r.total.avgRating, 4.5);
});

test("the CSV has the rating columns (AC-20.3)", () => {
  const day = sampleDay();
  day.tokens[0].rating = 3;
  const lines = Q.reportCsv(Q.report(day, ["G"], utcHour), () => "General Medicine").trim().split("\n");
  assert.match(lines[0], /,Average rating \(1-5\),Ratings$/);
  assert.match(lines[1], /,3,1$/);
});

test("tracking shows a finished visit's rating, and asks for one only at the end of the visit (AC-20.1)", () => {
  const day = Q.emptyDay("2026-10-25");
  Q.issue(day, { code: "G" }, T0);
  Q.issue(day, { code: "G" }, T0);
  Q.callNext(day, "G", T0);
  Q.callNext(day, "G", T0 + MIN);                   // G001 done, G002 serving
  assert.equal(Q.track(day, "G001", T0 + MIN).canRate, true);
  assert.equal(Q.track(day, "G002", T0 + MIN).canRate, false);
  day.tokens[0].rating = 4;
  const done = Q.track(day, "G001", T0 + MIN);
  assert.equal(done.canRate, false);
  assert.equal(done.rating, 4);
  Q.sendTo(day, "G", "B", T0 + 2 * MIN);            // G002 goes on to Billing: rated at the end, not now
  assert.equal(Q.track(day, "G002", T0 + 2 * MIN).canRate, false);
});
