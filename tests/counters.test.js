// Unit tests for multiple counters (US-11) in frontend/js/queue-core.js and the counter in announcements.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");
const A = require("../frontend/js/announce.js");

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 25, 4, 0);

function dayWith(code, count) {
  const day = Q.emptyDay("2026-10-25");
  for (let i = 0; i < count; i++) Q.issue(day, { code, patient: { name: "P" + i } }, T0 + i * 1000);
  return day;
}

test("each department starts with Counter 1 open, up to 3 counters", () => {
  const day = Q.emptyDay("2026-10-25");
  assert.deepEqual(Q.openCounters(day, "G"), [1]);
  Q.setCounter(day, "G", 2, true);
  Q.setCounter(day, "G", 3, true);
  assert.deepEqual(Q.openCounters(day, "G"), [1, 2, 3]);
  assert.deepEqual(Q.openCounters(day, "C"), [1], "other departments are unaffected");
  assert.throws(() => Q.setCounter(day, "G", 4, true), /Counter 1, 2 or 3/);
});

test("each open counter calls its own patient (AC-11.3)", () => {
  const day = dayWith("G", 3);
  Q.setCounter(day, "G", 2, true);
  assert.equal(Q.callNext(day, "G", T0, 1).number, "G001");
  const second = Q.callNext(day, "G", T0 + MIN, 2);
  assert.equal(second.number, "G002");
  assert.equal(second.counter, 2);
  const v = Q.view(day, "G", T0 + MIN);
  assert.deepEqual(v.servingAll.map((t) => [t.number, t.counter]), [["G001", 1], ["G002", 2]]);
  assert.equal(Q.view(day, "G", T0 + MIN, 2).serving.number, "G002");
  // Call Next at Counter 1 completes only Counter 1's patient.
  Q.callNext(day, "G", T0 + 2 * MIN, 1);
  assert.equal(day.tokens[0].status, "done");
  assert.equal(day.tokens[1].status, "serving");
  assert.equal(day.tokens[2].counter, 1);
});

test("Skip, Recall and Send to Billing act on the chosen counter", () => {
  const day = dayWith("G", 3);
  Q.setCounter(day, "G", 2, true);
  Q.callNext(day, "G", T0, 1);                      // G001 at 1
  Q.callNext(day, "G", T0, 2);                      // G002 at 2
  assert.equal(Q.skip(day, "G", T0 + MIN, 2).number, "G002");
  assert.equal(day.tokens[0].status, "serving", "Counter 1 keeps its patient");
  const recalled = Q.recall(day, "G002", T0 + 2 * MIN, 2);
  assert.equal(recalled.counter, 2);
  assert.equal(day.tokens[0].status, "serving");
  const billing = Q.sendTo(day, "G", "B", T0 + 3 * MIN, 2);
  assert.equal(billing.linkedFrom, "G002");
  assert.equal(day.tokens[0].status, "serving");
});

test("a paused counter cannot call patients (AC-11.2)", () => {
  const day = dayWith("G", 2);
  assert.throws(() => Q.callNext(day, "G", T0, 2), /Counter 2 is paused/);
  Q.setCounter(day, "G", 2, true);
  Q.setCounter(day, "G", 2, false);
  assert.throws(() => Q.callNext(day, "G", T0, 2), /Counter 2 is paused/);
});

test("a counter cannot be paused while serving, and the last open counter cannot be paused", () => {
  const day = dayWith("G", 2);
  assert.throws(() => Q.setCounter(day, "G", 1, false), /at least one counter/i);
  Q.setCounter(day, "G", 2, true);
  Q.callNext(day, "G", T0, 2);
  assert.throws(() => Q.setCounter(day, "G", 2, false), /G001 is at Counter 2/);
  Q.setCounter(day, "G", 1, false);
  assert.deepEqual(Q.openCounters(day, "G"), [2]);
});

test("with 2 counters open, N is divided by 2 in the estimate (AC-11.1)", () => {
  const day = dayWith("G", 7);
  Q.setCounter(day, "G", 2, true);
  Q.callNext(day, "G", T0, 1);                      // G001 at 1 since T0
  Q.callNext(day, "G", T0, 2);                      // G002 at 2 since T0
  // G007: 4 ahead (G003-G006). AST 3 min, both counters 1 min in -> R = 2 min. EWT = 2 + 4/2 x 3 = 8 min.
  const e = Q.estimate(day, "G007", T0 + MIN);
  assert.equal(e.ahead, 4);
  assert.equal(e.minutes, 8);
  // One counter only, same queue: 2 + 4 x 3 = 14 min.
  const one = dayWith("G", 7);
  Q.callNext(one, "G", T0, 1);
  Q.callNext(one, "G", T0 + 1, 1);                  // G002 now at the only counter
  assert.equal(Q.estimate(one, "G007", T0 + MIN).ahead, 4);
});

test("a paused counter is not counted in the estimate; an idle open counter means no remaining time", () => {
  const day = dayWith("G", 5);
  Q.setCounter(day, "G", 2, true);
  Q.callNext(day, "G", T0, 1);                      // G001 at 1, Counter 2 idle
  // G005: 3 ahead, Counter 2 is free now -> R = 0. EWT = 0 + 3/2 x 3 = 4.5 -> 5 min.
  assert.equal(Q.estimate(day, "G005", T0 + MIN).minutes, 5);
  Q.setCounter(day, "G", 2, false);
  // Back to one counter: R = 2, EWT = 2 + 3 x 3 = 11 min.
  assert.equal(Q.estimate(day, "G005", T0 + MIN).minutes, 11);
});

test("a serving token's estimate and tracking name its counter", () => {
  const day = dayWith("G", 2);
  Q.setCounter(day, "G", 3, true);
  Q.callNext(day, "G", T0, 3);
  assert.deepEqual(Q.estimate(day, "G001", T0), { status: "serving", counter: 3 });
  assert.equal(Q.track(day, "G001", T0).counter, 3);
  assert.deepEqual(Q.track(day, "G002", T0).serving, ["G001"]);
});

test("the public view lists every serving token with its counter, numbers only", () => {
  const day = dayWith("G", 3);
  day.tokens[1].patient = { name: "Priya Sharma" };
  Q.setCounter(day, "G", 2, true);
  Q.callNext(day, "G", T0, 2);
  Q.callNext(day, "G", T0, 1);
  const v = Q.publicView(day, "G", T0);
  assert.deepEqual(v.serving, [{ number: "G002", counter: 1 }, { number: "G001", counter: 2 }]);
  assert.deepEqual(v.openCounters, [1, 2]);
  assert.ok(!JSON.stringify(v).includes("Priya"));
});

test("announcements name the counter (AC-11.4)", () => {
  assert.equal(A.announcementText("G005", "General Medicine", 2), "Token G 0 0 5, please come to General Medicine, counter 2.");
  const before = { "G#1": { code: "G", counter: 1, number: "G001", calledAt: 1 }, "G#2": null };
  const after = { "G#1": { code: "G", counter: 1, number: "G001", calledAt: 1 }, "G#2": { code: "G", counter: 2, number: "G002", calledAt: 5 } };
  assert.deepEqual(A.newCalls(before, after), [{ code: "G", number: "G002", counter: 2 }]);
});
