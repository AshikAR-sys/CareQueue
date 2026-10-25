// Unit tests for the announcement rules in frontend/js/announce.js (US-08).
// Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../frontend/js/announce.js");

test("token characters are spoken one by one", () => {
  assert.equal(A.spokenNumber("G001"), "G 0 0 1");
  assert.equal(A.spokenNumber("B012"), "B 0 1 2");
});

test("announcement text names the token and the department (AC-08.1)", () => {
  assert.equal(A.announcementText("G001", "General Medicine"), "Token G 0 0 1, please come to General Medicine.");
  assert.equal(A.announcementText("B002", "Billing"), "Token B 0 0 2, please come to Billing.");
});

test("the first snapshot announces nothing (opening the display is silent)", () => {
  assert.deepEqual(A.newCalls(null, { G: { number: "G001", calledAt: 100 } }), []);
});

test("a new token being served is a new call", () => {
  const before = { G: { number: "G001", calledAt: 100 } };
  const after = { G: { number: "G002", calledAt: 200 } };
  assert.deepEqual(A.newCalls(before, after), [{ code: "G", number: "G002" }]);
});

test("the same token called again (recall) is a new call (AC-08.2)", () => {
  const before = { G: { number: "G001", calledAt: 100 } };
  const after = { G: { number: "G001", calledAt: 500 } };
  assert.deepEqual(A.newCalls(before, after), [{ code: "G", number: "G001" }]);
});

test("a recall after nobody was serving is a new call", () => {
  assert.deepEqual(A.newCalls({ G: null }, { G: { number: "G001", calledAt: 900 } }), [{ code: "G", number: "G001" }]);
});

test("no change, or a queue emptying, announces nothing", () => {
  const same = { G: { number: "G001", calledAt: 100 } };
  assert.deepEqual(A.newCalls(same, { G: { number: "G001", calledAt: 100 } }), []);
  assert.deepEqual(A.newCalls(same, { G: null }), []);
});

test("calls in several departments are all announced, in department order", () => {
  const before = { G: null, C: null };
  const after = { G: { number: "G001", calledAt: 1 }, C: { number: "C001", calledAt: 1 } };
  assert.deepEqual(A.newCalls(before, after).map((c) => c.number), ["G001", "C001"]);
});

test("a department that appears for the first time after opening is announced", () => {
  assert.deepEqual(A.newCalls({ G: null }, { G: null, B: { number: "B001", calledAt: 5 } }), [{ code: "B", number: "B001" }]);
});
