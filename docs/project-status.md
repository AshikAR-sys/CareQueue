# Project status (role-wise backlog)

Updated: 25 Oct 2026, about 00:45 IST · Demo: 25 Oct, 10:00 IST.
Status labels: **Completed** (with evidence) · **In Progress** · **Pending** · **Blocked** · **Needs Verification**.

## Feature status

| Feature | Stories | Status | Evidence |
|---|---|---|---|
| Token generation (form, validation, order) | US-01, US-02, US-03 | Completed | e2e tests AC-01.1, AC-02.1, AC-03.1 |
| Call Next, Skip, Recall (staff console) | US-05, US-07 | Completed | e2e AC-05.1–05.3, AC-07.1–07.2 |
| Now-Serving display | US-06 | Completed | e2e AC-06.1–06.4 (28 ms update, 158 px number, no names) |
| Estimated waiting time | US-09, US-10 | Completed | unit tests AC-09.1 (23 min example), AC-10.1–10.2; e2e AC-09.2–09.3 |
| Print / download slip | US-12 | Completed | browser test (download file saved, one-page print) in PR #1 |
| Send to Billing | US-04 | Pending | not built |
| Voice announcement | US-08 | Pending | not built |
| Multiple counters | US-11 | Pending | not built |
| QR phone tracking | US-13 | Pending | not built |
| Login / authentication | none in PRD | Pending (out of scope) | no code exists; recommended for "cut on purpose" |
| Backend / database | none in PRD | Pending (out of scope) | browser storage used instead; documented |

## Role-wise backlog

| Role | Owner | Completed (evidence) | Pending | Blocked / depends on | Next action |
|---|---|---|---|---|---|
| Business Analyst / PM | Sam Austin | MRD, PRD, epics, stories (`docs/*.pdf`); F1 spec (`docs/features/F1-queue-and-display.md`) | Decide: departments vs Registration/Billing queues. Scope note (5 lines). AI log input. | — | **Make the queue-naming decision** |
| UI/UX Designer | Nishandhini | Token page, staff console, display designs (`docs/screenshots/`, `docs/features/F1-design.md`) | Demo deck (6 slides from the template) | — | Fill slides 1–4 from the MRD/PRD |
| Frontend Developer | Ashik Rasool | Token page, staff console, display (e2e tests) | US-08 voice, US-13 QR (Should) | — | Optional: US-08 voice (small) |
| Backend Developer | Ashik Rasool | Queue rules in `app/queue-core.js` (19 unit tests) | — | No server by design | — |
| Database Developer | Ashik Rasool | Daily queue record in browser storage (persistence e2e test) | — | No database by design | — |
| QA Engineer | Rogasree | Automated: 29 tests pass (`npm run test:all`) | **Needs Verification:** mark all 35 ACs pass/fail on the checklist in the User Stories PDF by hand; record the backup demo video | PR merged | Run the manual checklist on the demo laptop |
| Integration / Demo | Ashik + Sam | Three screens integrated and tested together | Demo script; open three windows on the demo laptop; rehearse | PR merged | Write the 2-minute demo script |

## Open decisions (need a human)

1. **Queue naming** (BA): keep departments (update PRD wording) or switch `app/data.js` to Registration (R) and
   Billing (B). The engine supports both.
2. **Merge PR** for `feature/queue-display` (team).
