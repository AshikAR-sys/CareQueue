# CareQueue Project Status

Updated: 25 Oct 2026, after merging PR #6 (Flask backend + SQLite) with Send to Billing (US-04) and sign-in (US-14).
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
| Patient / receptionist sign-in | US-14 | **Completed (demo-level)** | e2e AC-14.1–14.4; PIN is checked in the browser, not secure |
| Print token and download PNG | US-12 | **Completed** | verified in the browser before the migration; no automated test after it |
| Persistent queue across reloads (SQLite) | — | **Completed** | e2e persistence test |
| Voice announcement (sound switch, chime + speech on each call and recall) | US-08 | **Completed** | 9 unit tests; e2e AC-08.1, AC-08.2 (+2) |
| Multiple counters | US-11 | Pending | not built |
| QR phone tracking | US-13 | Pending | not built |

## How to run

```bash
python -m pip install -r backend/requirements.txt
npm install
npx playwright install chromium
npm start
```

Open http://127.0.0.1:8000.

## Test results (after the merge, 25 Oct 2026)

```
npm test              →  34 / 34 pass  (queue rules + announcements)
npm run test:backend  →  11 / 11 pass  (Flask API + SQLite)
npm run test:e2e      →  30 / 30 pass  (browser tests against an isolated test database; 3 consecutive runs)
```

## Role-wise backlog

| Role | Owner | Next action |
|---|---|---|
| Business Analyst / PM | Sam Austin | Decide whether to add a separate Registration (R) queue before Billing |
| UI/UX Designer | Nishandhini | Final look at the screens on the demo laptop |
| Frontend Developer | Ashik Rasool | Rehearse the demo with `npm start`; print/download check by hand |
| Backend Developer | Ashik Rasool | Review demo-only authentication limitation before any public deployment |
| Database Developer | Ashik Rasool | Existing local databases are upgraded automatically (new link columns) |
| QA Engineer | Rogasree | Run all test commands and the manual checklist in `docs/testing/demo-checklist.md` |

## Open items

1. **Architecture diagram and ERD** (`docs/architecture/`) still show the earlier browser-only version; they need
   updating for the Flask + SQLite design.
2. **GitHub repository description** (Blocked from the cloud session): set it in GitHub → About.
3. **Server-side PIN check** (QA fix 3, not applied): `/api/queue/state` and the queue actions are open to anyone
   who calls the API directly. The patient page no longer loads other patients' details.
4. **Live site not yet QA-tested** from the cloud session (network policy blocks `carequeue-demo.onrender.com`).

## Safety note

CareQueue is a hackathon prototype. Do not expose it to the public internet or use real patient information until
server-side authentication, authorization, HTTPS, rate limiting, logging, and privacy requirements have been
implemented and reviewed.
