# CareQueue

**CareQueue** is a Hospital Digital Token and Queue Management System, built by **Future Coders** for the JJCET AI-PDLC Hackathon (24–25 October 2026).

> **Problem statement:** Patients wait in queues for registration and billing. Build a digital token and queue-management system that displays the current token and estimated waiting time.

| Role | Team member |
|---|---|
| Business Analyst | Sam Austin |
| Developer | Ashik Rasool |
| UI/UX Designer | Nishandhini |
| QA Tester | Rogasree |

![Token page](docs/screenshots/desktop-sample.png)

## Run locally

CareQueue uses a Flask API and SQLite database. Run the frontend and API together from the repository root.

1. Clone the repo:
   ```bash
   git clone https://github.com/AshikAR-sys/CareQueue.git
   cd CareQueue
   ```
2. Install backend and test dependencies:
   ```bash
   python -m pip install -r backend/requirements.txt
   npm install
   npx playwright install chromium
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open http://127.0.0.1:8000. Use the Patient Portal to issue tokens, the Receptionist Portal to manage queues, and the display link for the waiting-room screen.

The database file is created automatically at `database/carequeue.sqlite3`. It is ignored by Git, so local queue data is not committed to the repository.

### Run the tests

```bash
npm test                         # queue-rule unit tests
npm run test:backend             # Flask API + SQLite integration tests
npm run test:e2e                 # browser tests against an isolated test database
npm run test:all                 # all three suites
```

## What works today

| Feature | Stories | Tested by |
|---|---|---|
| Token form with validation; tokens in order per department per day (`G001`, `G002`, `C001`) | US-01–US-03 | e2e |
| Staff console: Call Next, Skip, Recall, waiting list, missed list | US-05, US-07 | e2e |
| Waiting-room display: now serving + next 5 per department, live (< 2 s), token numbers only | US-06 | e2e |
| Estimated waiting time: EWT = R + N × AST, default 3 min until 3 are served, then the average of the last 10 | US-09, US-10 | unit + e2e |
| Live estimate on the patient's token card ("About 6 min · 2 people ahead") | US-09 | e2e |
| Print token (one A5 page) and download (PNG) | US-12 | browser test |
| Responsive Liquid Glass design; phone, tablet, desktop, TV | — | e2e (no overflow at 390 px) |

## Honest limits

- **Prototype authentication only.** The PIN check is client-side (demo PIN `1234`), not secure server-side authentication. Do not expose this prototype to the public internet or use real patient information.
- **Local server by default.** The app binds to `127.0.0.1`, so all screens on the same computer share the SQLite-backed queue. Other devices will need a deliberately configured, secured deployment.
- **Sample hospital data.** Departments, doctors and locations in `frontend/js/data.js` are sample data.
- **Not built yet:** Send to Billing (US-04), voice announcement (US-08), multiple counters (US-11), QR phone tracking (US-13).
- A public display endpoint returns token numbers and status only; it excludes patient names and contact details.

How this was built, stage by stage with test evidence: [`docs/automation-log.md`](docs/automation-log.md).
Role-wise backlog: [`docs/project-status.md`](docs/project-status.md).
Claude Code role conversation names and starter prompts: [`docs/role-conversations.md`](docs/role-conversations.md).

## Project structure

```
CareQueue/
├── frontend/
│   ├── index.html, patient.html, staff.html, display.html
│   ├── css/                 styles.css, screens.css
│   ├── js/                  UI, auth demo, queue API adapter, queue rules
│   └── assets/              hospital illustration
├── backend/
│   ├── app.py               Flask API + static frontend server
│   ├── db.py                SQLite connection and initialization
│   ├── services/
│   │   └── queue_service.py token issue and queue transitions
│   ├── tests/                API integration tests
│   └── requirements.txt
├── database/
│   ├── schema.sql            table constraints and indexes
│   └── seed.sql              sample departments and doctors
├── tests/
│   ├── queue-core.test.js
│   └── e2e.test.js
├── docs/                     requirements, feature specs, screenshots
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

The browser UI calls the Flask API; queue state is persisted in SQLite. The folder boundaries are functional, not placeholders.