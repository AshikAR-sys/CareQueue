// Unit tests for "hold my place" (US-22) in frontend/js/queue-core.js.
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

test("Call Next passes over a patient who is away, who keeps their place (AC-22.2)", () => {
  const day = dayWith(3);
  day.tokens[0].awayUntil = T0 + 10 * MIN;            // G001 stepped out
  assert.equal(Q.nextUp(day, "G", T0).number, "G002");
  assert.equal(Q.callNext(day, "G", T0).number, "G002");
  assert.deepEqual(Q.view(day, "G", T0).waiting.map((t) => t.number), ["G001", "G003"], "G001 stays first in line");
});

test("when the time runs out the patient can be called again (AC-22.3)", () => {
  const day = dayWith(2);
  day.tokens[0].awayUntil = T0 + 10 * MIN;
  assert.equal(Q.callNext(day, "G", T0 + 11 * MIN).number, "G001");
});

test("with everyone waiting away, Call Next calls nobody", () => {
  const day = dayWith(1);
  day.tokens[0].awayUntil = T0 + 5 * MIN;
  assert.equal(Q.callNext(day, "G", T0), null);
  assert.equal(day.tokens[0].status, "waiting");
});

test("tracking tells the patient they are away, and whether they may still step out (AC-22.1)", () => {
  const day = dayWith(2);
  assert.equal(Q.track(day, "G002", T0).canStepOut, true);
  day.tokens[1].awayUntil = T0 + 10 * MIN;
  const away = Q.track(day, "G002", T0 + MIN);
  assert.equal(away.awayUntil, T0 + 10 * MIN);
  assert.equal(away.away, true);
  assert.equal(away.canStepOut, false);
  day.tokens[1].awayUntil = T0 + 2 * MIN;              // back (or time over): once per token
  const back = Q.track(day, "G002", T0 + 3 * MIN);
  assert.equal(back.away, false);
  assert.equal(back.canStepOut, false);
});

test("the public view marks away tokens without details", () => {
  const day = dayWith(2);
  day.tokens[1].awayUntil = T0 + 10 * MIN;
  assert.deepEqual(Q.publicView(day, "G", T0).waiting.map((t) => [t.number, t.away]), [["G001", false], ["G002", true]]);
});
