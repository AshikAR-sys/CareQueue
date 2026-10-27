// English and Tamil text for the waiting-room display and the phone tracking page (US-18).
// Plain functions and tables, unit-tested in Node (module.exports); in the browser: window.CareQueueI18n.
(function (root) {
  "use strict";

  const LANGS = ["en", "ta"];
  const STORE_KEY = "carequeue-lang";

  // {n}, {dept}, {counter}, {token} are filled in by t().
  const TEXT = {
    en: {
      "display.title": "Now serving",
      "now": "Now serving",
      "next": "Next",
      "next.count": "Next ({n} waiting)",
      "next.soon": "Next",
      "about": "about {n} min",
      "none.serving": "No patients being served",
      "none.waiting": "No one waiting",
      "empty.title": "No tokens issued yet today",
      "empty.body": "Get your token at the reception desk or on the token page.",
      "counter": "Counter {n}",
      "priority": "Priority",
      "sound.off": "Turn on sound",
      "sound.on": "Sound on",
      "display.foot": "Keep your token with you. When your number appears under Now serving, go to that department.",
      "voice.missing": "This screen has no Tamil voice, so calls are announced in English.",
      "track.title": "Your token",
      "track.serving": "Now serving",
      "track.ahead": "People ahead",
      "track.wait": "Estimated wait",
      "track.none": "None yet",
      "track.next": "You're next",
      "track.about": "About {n} min",
      "track.now": "Now",
      "track.live": "Live · {time}",
      "track.reconnecting": "Reconnecting…",
      "track.almost": "Almost your turn. Please be near {dept}.",
      "track.turn": "It's your turn now. Please go to {dept}, Counter {counter}.",
      "track.missed": "Your number was called and missed. Please tell the reception desk.",
      "track.billing": "Sent to Billing. Your billing token is {token}.",
      "track.billing.link": "Track {token}",
      "track.done": "Visit completed. Thank you.",
      "track.invalid": "This link has no token number. Scan the QR code on your token again.",
      "track.notfound": "We can't find this token today. Please ask at the reception desk.",
      "track.stale": "This token was for {date}. Tokens start again each day; please get a new one.",
      "track.foot": "Keep this page open: it updates by itself. No app or sign-in needed.",
      "the.department": "the department",
      "alert.off": "Alert me when my turn is near",
      "alert.on": "Alerts on",
      "alert.note.on": "Keep this page open. Your phone will chime and vibrate when 2 or fewer are ahead, and when you are called.",
      "alert.note.blocked": "Notifications are blocked on this phone. You will still hear a chime while this page is open.",
      "alert.almost.title": "Almost your turn ({token})",
      "alert.almost.body": "{dept}: {n} ahead of you.",
      "alert.turn.title": "Your turn now ({token})",
      "alert.turn.body": "Please go to {dept}, Counter {counter}."
    },
    ta: {
      "display.title": "இப்போது சேவையில்",
      "now": "இப்போது சேவையில்",
      "next": "அடுத்து",
      "next.count": "அடுத்து ({n} பேர் காத்திருக்கிறார்கள்)",
      "next.soon": "அடுத்தது",
      "about": "சுமார் {n} நிமிடம்",
      "none.serving": "யாரும் அழைக்கப்படவில்லை",
      "none.waiting": "காத்திருப்பவர் இல்லை",
      "empty.title": "இன்று இன்னும் டோக்கன் வழங்கப்படவில்லை",
      "empty.body": "வரவேற்பு மேசையில் அல்லது டோக்கன் பக்கத்தில் உங்கள் டோக்கனைப் பெறுங்கள்.",
      "counter": "கவுண்டர் {n}",
      "priority": "முன்னுரிமை",
      "sound.off": "ஒலியை இயக்கு",
      "sound.on": "ஒலி இயக்கத்தில்",
      "display.foot": "உங்கள் டோக்கனை உடன் வைத்திருங்கள். உங்கள் எண் \"இப்போது சேவையில்\" கீழ் தோன்றும்போது அந்தப் பிரிவுக்குச் செல்லுங்கள்.",
      "voice.missing": "இந்தத் திரையில் தமிழ்க் குரல் இல்லை, எனவே அழைப்புகள் ஆங்கிலத்தில் அறிவிக்கப்படும்.",
      "track.title": "உங்கள் டோக்கன்",
      "track.serving": "இப்போது சேவையில்",
      "track.ahead": "உங்களுக்கு முன்",
      "track.wait": "மதிப்பிடப்பட்ட காத்திருப்பு",
      "track.none": "இன்னும் இல்லை",
      "track.next": "அடுத்தது நீங்கள்",
      "track.about": "சுமார் {n} நிமிடம்",
      "track.now": "இப்போது",
      "track.live": "நேரலை · {time}",
      "track.reconnecting": "மீண்டும் இணைக்கிறது…",
      "track.almost": "உங்கள் முறை நெருங்குகிறது. {dept} அருகில் இருங்கள்.",
      "track.turn": "உங்கள் முறை வந்துவிட்டது. {dept}, கவுண்டர் {counter}-க்குச் செல்லுங்கள்.",
      "track.missed": "உங்கள் எண் அழைக்கப்பட்டது, நீங்கள் வரவில்லை. வரவேற்பு மேசையில் தெரிவியுங்கள்.",
      "track.billing": "கட்டணப் பிரிவுக்கு அனுப்பப்பட்டீர்கள். உங்கள் கட்டண டோக்கன் {token}.",
      "track.billing.link": "{token}-ஐப் பின்தொடர",
      "track.done": "உங்கள் வருகை முடிந்தது. நன்றி.",
      "track.invalid": "இந்த இணைப்பில் டோக்கன் எண் இல்லை. உங்கள் டோக்கனில் உள்ள QR குறியீட்டை மீண்டும் ஸ்கேன் செய்யுங்கள்.",
      "track.notfound": "இன்று இந்த டோக்கன் கிடைக்கவில்லை. வரவேற்பு மேசையில் கேளுங்கள்.",
      "track.stale": "இந்த டோக்கன் {date} தேதிக்கானது. டோக்கன்கள் ஒவ்வொரு நாளும் புதிதாகத் தொடங்கும்; புதிய டோக்கன் பெறுங்கள்.",
      "track.foot": "இந்தப் பக்கத்தைத் திறந்தே வைத்திருங்கள்: இது தானாகப் புதுப்பிக்கப்படும். ஆப் அல்லது உள்நுழைவு தேவையில்லை.",
      "the.department": "அந்தப் பிரிவு",
      "alert.off": "என் முறை நெருங்கும்போது எனக்குத் தெரிவி",
      "alert.on": "அறிவிப்புகள் இயக்கத்தில்",
      "alert.note.on": "இந்தப் பக்கத்தைத் திறந்தே வைத்திருங்கள். உங்களுக்கு முன் 2 அல்லது குறைவானவர்கள் இருக்கும்போதும், நீங்கள் அழைக்கப்படும்போதும் தொலைபேசி ஒலித்து அதிரும்.",
      "alert.note.blocked": "இந்தத் தொலைபேசியில் அறிவிப்புகள் தடுக்கப்பட்டுள்ளன. இந்தப் பக்கம் திறந்திருக்கும் வரை ஒலி கேட்கும்.",
      "alert.almost.title": "உங்கள் முறை நெருங்குகிறது ({token})",
      "alert.almost.body": "{dept}: உங்களுக்கு முன் {n} பேர்.",
      "alert.turn.title": "உங்கள் முறை வந்துவிட்டது ({token})",
      "alert.turn.body": "{dept}, கவுண்டர் {counter}-க்குச் செல்லுங்கள்."
    }
  };

  const DEPARTMENTS_TA = {
    G: "பொது மருத்துவம்",
    C: "இதய மருத்துவம்",
    O: "எலும்பு மருத்துவம்",
    P: "குழந்தை மருத்துவம்",
    D: "தோல் மருத்துவம்",
    E: "காது, மூக்கு, தொண்டை",
    B: "கட்டணப் பிரிவு"
  };

  const PLACES_TA = [
    [/Ground floor/g, "தரைத் தளம்"], [/First floor/g, "முதல் தளம்"], [/Second floor/g, "இரண்டாம் தளம்"],
    [/Main reception/g, "முதன்மை வரவேற்பு"], [/Block ([A-Z])/g, "பிளாக் $1"]
  ];

  function normalise(lang) { return LANGS.includes(lang) ? lang : "en"; }

  function t(lang, key, vars) {
    const table = TEXT[normalise(lang)];
    const text = key in table ? table[key] : TEXT.en[key];
    if (text === undefined) return key;
    return text.replace(/\{(\w+)\}/g, (m, name) => (vars && name in vars ? String(vars[name]) : m));
  }

  function deptName(lang, code, english) {
    return normalise(lang) === "ta" && DEPARTMENTS_TA[code] ? DEPARTMENTS_TA[code] : english;
  }

  function place(lang, english) {
    if (normalise(lang) !== "ta") return english;
    return PLACES_TA.reduce((s, [pattern, ta]) => s.replace(pattern, ta), english);
  }

  // "G001" -> "G 0 0 1", as in the English announcement (announce.js).
  function spokenNumber(number) { return String(number).split("").join(" "); }

  // "டோக்கன் எண் G 0 0 1, பொது மருத்துவம், கவுண்டர் 1-க்கு வாருங்கள்."
  function announcementTa(number, code, english, counter) {
    return "டோக்கன் எண் " + spokenNumber(number) + ", " + deptName("ta", code, english) +
      (counter ? ", கவுண்டர் " + counter + "-க்கு வாருங்கள்." : " பிரிவுக்கு வாருங்கள்.");
  }

  // ?lang=ta in the address wins; then the choice saved on this device; then English.
  function chosen(search, saved) {
    const fromUrl = new URLSearchParams(search || "").get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    return LANGS.includes(saved) ? saved : "en";
  }

  const api = { LANGS, STORE_KEY, TEXT, t, deptName, place, announcementTa, chosen };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  function load() {
    let saved = null;
    try { saved = root.localStorage.getItem(STORE_KEY); } catch (e) { /* storage blocked: English */ }
    return chosen(root.location.search, saved);
  }

  function save(lang) {
    try { root.localStorage.setItem(STORE_KEY, normalise(lang)); } catch (e) { /* this page only */ }
  }

  root.CareQueueI18n = Object.assign({ load, save }, api);
})(typeof window !== "undefined" ? window : globalThis);
