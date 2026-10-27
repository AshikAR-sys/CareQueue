# Feature F6 — Multiple counters

**Role:** Business Analyst (stage A) · **Story:** US-11 (Should, size L) · **Epic:** E3 Waiting-time estimate ·
**PRD:** S5 · **MRD:** MR-3

## User problem

At busy hours a department opens a second or third counter, but the queue could only serve one patient at a time and
the estimate assumed one counter, so waits were overstated and two receptionists could not work the same queue.

## Story

**As a** receptionist, **I want** to open up to 3 counters for a queue, each calling its own patient, and have the
estimate know how many are open, **so that** two of us can serve at once and waits are not overstated.

The team chose "full counters" (each counter calls its own patient) over "estimate only". AC-11.3 and AC-11.4 were
added to the User Stories PDF for this.

## Acceptance criteria

- **AC-11.1** Given 2 counters are open for a queue, when the estimate is calculated, then N is divided by 2.
- **AC-11.2** Given a counter is paused, when the estimate is recalculated, then the paused counter is not counted,
  and it cannot call patients until it is opened again.
- **AC-11.3** Given Counter 1 is serving G004, when the receptionist at Counter 2 presses Call Next, then G005 is
  called to Counter 2 and G004 stays at Counter 1.
- **AC-11.4** Given a token is called to a counter, when the display, voice announcement and patient's phone update,
  then each names the counter.

## Business rules

1. **Counters:** each queue has Counters 1–3. Counter 1 is open at the start of each day; 2 and 3 are paused until a
   receptionist opens them. The setting is saved on the server per day.
2. **My counter:** each receptionist picks their counter in the staff console (remembered per department in that
   browser). Call Next, Skip, Send to Billing and Recall act on that counter only.
3. **Call Next** completes the patient at that counter (not at other counters) and calls the next waiting token to it.
   Waiting order stays one line for the whole queue: first come, first served at whichever counter is free.
4. **Pausing:** a counter serving a patient cannot be paused (finish or skip first), and at least one counter stays
   open. A paused counter cannot call.
5. **Estimate:** EWT = R + (N / C) × AST. C = open counters; R = time until the first open counter is free (0 when
   one is idle); N = tokens ahead; AST unchanged (average of the last 10 served, default 3 min).
6. **Where the counter shows:** display (each serving token with a "Counter N" badge), voice ("…please come to
   General Medicine, counter 2."), the patient's token card ("It's your turn now · Counter 2"), the phone tracking
   page and the staff console's counter chips.
7. **Older data:** tokens called before this change have no counter and are treated as Counter 1.

## Out of scope

- More than 3 counters, named counters (e.g. "Room 4"), assigning a patient to a specific counter or doctor.
