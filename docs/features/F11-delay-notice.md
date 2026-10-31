# Feature F11 — Doctor delay notice

**Role:** Business Analyst (stage A) · **Story:** US-21 (Could) · **Epic:** E3 Waiting-time estimate · **PRD:** M3 ·
**MRD:** MR-3

## Story

**As a** receptionist, **I want** to post a short delay notice for a department, such as "Doctor in surgery, about
20 minutes late", **so that** patients know why the line has stopped and their estimate stays honest.

## Acceptance criteria

- **AC-21.1** The waiting-room display and every phone tracking page for that department show the notice.
- **AC-21.2** A 20-minute delay adds 20 minutes to every waiting token's estimate in that department.
- **AC-21.3** When staff clear the notice, or its time runs out, it disappears and estimates return to normal.

## Business rules

1. Staff choose a reason from a fixed list (Doctor in surgery / on a short break / attending an emergency /
   Running late) and 10–60 minutes (the server accepts 5–180). A fixed list keeps patient details off public screens
   and lets the notice show in Tamil.
2. The delay counts down: the notice and the estimates use the minutes left, and the notice ends by itself.
   **Update** replaces it; **Clear** removes it.
3. EWT = delay left + R + (N / C) × AST. Other departments are not affected.
4. The phone page shows the notice while the patient is waiting (not once they are called).
5. Only staff can post or clear a notice (staff pass required).
