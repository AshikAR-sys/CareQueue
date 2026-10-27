# Feature F9 — "Your turn is near" alert

**Role:** Business Analyst (stage A) · **Story:** US-19 (Could) · **Epic:** E4 Patient's token copy · **PRD:** C4 ·
**MRD:** MR-3

## Story

**As a** patient, **I want** my phone to alert me when 2 or fewer people are ahead of me and when I am called,
**so that** I can step away and come back in time.

## Acceptance criteria

- **AC-19.1** With alerts on, when 2 or fewer patients are ahead, the phone chimes, vibrates if it can and shows a
  notification once.
- **AC-19.2** When the token is called, the patient is alerted again with the counter.
- **AC-19.3** No repeat alert for the same state; turning alerts off stops them.

## Business rules

1. **Alert me** button on the phone tracking page (English and Tamil). Pressing it allows sound, asks for
   notification permission and registers `sw.js`, which Android needs to show notifications.
2. The state when alerts are turned on is only the starting point (no alert for it). Then one alert for "almost"
   and one for each call to a counter (a recall to another counter alerts again).
3. Each alert: chime, vibration, a system notification (if allowed), the page title shows "🔔 …" and the card
   flashes. If notifications are blocked, the page says so and still chimes while open.
4. The page must stay open (it may be in the background). Phones can pause pages when the screen is locked for
   long, so alerts can be late then.

## Not SMS

PRD C4 mentions SMS or WhatsApp. Sending real messages needs a paid gateway and the patient's phone number to leave
the hospital system, so this version uses the phone's own notifications instead. An SMS gateway can be added later
behind the same rules (`frontend/js/alerts.js`).
