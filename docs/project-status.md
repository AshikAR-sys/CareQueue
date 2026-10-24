# CareQueue Project Status

**Architecture refactor:** draft PR #6, branch `refactor/organize-frontend-backend-database`.
**Important:** this branch adds a Flask API and SQLite persistence. Automated tests have been added for the backend and are updated to run the UI against the API. Run the test suite before merging; results have not yet been verified in this working session.

## Architecture

| Layer | Files | Responsibility |
|---|---|---|
| Frontend | `frontend/*.html`, `frontend/css/`, `frontend/js/`, `frontend/assets/` | Existing screens and styling; calls the API through `frontend/js/queue.js` |
| Backend | `backend/app.py`, `backend/db.py`, `backend/services/queue_service.py` | Flask routes, SQLite connection lifecycle, validation, token issue/call/skip/recall actions |
| Database | `database/schema.sql`, `database/seed.sql` | Tables, constraints, indexes, and sample departments |
| Backend tests | `backend/tests/test_api.py` | Flask API and SQLite integration coverage |
| Frontend/unit/e2e tests | `tests/` | Queue-rule tests and browser workflows against the live API |

## Current features

| Feature | Status | Notes |
|---|---|---|
| Patient token generation and per-department numbering | Implemented in current code; validation required | Server allocates numbers and writes tokens to SQLite |
| Receptionist Call Next, Skip, Recall | Implemented in current code; validation required | Actions use the Flask API |
| Waiting-room display | Implemented in current code; validation required | Public endpoint returns token status/number without patient details |
| Estimated waiting time | Existing queue rules retained | Uses cached API queue state in the browser |
| Print token and download PNG | Existing frontend feature retained | Requires browser verification after migration |
| Persistent queue across page reloads | Implemented in current code; validation required | Database file is created at runtime and ignored by Git |
| Patient/receptionist login | Demo only | PIN validation remains client-side and is not secure authentication |
| Send to Billing (US-04) | Pending | Not built |
| Voice announcement (US-08) | Pending | Not built |
| Multiple counters (US-11) | Pending | Not built |
| QR phone tracking (US-13) | Pending | Not built |

## How to run

```bash
python -m pip install -r backend/requirements.txt
npm install
npx playwright install chromium
npm start
```

Open http://127.0.0.1:8000.

## Tests

```bash
npm test
npm run test:backend
npm run test:e2e
npm run test:all
```

Run tests and record actual pass/fail results before merging draft PR #6. Do not state that the migration is verified until those commands pass.

## Role-wise backlog

| Role | Owner | Next action |
|---|---|---|
| Business Analyst / PM | Sam Austin | Decide whether to retain department queues or switch to Registration and Billing |
| UI/UX Designer | Nishandhini | Review existing screens after the file move; preserve Liquid Glass design |
| Frontend Developer | Ashik Rasool | Run browser tests; verify token issue, print/download, live updates, and mobile layout |
| Backend Developer | Ashik Rasool | Run API tests; review validation and demo-only authentication limitation |
| Database Developer | Ashik Rasool | Verify schema, seed data, persistence, daily numbering, and ignored local database file |
| QA Engineer | Rogasree | Run all test commands and the manual checklist in `docs/testing/demo-checklist.md` |

## Safety note

CareQueue is a hackathon prototype. Do not expose it to the public internet or use real patient information until server-side authentication, authorization, HTTPS, rate limiting, logging, and privacy requirements have been implemented and reviewed.
