# Feature F2 — Send to Billing

**Role:** Business Analyst (stage A) · **Story:** US-04 (Should) · **Epic:** E1 Token issue · **PRD:** S4 ·
**MRD:** MR-1

## User problem

The problem statement names two queues a patient goes through: **registration and billing**. Today a patient who has
finished at a department counter must start again for billing: get a new token by hand, re-enter their details and
join the back of a queue nobody can see. Staff also lose the link between the visit and the bill.

## Story

**As a** receptionist, **I want** to move a patient who has finished at the counter into the billing queue with one
click, **so that** they keep their place in the flow without re-entering their details.

## Acceptance criteria (from the User Stories PDF)

- **AC-04.1** Given a token is being served (e.g. G001), when I press **Send to Billing**, then a new billing token
  (e.g. B001) is created for the same patient and the first token is marked done.
- **AC-04.2** Given a billing token was created this way, when I look at it in the staff screen, then it shows the
  token number it came from.

## Business rules

1. **Billing is a queue of its own**, code **B**, named "Billing", at the main reception. It numbers B001, B002…
   independently, resets daily, appears on the staff console and the display, and gets its own wait estimate like
   any other queue. Patients can also choose Billing directly on the token page (someone only paying a bill).
2. **Send to Billing works only on the token being served**, in any queue except Billing itself.
3. The first token is **completed** (it counts as a served patient for that queue's average service time); the new
   billing token joins the **end** of the billing queue as a normal waiting token.
4. The patient's details (name, age, gender, phone) are **copied** to the billing token; the doctor is not needed.
5. The two tokens are **linked both ways**: the billing token records where it came from; the first token records
   where it went.
6. The patient's open token page tells them: "Sent to Billing: your billing token is B001".
7. The waiting-room display shows the billing queue like any other, token numbers only, never names.

## Edge cases

- Nobody being served → the button is disabled and says why.
- The Billing tab is selected → the button is hidden (billing cannot send to billing).
- A billing token is skipped, recalled or completed → same rules as every other queue.
- No doctors in Billing → the doctor field on the token page is disabled with "No doctor needed for Billing."

## Out of scope

Bill amounts and payments (PRD: out of scope); sending to queues other than Billing.
