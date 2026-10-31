// "Share my token" (US-23): send the live tracking link to family through the phone's share sheet.
// Plain functions, unit-tested in Node (module.exports); in the browser: window.CareQueueShare.
(function (root) {
  "use strict";

  const TEXT = {
    en: (token, dept) => "Follow my CareQueue token " + token + " (" + dept + ") live:",
    ta: (token, dept) => "எனது CareQueue டோக்கன் " + token + " (" + dept + ") நிலையை நேரலையில் பாருங்கள்:"
  };

  // Only the token number, department and tracking link: never the patient's name or phone.
  function shareData(lang, token, dept, url) {
    return { title: "CareQueue token " + token, text: (TEXT[lang] || TEXT.en)(token, dept), url };
  }

  // nav is the browser's navigator (passed in so the tests can stand in for it).
  // Resolves to "shared", "cancelled" (the patient closed the share sheet), "copied" or "failed".
  async function share(data, nav) {
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share(data);
        return "shared";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancelled";
        // not allowed here (e.g. no share target): fall back to copying
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try {
        await nav.clipboard.writeText(data.text + " " + data.url);
        return "copied";
      } catch (e) { /* clipboard blocked */ }
    }
    return "failed";
  }

  const api = { shareData, share };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CareQueueShare = api;
})(typeof window !== "undefined" ? window : globalThis);
