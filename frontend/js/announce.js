// Voice announcements for the waiting-room display (US-08).
// The rules (what to say, when a call is new) are plain functions, unit-tested in Node (module.exports).
// In the browser it also plays a chime and speaks through window.speechSynthesis (window.CareQueueAnnouncer).
(function (root) {
  "use strict";

  // "G001" -> "G 0 0 1": each character read out, clearer in a noisy hall.
  function spokenNumber(number) {
    return String(number).split("").join(" ");
  }

  // US-11: with a counter, "Token G 0 0 5, please come to General Medicine, counter 2."
  function announcementText(number, departmentName, counter) {
    return "Token " + spokenNumber(number) + ", please come to " + departmentName + (counter ? ", counter " + counter : "") + ".";
  }

  // A snapshot maps each place a token is served (a department code, or "code#counter" with several counters) to
  // the token there, { number, calledAt, code?, counter? }, or null.
  // A call is new when a place serves a different token, or the same token with a new calledAt (Recall).
  // The first snapshot (previous === null) is only a baseline: opening the display announces nothing.
  function newCalls(previous, current) {
    if (!previous) return [];
    const calls = [];
    for (const code of Object.keys(current)) {
      const now = current[code];
      if (!now) continue;
      const before = previous[code];
      if (!before || before.number !== now.number || before.calledAt !== now.calledAt) {
        const call = { code: now.code || code, number: now.number };
        if (now.counter) call.counter = now.counter;
        calls.push(call);
      }
    }
    return calls;
  }

  // US-18: the device voice for a language ("ta" matches "ta-IN" and Android's "ta_IN"), or null if it has none.
  function pickVoice(voices, lang) {
    return (voices || []).find((v) => {
      const tag = String(v.lang || "").toLowerCase().replace("_", "-");
      return tag === lang || tag.startsWith(lang + "-");
    }) || null;
  }

  const rules = { spokenNumber, announcementText, newCalls, pickVoice };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = rules;
    return;
  }

  // ---------- browser: chime + speech, one announcement at a time ----------
  const history = [];          // what was announced, newest last (used by the display and its tests)
  let enabled = false;
  let audio = null;
  let chain = Promise.resolve();

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function chime() {
    try {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return false;
      audio = audio || new Ctx();
      if (audio.state === "suspended") audio.resume();
      const t = audio.currentTime;
      [[880, 0], [660, 0.28]].forEach(([freq, delay]) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.3, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.26);
        osc.connect(gain).connect(audio.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.3);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function voices() {
    try { return "speechSynthesis" in root ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; }
  }

  // True when this device can speak the language (US-18). Voice lists can load late, so ask each time.
  function hasVoice(lang) { return lang === "en" || !!pickVoice(voices(), lang); }

  // Resolves when the sentence has been spoken (or after a safety timeout if the browser has no voice).
  function speak(text, lang) {
    return new Promise((resolve) => {
      const done = () => resolve();
      try {
        if (!("speechSynthesis" in root)) return done();
        const u = new root.SpeechSynthesisUtterance(text);
        const voice = lang === "ta" ? pickVoice(voices(), "ta") : null;
        u.lang = voice ? voice.lang : "en-IN";
        if (voice) u.voice = voice;
        u.rate = 0.9;
        u.onend = done;
        u.onerror = done;
        root.speechSynthesis.speak(u);
        setTimeout(done, Math.min(9000, 1500 + text.length * 90));
      } catch (e) {
        done();
      }
    });
  }

  function announce(text, lang = "en") {
    if (!enabled) return;
    const entry = { text, lang, chime: false, at: Date.now() };
    history.push(entry);
    chain = chain.then(() => { entry.chime = chime(); return wait(700); }).then(() => speak(text, lang));
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) chime();                        // a short test chime confirms the sound works
    else if ("speechSynthesis" in root) root.speechSynthesis.cancel();
  }

  root.CareQueueAnnouncer = Object.assign({ history, announce, setEnabled, hasVoice, isEnabled: () => enabled }, rules);
})(typeof window !== "undefined" ? window : globalThis);
