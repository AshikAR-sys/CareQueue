// Unit tests for the Tamil text (US-18) in frontend/js/i18n.js and the voice choice in announce.js.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../frontend/js/i18n.js");
const A = require("../frontend/js/announce.js");

test("every English text has a Tamil version", () => {
  assert.deepEqual(Object.keys(I.TEXT.ta).sort(), Object.keys(I.TEXT.en).sort());
  for (const [key, text] of Object.entries(I.TEXT.ta)) {
    assert.ok(/[஀-௿]/.test(text), key + " is not in Tamil script");
    const want = (I.TEXT.en[key].match(/\{\w+\}/g) || []).sort();
    assert.deepEqual((text.match(/\{\w+\}/g) || []).sort(), want, key + " has different placeholders");
  }
});

test("labels, counters and waits switch language (AC-18.1)", () => {
  assert.equal(I.t("en", "now"), "Now serving");
  assert.equal(I.t("ta", "now"), "இப்போது சேவையில்");
  assert.equal(I.t("ta", "counter", { n: 2 }), "கவுண்டர் 2");
  assert.equal(I.t("ta", "about", { n: 6 }), "சுமார் 6 நிமிடம்");
  assert.equal(I.t("xx", "counter", { n: 1 }), "Counter 1", "unknown languages fall back to English");
});

test("department names and places are translated for Tamil only", () => {
  assert.equal(I.deptName("ta", "G", "General Medicine"), "பொது மருத்துவம்");
  assert.equal(I.deptName("en", "G", "General Medicine"), "General Medicine");
  assert.equal(I.deptName("ta", "Z", "New Clinic"), "New Clinic", "an unknown department keeps its English name");
  assert.equal(I.place("ta", "Ground floor, Block A"), "தரைத் தளம், பிளாக் A");
  assert.equal(I.place("en", "Ground floor, Block A"), "Ground floor, Block A");
});

test("the Tamil announcement names the token, department and counter (AC-18.2)", () => {
  assert.equal(I.announcementTa("G001", "G", "General Medicine", 1),
    "டோக்கன் எண் G 0 0 1, பொது மருத்துவம், கவுண்டர் 1-க்கு வாருங்கள்.");
});

test("the language comes from the address, then this device's choice, then English (AC-18.1, AC-18.3)", () => {
  assert.equal(I.chosen("?lang=ta", "en"), "ta");
  assert.equal(I.chosen("", "ta"), "ta");
  assert.equal(I.chosen("?t=G001", null), "en");
  assert.equal(I.chosen("?lang=fr", "xx"), "en");
});

test("a Tamil voice is used only when the device has one (AC-18.2)", () => {
  const voices = [{ lang: "en-IN", name: "English India" }, { lang: "ta-IN", name: "Pallavi" }];
  assert.equal(A.pickVoice(voices, "ta").name, "Pallavi");
  assert.equal(A.pickVoice([{ lang: "en-US", name: "US" }], "ta"), null);
  assert.equal(A.pickVoice([{ lang: "ta_IN", name: "Android Tamil" }], "ta").name, "Android Tamil");
  assert.equal(A.pickVoice([], "ta"), null);
});
