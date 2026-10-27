# Feature F7 — Priority tokens

**Role:** Business Analyst (stage A) · **Story:** US-17 (Could) · **Epic:** E1 Token issue · **PRD:** C1 · **MRD:** MR-1

## Story

**As a** receptionist, **I want** seniors (60+), pregnant women and emergencies to get a priority token that is
called before the normal line, **so that** the patients who cannot wait long are seen first.

## Acceptance criteria

- **AC-17.1** A patient chooses Priority and a reason (Senior 60+, Pregnant, Emergency); the token is marked Priority.
  Senior is refused if the age is under 60.
- **AC-17.2** With priority and normal tokens waiting, Call Next calls the earliest priority token first.
- **AC-17.3** The staff screen and display mark priority tokens; the display shows only the mark, never the reason.
- **AC-17.4** People-ahead counts and estimates follow the calling order.

## Business rules

1. Priority is chosen on the token form (default **None**) and resets to None after each token, so the next patient
   does not inherit it.
2. Priority tokens share the queue's numbering (e.g. G003) and wait ahead of normal tokens, earliest first. With
   several counters, any free counter calls the first priority token.
3. The reason is shown to staff and on the patient's own token, print-out and PNG. Public views (display, phone page,
   reports) receive only "priority: yes".
4. A priority patient sent to Billing keeps priority in the Billing queue.
5. Recall still serves the missed token at the chosen counter, whatever its priority.
6. The server validates the reason and the Senior age rule; the browser checks the same rule before sending.

## Out of scope

- Limits that stop normal tokens waiting forever when many priority tokens arrive (e.g. one normal call after every
  two priority calls). Proof such as an ID check is left to the receptionist.
