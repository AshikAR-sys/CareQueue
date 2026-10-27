# Feature F8 — Tamil display, voice and phone page

**Role:** Business Analyst (stage A) · **Story:** US-18 (Could) · **Epic:** E2 Calling and Now-Serving display ·
**PRD:** C3 · **MRD:** MR-2

## Story

**As a** Tamil-speaking patient, **I want** the waiting-room display, the voice call and my phone page in Tamil,
**so that** I understand when my turn comes even if I do not read English.

## Acceptance criteria

- **AC-18.1** Staff choose Tamil with the display's language switch: labels, department names and counters are shown
  in Tamil, and the choice is remembered on that screen.
- **AC-18.2** With Tamil chosen and sound on, calls are spoken in Tamil (token number, department, counter). If the
  device has no Tamil voice, the display says so and speaks English.
- **AC-18.3** The phone tracking page has the same switch and is shown in Tamil when chosen.

## Business rules

1. **Switch:** English / தமிழ் at the top of the display and of the phone page. Remembered per device; `?lang=ta` in
   the address opens a page in Tamil.
2. **What changes:** labels, waits ("சுமார் 3 நிமிடம்"), counters ("கவுண்டர் 2"), the Priority mark, department names
   and places (floors, blocks). Token numbers stay as printed (G001).
3. **Voice:** "டோக்கன் எண் G 0 0 1, பொது மருத்துவம், கவுண்டர் 1-க்கு வாருங்கள்." Spoken with the device's Tamil
   voice. Many Windows PCs and Android phones have one (for example Microsoft Edge's online Tamil voices); headless
   and some desktop browsers have none, so the English fallback and the on-screen note are needed.
4. **Font:** Noto Sans Tamil (Google Fonts) on the display and phone page, so Tamil looks the same on every device.
5. **Staff and token pages stay in English** (staff work in English; the token form is out of scope here).

## Review needed

The Tamil text was written by the developer with AI help. A Tamil-speaking team member should read the display and
phone page once (switch to தமிழ்) and correct any wording in `frontend/js/i18n.js` before the demo.
