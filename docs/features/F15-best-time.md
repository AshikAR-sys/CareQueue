# Feature F15 — Best time to visit

**Role:** Business Analyst (stage A) · **Story:** US-25 (Could) · **Epic:** E6 Queue reports · **PRD:** C2 ·
**MRD:** MR-3, MR-4

## Story

**As a** patient, **I want** to see which hours are usually quiet in each department before I come, **so that** I
can choose a time with a short wait.

## Acceptance criteria

- **AC-25.1** With records from earlier days, the Best time page shows each department's usual tokens per hour and
  names the quietest hours.
- **AC-25.2** With fewer than 3 days of records, it says there is not enough history yet instead of guessing.
- **AC-25.3** It shows only counts per hour, never patient details, and needs no sign-in.

## Business rules

1. `best-time.html`, linked from the landing page and the phone tracking page; English / Tamil switch.
2. Data: `GET /api/history/hourly` returns `[department code, issue time, date]` for tokens of the previous 28 days
   (not today). Hours are worked out in the visitor's browser, in local time.
3. Usual tokens per hour = tokens in that hour ÷ days on record (a day with none in that hour counts as 0), over the
   hours the department was open. The two lowest are the quietest hours (shown in teal), and the highest is named as
   the busiest.
4. At least 3 days of records are needed. On the free Render plan the database is reset on each redeploy, so the live
   page needs a few days without redeploys (or a persistent database) to show advice.
5. Browser tests fill earlier days through `POST /api/test/seed-history`, which exists only in test mode (404
   otherwise), with sample patients.
