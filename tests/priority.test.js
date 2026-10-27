// Unit tests for priority tokens (US-17) in frontend/js/queue-core.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../frontend/js/queue-core.js");

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 25, 4, 0);

function issueAll(day, list) {
  return list.map((priority, i) => Q.issue(day, { code: "G", patient: { name: "P" + i }, priority }, T0 + i * 1000));
}

test("a token can carry a priority reason (AC-17.1)", () => {
  const day = Q.emptyDay("2026-10-25");
  const [normal, senior] = issueAll(day, [null, "senior"]);
  assert.equal(normal.priority, null);
  assert.equal(senior.priority, "senior");
  assert.equal(senior.number, "G002", "priority tokens share the queue's numbering");
});

test("priority tokens wait ahead of normal tokens, earliest first (AC-17.2)", () => {
  const day = Q.emptyDay("2026-10-25");
  issueAll(day, [null, null, "pregnant", null, "emergency"]);
  assert.deepEqual(Q.view(day, "G", T0).waiting.map((t) => t.number), ["G003", "G005", "G001", "G002", "G004"]);
  assert.equal(Q.callNext(day, "G", T0 + MIN).number, "G003");
  assert.equal(Q.callNext(day, "G", T0 + 2 * MIN).number, "G005");
  assert.equal(Q.callNext(day, "G", T0 + 3 * MIN).number, "G001");
});

test("estimates follow the calling order (AC-17.4)", () => {
  const day = Q.emptyDay("2026-10-25");
  issueAll(day, [null, null, "senior"]);
  assert.equal(Q.estimate(day, "G003", T0).ahead, 0);
  assert.equal(Q.estimate(day, "G001", T0).ahead, 1);
  assert.equal(Q.estimate(day, "G002", T0).ahead, 2);
  assert.equal(Q.track(day, "G002", T0).ahead, 2);
});

test("the public view marks priority tokens without the reason (AC-17.3)", () => {
  const day = Q.emptyDay("2026-10-25");
  issueAll(day, [null, "pregnant"]);
  const v = Q.publicView(day, "G", T0);
  assert.deepEqual(v.waiting.map((t) => [t.number, t.priority]), [["G002", true], ["G001", false]]);
  assert.ok(!JSON.stringify(v).includes("pregnant"));
});

test("a priority patient sent to Billing keeps priority there", () => {
  const day = Q.emptyDay("2026-10-25");
  issueAll(day, ["senior"]);
  Q.issue(day, { code: "B", patient: { name: "Walk-in" } }, T0);
  Q.callNext(day, "G", T0);
  const bill = Q.sendTo(day, "G", "B", T0 + MIN);
  assert.equal(bill.priority, "senior");
  assert.deepEqual(Q.view(day, "B", T0 + MIN).waiting.map((t) => t.number), ["B002", "B001"]);
});

test("a recalled token is served whatever its priority; recall does not reorder the line", () => {
  const day = Q.emptyDay("2026-10-25");
  issueAll(day, [null, "senior"]);
  Q.callNext(day, "G", T0);                         // G002 (priority)
  Q.skip(day, "G", T0 + MIN);
  assert.equal(Q.recall(day, "G002", T0 + 2 * MIN).number, "G002");
  assert.deepEqual(Q.view(day, "G", T0).waiting.map((t) => t.number), ["G001"]);
});
