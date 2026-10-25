# Project status (role-wise backlog)

Updated: 25 Oct 2026 — added E5 / US-14 (sign-in); demo-readiness audit · Demo: 25 Oct, 10:00 IST.
Status labels: **Completed** (with evidence) · **In Progress** · **Pending** · **Blocked** · **Needs Verification**.

---

## DEMO READINESS: READY ✓

All 37 automated tests pass (19 unit, 18 browser). End-to-end demo flow verified. Start command fixed for Windows (no Python required).

**Start command:** `cd CareQueue && npm start`
**URLs:** Token → `http://localhost:8000` · Staff → `http://localhost:8000/staff.html` · Display → `http://localhost:8000/display.html`

---

## Feature status

| Feature | Stories | Status | Evidence |
|---|---|---|---|
| Token generation (form, validation, order) | US-01, US-02, US-03 | **Completed** | e2e tests AC-01.1, AC-02.1, AC-03.1; 29/29 pass 25 Oct |
| Call Next, Skip, Recall (staff console) | US-05, US-07 | **Completed** | e2e AC-05.1–05.3, AC-07.1–07.2 |
| Now-Serving display | US-06 | **Completed** | e2e AC-06.1–06.4 (display updates <2 s, 158 px number, no names) |
| Estimated waiting time | US-09, US-10 | **Completed** | unit tests AC-09.1 (23 min example), AC-10.1–10.2; e2e AC-09.2–09.3 |
| Print / download slip | US-12 | **Completed** | e2e download test |
| Queue persists across page reload | — | **Completed** | e2e persistence test |
| Phone layout (no overflow) | — | **Completed** | e2e layout test at 390 px |
| Send to Billing | US-04 | Pending | not built |
| Voice announcement | US-08 | Pending | not built |
| Multiple counters | US-11 | Pending | not built |
| QR phone tracking | US-13 | Pending | not built |
| Sign-in and access (patient / receptionist) | US-14 (E5, PRD S6) | **Completed** | e2e AC-14.1–14.4 (7 tests) |
| Backend / database | none in PRD | Pending (out of scope) | browser localStorage by design; documented |

---

## Role-wise backlog

| Role | Owner | Completed (evidence) | Pending | Next action |
|---|---|---|---|---|
| Business Analyst / PM | Sam Austin | MRD, PRD, epics, stories (`docs/*.pdf`); F1 spec | Decide: departments vs Registration/Billing queues | Make the queue-naming decision |
| UI/UX Designer | Nishandhini | Token page, staff console, display designs | Demo deck (6 slides) | Fill slides 1–4 from MRD/PRD |
| Frontend Developer | Ashik Rasool | All three screens (29/29 tests pass) | US-08 voice (optional) | — |
| Backend Developer | Ashik Rasool | Queue rules in `app/queue-core.js` (19 unit tests) | — | — |
| Database Developer | Ashik Rasool | Daily queue record in browser localStorage | — | — |
| QA Engineer | Rogasree | 29 automated tests pass (`npm run test:all`) | Manual checklist in `docs/testing/demo-checklist.md` | Run the manual checklist on the demo laptop |
| Integration / Demo | Ashik + Sam | Three screens integrated; demo flow verified | Demo script (see below) | Rehearse demo once |

---

## Open decisions (need a human)

1. **Queue naming** (BA): keep departments or switch `app/data.js` to Registration (R) and Billing (B). The engine supports both; it is a 2-line data change.
2. **GitHub repository description** (Blocked): HTTP 403 from this environment. Set manually in GitHub → Settings → Repository description.

---

## Test results (25 Oct 2026, ~01:10 IST)

```
npm test          →  19 / 19 pass  (queue-core unit tests)
npm run test:e2e  →  18 / 18 pass  (Playwright e2e; PW_CHANNEL=chromium in the cloud session)
npm run test:all  →  37 / 37 pass
```
