# Feature F13 — Share my token with family

**Role:** Business Analyst (stage A) · **Story:** US-23 (Could) · **Epic:** E4 Patient's token copy · **PRD:** S3 ·
**MRD:** MR-3

## Story

**As a** patient, **I want** to send my live token link to a family member through WhatsApp or any app on my
phone, **so that** the person waiting outside knows when to come in.

## Acceptance criteria

- **AC-23.1** Share on the token card or the phone page opens the phone's share sheet with the tracking link and a
  short message; where sharing is not available, the link is copied.
- **AC-23.2** The shared link shows the same live token, wait and alerts, with no patient name or phone number.

## Business rules

1. The message is "Follow my CareQueue token G004 (General Medicine) live:" plus the tracking link (in Tamil on a
   Tamil phone page). It never includes the patient's name or phone.
2. The browser's Web Share sheet is used where available (phones; some desktops). If the patient closes it, nothing
   else happens. Otherwise the message and link are copied to the clipboard, with "Link copied. Paste it in
   WhatsApp or a message."
3. The link is the same tracking page as the QR code: anyone with it can follow the token, step out once or rate
   the visit for it (the same limits as US-13, US-20 and US-22).
