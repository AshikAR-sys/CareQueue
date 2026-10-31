// Unit tests for "share my token" (US-23) in frontend/js/share.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../frontend/js/share.js");

const URL_ = "https://carequeue-demo.onrender.com/track.html?t=G004&d=2026-10-31";

test("the shared message names the token and department, in English or Tamil (AC-23.1)", () => {
  const en = S.shareData("en", "G004", "General Medicine", URL_);
  assert.equal(en.title, "CareQueue token G004");
  assert.equal(en.text, "Follow my CareQueue token G004 (General Medicine) live:");
  assert.equal(en.url, URL_);
  const ta = S.shareData("ta", "G004", "பொது மருத்துவம்", URL_);
  assert.match(ta.text, /G004/);
  assert.match(ta.text, /[஀-௿]/);
});

test("the shared message carries no patient details (AC-23.2)", () => {
  const d = S.shareData("en", "G004", "General Medicine", URL_);
  assert.deepEqual(Object.keys(d).sort(), ["text", "title", "url"]);
  assert.ok(!/\d{10}/.test(d.text + d.url), "no phone number");
});

test("share uses the phone's share sheet, else copies the link, else reports failure", async () => {
  const data = S.shareData("en", "G004", "General Medicine", URL_);
  const shared = [];
  assert.equal(await S.share(data, { share: async (d) => shared.push(d) }), "shared");
  assert.equal(shared[0].url, URL_);
  const copied = [];
  assert.equal(await S.share(data, { clipboard: { writeText: async (t) => copied.push(t) } }), "copied");
  assert.equal(copied[0], data.text + " " + URL_);
  assert.equal(await S.share(data, {}), "failed");
  const cancel = Object.assign(new Error("cancel"), { name: "AbortError" });
  assert.equal(await S.share(data, { share: async () => { throw cancel; } }), "cancelled");
});
