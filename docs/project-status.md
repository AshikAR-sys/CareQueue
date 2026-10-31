# CareQueue Project Status

Updated: 31 Oct 2026, after adding the doctor delay notice (US-21). 21 of 25 stories built.
Demo: 25 Oct, 10:00 IST.
Status labels: **Completed** (with evidence) · **In Progress** · **Pending** · **Blocked** · **Needs Verification**.

## Architecture

| Layer | Files | Responsibility |
|---|---|---|
| Frontend | `frontend/*.html`, `frontend/css/`, `frontend/js/`, `frontend/assets/` | Screens and styling; calls the API through `frontend/js/queue.js` |
| Backend | `backend/app.py`, `backend/db.py`, `backend/services/queue_service.py` | Flask routes, SQLite connection lifecycle, validation, token issue / call / skip / recall / send-to actions |
| Database | `database/schema.sql`, `database/seed.sql` | Tables, constraints, indexes, sample departments (including Billing) |
| Backend tests | `backend/tests/test_api.py` | Flask API and SQLite integration tests |
| Frontend tests | `tests/` | Queue-rule unit tests and browser workflows against the live API |

## Features

| Feature | Stories | Status | Evidence |
|---|---|---|---|
| Token generation and per-department numbering (server allocates numbers, stored in SQLite) | US-01–US-03 | **Completed** | backend tests; e2e AC-01.1, AC-02.1, AC-03.1 |
| Receptionist Call Next, Skip, Recall (through the API) | US-05, US-07 | **Completed** | backend transition test; e2e AC-05.1–05.3, AC-07.1–07.2 |
| Waiting-room display (public endpoint without patient details) | US-06 | **Completed** | backend public-state test; e2e AC-06.1–06.4 |
| Estimated waiting time | US-09, US-10 | **Completed** | unit tests AC-09.1, AC-10.1–10.2; e2e AC-09.2–09.3 |
| Send to Billing (server endpoint, linked tokens) | US-04 | **Completed** | 5 backend tests; 6 unit tests; e2e AC-04.1, AC-04.2 (+3) |
| Patient / receptionist sign-in; server checks the staff PIN and staff routes need its pass | US-14 | **Completed** | e2e AC-14.1–14.4 + 2; 5 backend tests; one shared demo PIN |
| Print token and download PNG | US-12 | **Completed** | verified in the browser before the migration; no automated test after it |
| Persistent queue across reloads (SQLite) | — | **Completed** | e2e persistence test |
| Voice announcement (sound switch, chime + speech on each call and recall) | US-08 | **Completed** | 9 unit tests; e2e AC-08.1, AC-08.2 (+2) |
| Queue reports: per-department figures, averages, busiest hour, CSV (new epic E6) | US-15, US-16 | **Completed** | 6 unit tests; e2e AC-15.1–15.4, AC-16.1–16.2 (+1) |
| Priority tokens (seniors 60+, pregnant, emergency) called first | US-17 | **Completed** | 6 unit tests; 4 backend tests; e2e AC-17.1–17.4 |
| Tamil display, voice and phone page (English fallback without a Tamil voice) | US-18 | **Completed** | 6 unit tests; e2e AC-18.1–18.3 (+1); Tamil wording to be checked by a Tamil speaker |
| Turn-is-near alert on the phone page (chime, vibration, notification; not SMS) | US-19 | **Completed** | 4 unit tests; e2e AC-19.1–19.3; real notification checked in Chromium |
| Rate my visit (1–5 stars on the phone page; average in Reports and CSV) | US-20 | **Completed** | 3 unit tests; 3 backend tests; e2e AC-20.1–20.3 (+1) |
| Doctor delay notice on display and phones, added to estimates | US-21 | **Completed** | 4 unit tests; 3 backend tests; e2e AC-21.1–21.3 (+1) |
| Hold my place while stepping out | US-22 | Pending | added 31 Oct |
| Share my token with family | US-23 | Pending | added 31 Oct |
| Estimate accuracy in Reports (PRD metric) | US-24 | Pending | added 31 Oct |
| Best time to visit | US-25 | Pending | added 31 Oct |
| Multiple counters: up to 3 per queue, each calling its own patient; counter shown on display, voice and phone | US-11 | **Completed** | 10 unit tests; 5 backend tests; e2e AC-11.1–11.4 (+1) |
| QR phone tracking (live phone page, "Almost your turn") | US-13 | **Completed** | 6 unit tests; e2e US-13, AC-13.1–13.3 (+1) |

## How to run

```bash
python -m pip install -r backend/requirements.txt
npm install
npx playwright install chromium
npm start
```

Open http://127.0.0.1:8000.

## Test results (27 Oct 2026)

```
npm test              →  79 / 79 pass  (queue rules + counters + priority + Tamil + alerts + delays + tracking + reports + ratings)
npm run test:backend  →  31 / 31 pass  (Flask API + SQLite)
npm run test:e2e      →  60 / 60 pass  (browser tests against an isolated test database)
```

## Role-wise backlog

| Role | Owner | Next action |
|---|---|---|
| Business Analyst / PM | Sam Austin | Decide whether to add a separate Registration (R) queue before Billing |
| UI/UX Designer | Nishandhini | Final look at the screens on the demo laptop |
| Frontend Developer | Ashik Rasool | Rehearse the demo with `npm start`; print/download check by hand |
| Backend Developer | Ashik Rasool | Set `CAREQUEUE_STAFF_PIN` and `CAREQUEUE_SECRET_KEY` on Render if the PIN should not be 1234 |
| Database Developer | Ashik Rasool | Existing local databases are upgraded automatically (new link columns) |
| QA Engineer | Rogasree | Run all test commands and the manual checklist in `docs/testing/demo-checklist.md` |

## Open items

1. **Architecture diagram and ERD:** updated on 27 Oct 2026 for Flask + SQLite, the six pages, counters, QR
   tracking, reports and Render hosting (`docs/architecture/`).
2. **GitHub repository description** (Blocked from the cloud session): set it in GitHub → About.
3. **Server-side PIN check** (QA fix 3): **done.** `/api/queue/state` and every queue action now need the staff pass from
   `POST /api/staff/sign-in`. Remaining: one shared PIN, no personal accounts, no limit on sign-in attempts.
4. **Live site:** now reachable from the cloud session; read-only checks confirmed `main` is deployed. Full live QA not yet run.
5. **Backlog size:** with E6 and US-17–US-25 the backlog has 6 epics and 25 stories, above the Stage 4 guideline of 3–5 epics and
   8–15 stories. E5 and E6 are marked in the PDFs as added by the team after the first backlog.

## Safety note

CareQueue is a hackathon prototype. Do not expose it to the public internet or use real patient information until
server-side authentication, authorization, HTTPS, rate limiting, logging, and privacy requirements have been
implemented and reviewed.
