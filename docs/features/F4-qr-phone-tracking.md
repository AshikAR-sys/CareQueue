# Feature F4 — Track my token on my phone (QR)

**Role:** Business Analyst (stage A) · **Story:** US-13 (Should) · **Epic:** E4 Patient's token copy ·
**PRD:** S3 · **MRD:** MR-3

## User problem

Patients have to keep watching the waiting-room display, so they cannot step away for water, a washroom or a
pharmacy queue without the risk of missing their turn.

## Story

**As a** patient, **I want** to scan a QR code on my token and see my position live, **so that** I don't have to
keep watching the screen.

## Acceptance criteria (from the User Stories PDF)

- **AC-13.1** Given I scan the QR code on my slip, when the page opens, then it shows my token, the token being
  served, people ahead and my estimated wait, with no app and no login.
- **AC-13.2** Given I keep the page open, when the queue moves, then the page updates without refresh.
- **AC-13.3** Given 2 or fewer patients are ahead of me, when the page updates, then it shows an "Almost your turn"
  alert.

## Business rules

1. **Where the QR code appears:** on the issued token card, the printed slip and the downloaded PNG. Not before a
   token exists.
2. **What it opens:** `track.html?t=<token>&d=<date>` on the same server. The page needs no sign-in.
3. **Privacy:** the page reads the public queue endpoint, so it shows token numbers, department and the estimate
   only. No patient names or phone numbers.
4. **Live:** the page refreshes the queue every second and shows "Live · <time>", or "Reconnecting…" when the
   server does not answer (the last view stays on screen).
5. **States:** waiting (people ahead + estimate), almost (2 or fewer ahead, highlighted alert), your turn now,
   missed (go to reception), sent to Billing (shows the billing token with a link to track it), visit completed.
6. **Old or wrong links:** tokens restart each day, so a slip from another day says so instead of showing today's
   token with the same number. A missing or unknown number shows a short explanation.
7. **Same estimate everywhere:** the page uses the same EWT rule as the token card and display (`QueueCore`).

## Out of scope

- Push notifications or SMS when the turn is near (the page must be open).
- A phone reaching a laptop running `npm start`: the local server listens on `127.0.0.1`. The QR code works on the
  deployed site (Render), where the phone can reach the server.
