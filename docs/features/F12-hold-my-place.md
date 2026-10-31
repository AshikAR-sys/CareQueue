# Feature F12 — Hold my place while I step out

**Role:** Business Analyst (stage A) · **Story:** US-22 (Could) · **Epic:** E2 Calling and Now-Serving display ·
**PRD:** S1 · **MRD:** MR-2

## Story

**As a** patient, **I want** to tell the queue I am stepping out for up to 15 minutes from my phone, **so that** I
can go to the washroom or pharmacy without losing my turn.

## Acceptance criteria

- **AC-22.1** I tap "I'm stepping out" and choose 5, 10 or 15 minutes; the staff list shows "Away until" my return
  time and my phone shows when my place is held until.
- **AC-22.2** If I reach the front while away, Call Next calls the next patient who is present, and I keep my place
  at the front.
- **AC-22.3** When I tap "I'm back", or my time runs out, I can be called again as normal.

## Business rules

1. Only a waiting token can step out, **once per token** (stops the line being held forever).
2. While away the token keeps its position; Call Next (on the server and in the screens) picks the first waiting
   token that is not away. If everyone waiting is away, Call Next calls nobody and the console says so.
3. The staff list shows an "Away until 11:40" tag and Call Next names the next present patient. The display shows
   "Stepped out" instead of the wait. No patient details are shown.
4. `POST /api/tokens/<number>/away` with `{"minutes": 5|10|15}` or `{"back": true}`, from the phone page with no
   sign-in (400 bad minutes, 404 unknown token, 409 not waiting / already used / not away).
5. English and Tamil on the phone page.

## Known limit

As with the rating, anyone who knows a token number could mark it as away once. The effect is small (that patient
is called a few minutes later), and staff can see the tag.
