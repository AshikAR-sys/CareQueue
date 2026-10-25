# Feature F1 — Shared queue, staff console and Now-Serving display

**Role:** Business Analyst (stage A) · **Source:** `docs/CareQueue_PRD.pdf` (M2, M3, S1), `docs/CareQueue_User_Stories.pdf`

## User problem

Patients cannot see whose turn it is or how long they will wait, so they crowd the counter. The token page issues
tokens, but nothing calls them and nothing displays them: the "displays the current token" half of the problem
statement is missing.

## Stories in scope (IDs from the User Stories PDF)

| Story | PRD | Priority | Summary |
|---|---|---|---|
| US-05 | M2 | Must | Receptionist calls the next token with one click |
| US-06 | M2 | Must | Waiting-room display shows now-serving and the next 5, live, no names |
| US-07 | S1 | Should | Skip an absent patient, recall later |
| US-09 | M3 | Must | Each waiting token shows its estimated wait |
| US-10 | M3 | Must | The estimate learns from real service times after 3 served |

## Acceptance criteria (copied from the User Stories PDF)

- **AC-05.1** Given tokens are waiting, when I press Call Next, the first waiting token becomes Now serving and the previous one is marked done.
- **AC-05.2** Given no tokens are waiting, when I press Call Next, nothing changes and the screen says "No one is waiting".
- **AC-05.3** Given a token was called, it is no longer listed as waiting.
- **AC-06.1** The display shows the new Now Serving token within 2 seconds of Call Next, without a page refresh.
- **AC-06.2** The display shows the next 5 waiting tokens for each queue, in order.
- **AC-06.3** Only token numbers are shown on the display, never names.
- **AC-06.4** The Now Serving number is at least 120 px high.
- **AC-07.1** Skip moves the serving token to a Missed list and the next token can be called.
- **AC-07.2** Recall makes a missed token Now Serving again and the display updates.
- **AC-09.1** With AST 4 min, 1 counter, current patient served for 1 min and 5 ahead, the estimate is 23 min (EWT = R + N × AST, rounded up).
- **AC-09.2** Every waiting token's estimate is recalculated on each queue event, on the staff screen and the display.
- **AC-09.3** A token that is Now Serving shows "Now serving", not a waiting time.
- **AC-10.1** With fewer than 3 served tokens in a queue today, AST is the default 3 minutes.
- **AC-10.2** With 3 or more served, AST is the average of the last 10 (time from Call to done) in that queue.

## Business rules and decisions

1. **A queue is a department.** The token page (designed and approved earlier) issues tokens per department with
   the department letter as prefix (G, C, O, P, D, E). The PRD names two queues, Registration (R) and Billing (B).
   The queue engine works for any set of queues, so switching to R/B is a one-file data change (`frontend/js/data.js`).
   **Open decision for the BA (Sam Austin):** keep departments and update the PRD wording, or switch the data to R/B.
   Until then, this deviation is listed in `docs/project-status.md`.
2. **One counter per queue.** Multiple counters (US-11, Should) are not in this feature.
3. **Call Next completes the current patient.** There is no separate "Complete" button; service time is measured
   from Call to the next Call (or Skip) in that queue.
4. **Initial prototype decision (superseded by the full-stack refactor).** The first implementation kept queue data in browser `localStorage`, one record per day, and shared live between
   the token page, staff console and display opened in the same browser on the demo machine. This is a working
   local system, not a networked one; it is stated as a limitation.
5. **Login is not in this feature.** The PRD lists no login story; staff and display pages are open in the demo.
   Listed as a limitation and a possible "cut on purpose" item.

## Edge cases

- Call Next on an empty queue (AC-05.2).
- Skip when nobody is being served: button disabled.
- Recall while another token is serving: the current one is completed first.
- Day change: a new day starts an empty queue and numbering restarts (AC-02.2).
- First patient with nobody serving: estimate is 0 min, shown as "You're next".
- Storage unavailable (private mode): the page keeps working in memory for the current tab and says so.
- Two tabs open: each must see the other's changes within 2 seconds (AC-06.1).
- Patient names must never reach the display markup (AC-06.3), not just be hidden visually.
