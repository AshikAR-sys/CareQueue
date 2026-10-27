// Unit tests for the turn-is-near alert rules (US-19) in frontend/js/alerts.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const Al = require("../frontend/js/alerts.js");

const waiting = (ahead, almost) => ({ status: "waiting", ahead, almost });
const serving = (counter) => ({ status: "serving", counter });

test("no alert while more than 2 people are ahead", () => {
  assert.equal(Al.alertFor(waiting(4, false)), null);
});

test("an alert when 2 or fewer are ahead, and when the token is called (AC-19.1, AC-19.2)", () => {
  assert.deepEqual(Al.alertFor(waiting(2, true)), { kind: "almost", key: "almost" });
  assert.deepEqual(Al.alertFor(serving(2)), { kind: "turn", key: "turn:2", counter: 2 });
  assert.equal(Al.alertFor({ status: "done" }), null);
  assert.equal(Al.alertFor(null), null);
});

test("each alert fires once; the state when alerts are turned on is only the starting point (AC-19.3)", () => {
  const w = Al.watcher();
  assert.equal(w.next(waiting(1, true)), null, "already almost when turned on: no alert");
  assert.equal(w.next(waiting(0, true)), null, "still almost: no repeat");
  assert.deepEqual(w.next(serving(1)), { kind: "turn", key: "turn:1", counter: 1 });
  assert.equal(w.next(serving(1)), null, "same call: no repeat");

  const fresh = Al.watcher();
  assert.equal(fresh.next(waiting(5, false)), null);
  assert.deepEqual(fresh.next(waiting(2, true)).kind, "almost");
  assert.equal(fresh.next(waiting(1, true)), null);
});

test("a token recalled to another counter alerts again", () => {
  const w = Al.watcher();
  w.next(waiting(3, false));
  assert.equal(w.next(serving(1)).key, "turn:1");
  assert.equal(w.next({ status: "missed" }), null);
  assert.equal(w.next(serving(2)).key, "turn:2");
});
