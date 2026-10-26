// Unit tests for the phone tracking rules (US-13) in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 25, 4, 0); // 25 Oct 2026, 09:30 IST

function dayWith(code, count) {
  const day = Q.emptyDay("2026-10-25");
  for (let i = 0; i < count; i++) Q.issue(day, { code, patient: { name: "P" + i } }, T0 + i * 1000);
  return day;
}

test("the tracking link names the token and the day it was issued", () => {
  assert.equal(Q.trackPath("G004", "2026-10-25"), "track.html?t=G004&d=2026-10-25");
});

test("tracking shows my token, the token being served, people ahead and my wait (AC-13.1)", () => {
  const day = dayWith("G", 5);
  Q.callNext(day, "G", T0);                       // G001 serving; G002..G005 waiting
  assert.deepEqual(Q.track(day, "G005", T0 + MIN), {
    number: "G005", code: "G", status: "waiting", serving: "G001",
    ahead: 3, minutes: 11, almost: false
  });
});

test("tracking follows the queue as it moves (AC-13.2)", () => {
  const day = dayWith("G", 5);
  Q.callNext(day, "G", T0);
  assert.equal(Q.track(day, "G005", T0).ahead, 3);
  Q.callNext(day, "G", T0 + 2 * MIN);
  const moved = Q.track(day, "G005", T0 + 2 * MIN);
  assert.equal(moved.serving, "G002");
  assert.equal(moved.ahead, 2);
});

test("'Almost your turn' turns on when 2 or fewer patients are ahead (AC-13.3)", () => {
  const day = dayWith("G", 4);                     // nobody serving yet
  assert.equal(Q.track(day, "G004", T0).almost, false); // 3 ahead
  Q.callNext(day, "G", T0);
  assert.equal(Q.track(day, "G004", T0).almost, true);  // 2 ahead
  Q.callNext(day, "G", T0 + MIN);
  Q.callNext(day, "G", T0 + 2 * MIN);
  assert.equal(Q.track(day, "G004", T0 + 2 * MIN).almost, true); // next
});

test("tracking a token being served, missed or sent to Billing", () => {
  const day = dayWith("G", 2);
  Q.callNext(day, "G", T0);
  assert.equal(Q.track(day, "G001", T0).status, "serving");
  assert.equal(Q.track(day, "G001", T0).almost, false);
  Q.skip(day, "G", T0 + MIN);
  assert.equal(Q.track(day, "G001", T0 + MIN).status, "missed");
  Q.callNext(day, "G", T0 + MIN);
  Q.sendTo(day, "G", "B", T0 + 2 * MIN);
  const sent = Q.track(day, "G002", T0 + 2 * MIN);
  assert.equal(sent.status, "done");
  assert.equal(sent.forwardedTo, "B001");
});

test("tracking an unknown token returns null", () => {
  assert.equal(Q.track(dayWith("G", 1), "G999", T0), null);
});
