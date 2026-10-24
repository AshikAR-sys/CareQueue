// Unit tests for the queue rules in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 25, 4, 0); // 25 Oct 2026, 09:30 IST

function dayWith(code, count, start = T0) {
  const day = Q.emptyDay("2026-10-25");
  for (let i = 0; i < count; i++) Q.issue(day, { code, patient: { name: "P" + i } }, start + i * 1000);
  return day;
}

test("issue numbers tokens in order per queue (AC-02.1)", () => {
  const day = Q.emptyDay("2026-10-25");
  assert.equal(Q.issue(day, { code: "G" }, T0).number, "G001");
  assert.equal(Q.issue(day, { code: "G" }, T0).number, "G002");
  assert.equal(Q.issue(day, { code: "C" }, T0).number, "C001");
});

test("Call Next serves the first waiting token and completes the previous one (AC-05.1)", () => {
  const day = dayWith("G", 3);
  assert.equal(Q.callNext(day, "G", T0 + MIN).number, "G001");
  const second = Q.callNext(day, "G", T0 + 5 * MIN);
  assert.equal(second.number, "G002");
  const first = day.tokens.find((t) => t.number === "G001");
  assert.equal(first.status, "done");
  assert.equal(first.doneAt, T0 + 5 * MIN);
});

test("Call Next on an empty queue changes nothing (AC-05.2)", () => {
  const day = Q.emptyDay("2026-10-25");
  assert.equal(Q.callNext(day, "G", T0), null);
  assert.deepEqual(day.tokens, []);
});

test("Call Next completes the last patient even when nobody else waits", () => {
  const day = dayWith("G", 1);
  Q.callNext(day, "G", T0 + MIN);
  assert.equal(Q.callNext(day, "G", T0 + 4 * MIN), null);
  assert.equal(day.tokens[0].status, "done");
});

test("a called token is no longer waiting (AC-05.3)", () => {
  const day = dayWith("G", 2);
  Q.callNext(day, "G", T0 + MIN);
  const v = Q.view(day, "G", T0 + MIN);
  assert.equal(v.serving.number, "G001");
  assert.deepEqual(v.waiting.map((t) => t.number), ["G002"]);
});

test("queues are independent", () => {
  const day = Q.emptyDay("2026-10-25");
  Q.issue(day, { code: "G" }, T0);
  Q.issue(day, { code: "C" }, T0);
  Q.callNext(day, "C", T0 + MIN);
  assert.equal(Q.view(day, "G", T0 + MIN).serving, null);
  assert.equal(Q.view(day, "C", T0 + MIN).serving.number, "C001");
});

test("Skip moves the serving token to Missed and the next can be called (AC-07.1)", () => {
  const day = dayWith("G", 2);
  Q.callNext(day, "G", T0 + MIN);
  assert.equal(Q.skip(day, "G", T0 + 2 * MIN).number, "G001");
  const v = Q.view(day, "G", T0 + 2 * MIN);
  assert.equal(v.serving, null);
  assert.deepEqual(v.missed.map((t) => t.number), ["G001"]);
  assert.equal(Q.callNext(day, "G", T0 + 3 * MIN).number, "G002");
});

test("Skip with nobody serving does nothing", () => {
  const day = dayWith("G", 1);
  assert.equal(Q.skip(day, "G", T0), null);
});

test("Recall makes a missed token serving again and completes the current one (AC-07.2)", () => {
  const day = dayWith("G", 2);
  Q.callNext(day, "G", T0 + MIN);
  Q.skip(day, "G", T0 + 2 * MIN);
  Q.callNext(day, "G", T0 + 3 * MIN);              // G002 serving
  assert.equal(Q.recall(day, "G001", T0 + 6 * MIN).number, "G001");
  const v = Q.view(day, "G", T0 + 6 * MIN);
  assert.equal(v.serving.number, "G001");
  assert.equal(day.tokens.find((t) => t.number === "G002").status, "done");
  assert.deepEqual(v.missed, []);
});

test("average service time is the 3-minute default until 3 are served (AC-10.1)", () => {
  const day = dayWith("G", 3);
  Q.callNext(day, "G", T0);
  Q.callNext(day, "G", T0 + 10 * MIN); // one served, 10 min
  assert.equal(Q.averageServiceMs(day, "G"), 3 * MIN);
});

test("average service time uses the last 10 served after 3 (AC-10.2)", () => {
  const day = dayWith("G", 13);
  let t = T0;
  // 12 served: the first two take 20 min, the next ten take 2 min each
  const durations = [20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  Q.callNext(day, "G", t);
  for (const d of durations) { t += d * MIN; Q.callNext(day, "G", t); }
  assert.equal(Q.averageServiceMs(day, "G"), 2 * MIN);
});

test("estimate matches the PRD worked example: 23 min (AC-09.1)", () => {
  // 4 served at 4 min each, the 5th has been at the counter for 1 min, target has 5 waiting ahead
  const day = dayWith("G", 11);
  let t = T0;
  Q.callNext(day, "G", t);
  for (let i = 0; i < 4; i++) { t += 4 * MIN; Q.callNext(day, "G", t); }
  // G005 serving since t; G006..G010 waiting ahead of G011
  const est = Q.estimate(day, "G011", t + MIN);
  assert.deepEqual(est, { status: "waiting", ahead: 5, minutes: 23 });
});

test("a serving token's estimate says serving (AC-09.3)", () => {
  const day = dayWith("G", 1);
  Q.callNext(day, "G", T0);
  assert.deepEqual(Q.estimate(day, "G001", T0 + MIN), { status: "serving" });
});

test("first in line with nobody serving waits 0 minutes", () => {
  const day = dayWith("G", 1);
  assert.deepEqual(Q.estimate(day, "G001", T0), { status: "waiting", ahead: 0, minutes: 0 });
});

test("remaining time of the current patient never goes below zero", () => {
  const day = dayWith("G", 2);
  Q.callNext(day, "G", T0);
  // default AST 3 min, current patient already 10 min at the counter, 0 ahead
  assert.deepEqual(Q.estimate(day, "G002", T0 + 10 * MIN), { status: "waiting", ahead: 0, minutes: 0 });
});

test("view lists waiting tokens with their estimates, recalculated per call (AC-09.2)", () => {
  const day = dayWith("G", 3);
  Q.callNext(day, "G", T0);
  const v = Q.view(day, "G", T0);
  assert.deepEqual(v.waiting.map((t) => [t.number, t.minutes]), [["G002", 3], ["G003", 6]]);
});

test("unknown token has no estimate", () => {
  assert.equal(Q.estimate(Q.emptyDay("2026-10-25"), "X999", T0), null);
});

test("dayKey uses the local calendar date", () => {
  assert.equal(Q.dayKey(new Date(2026, 9, 25, 23, 59)), "2026-10-25");
});

test("public view never contains patient details (AC-06.3)", () => {
  const day = Q.emptyDay("2026-10-25");
  Q.issue(day, { code: "G", patient: { name: "Priya Sharma", phone: "9876543210" } }, T0);
  Q.issue(day, { code: "G", patient: { name: "Ravi Kumar" } }, T0);
  Q.callNext(day, "G", T0);
  const json = JSON.stringify(Q.publicView(day, "G", T0));
  assert.ok(!json.includes("Priya") && !json.includes("Ravi") && !json.includes("98765"));
  assert.equal(Q.publicView(day, "G", T0).serving, "G001");
});
