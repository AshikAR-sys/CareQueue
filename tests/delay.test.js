// Unit tests for the doctor delay notice (US-21) in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 31, 4, 0);

function dayWith(count) {
  const day = Q.emptyDay("2026-10-31");
  for (let i = 0; i < count; i++) Q.issue(day, { code: "G" }, T0);
  return day;
}

test("a posted delay is added to every waiting token's estimate in that department (AC-21.2)", () => {
  const day = dayWith(3);
  assert.equal(Q.estimate(day, "G003", T0).minutes, 6);
  day.delays = { G: { reason: "surgery", until: T0 + 20 * MIN } };
  assert.equal(Q.estimate(day, "G001", T0).minutes, 20);
  assert.equal(Q.estimate(day, "G003", T0).minutes, 26);
  Q.issue(day, { code: "C" }, T0);
  assert.equal(Q.estimate(day, "C001", T0).minutes, 0, "other departments are not delayed");
});

test("the delay counts down and ends by itself (AC-21.3)", () => {
  const day = dayWith(1);
  day.delays = { G: { reason: "break", until: T0 + 20 * MIN } };
  assert.equal(Q.estimate(day, "G001", T0 + 5 * MIN).minutes, 15);
  assert.equal(Q.delayIn(day, "G", T0 + 5 * MIN).minutesLeft, 15);
  assert.equal(Q.delayIn(day, "G", T0 + 20 * MIN), null);
  assert.equal(Q.estimate(day, "G001", T0 + 21 * MIN).minutes, 0);
});

test("the display and the phone page get the notice (AC-21.1)", () => {
  const day = dayWith(2);
  day.delays = { G: { reason: "surgery", until: T0 + 30 * MIN } };
  assert.deepEqual(Q.publicView(day, "G", T0).delay, { reason: "surgery", minutesLeft: 30 });
  assert.deepEqual(Q.track(day, "G002", T0).delay, { reason: "surgery", minutesLeft: 30 });
  delete day.delays.G;
  assert.equal(Q.publicView(day, "G", T0).delay, null);
});

test("minutes left are rounded up, so a notice never shows 0 while it is still on", () => {
  const day = dayWith(1);
  day.delays = { G: { reason: "other", until: T0 + 30 * 1000 } };
  assert.equal(Q.delayIn(day, "G", T0).minutesLeft, 1);
});
