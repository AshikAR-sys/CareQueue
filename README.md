# CareQueue

A digital token and queue-management system for small clinics, built by **Future Coders** for the JJCET AI-PDLC Hackathon (24–25 October 2026).

> **Problem statement:** Patients wait in queues for registration and billing. Build a digital token and queue-management system that displays the current token and estimated waiting time.

| Role | Team member |
|---|---|
| Business Analyst | Sam Austin |
| Developer | Ashik Rasool |
| UI/UX Designer | Nishandhini |
| QA Tester | Rogasree |

![Token page](docs/screenshots/desktop-sample.png)

## Run it (under 5 minutes)

No install and no build step for the app. It is plain HTML, CSS and JavaScript.

1. Clone the repo:
   ```bash
   git clone https://github.com/AshikAR-sys/CareQueue.git
   cd CareQueue
   ```
2. Open these three files in **the same browser** (Chrome, Edge or Safari), side by side:
   - `app/index.html`: patient token page
   - `app/staff.html`: staff console (Call Next, Skip, Recall)
   - `app/display.html`: waiting-room display (put it on the TV)
3. Generate a few tokens, press **Call Next** on the staff console, and watch the display change.

Optional, to serve it locally instead: `npm start` (or `python3 -m http.server 8000 --directory app`), then open
http://localhost:8000.

### Run the tests

```bash
npm install                      # installs Playwright for the browser tests
npx playwright install chromium  # once
npm test                         # 19 unit tests for the queue rules
npm run test:e2e                 # 10 browser tests across all three screens
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

- **No server or database.** The queue lives in this browser's `localStorage` and is shared live between the three
  screens open in the same browser on one computer. Other computers do not see it.
- **No login.** The staff console is open to anyone with the page. Login was not in the PRD.
- **Queues are departments** (G, C, O, P, D, E). The PRD names Registration (R) and Billing (B); switching is a data
  change in `app/data.js` and is an open team decision.
- **Not built yet:** Send to Billing (US-04), voice announcement (US-08), multiple counters (US-11), QR phone
  tracking (US-13).
- Departments, doctors and room locations in `app/data.js` are **sample data**.

How this was built, stage by stage with test evidence: [`docs/automation-log.md`](docs/automation-log.md).
Role-wise backlog: [`docs/project-status.md`](docs/project-status.md).

## Project structure

```
app/
  index.html     patient token page
  staff.html     staff console          (staff.js)
  display.html   waiting-room display   (display.js)
  queue-core.js  queue rules: issue, call next, skip, recall, estimated wait
  queue.js       shared store in localStorage with live sync between screens
  app.js         token form, validation, preview states, print and download
  screens.js     helpers shared by staff and display
  styles.css     Liquid Glass styling (token page)
  screens.css    staff console and display styling
  data.js        sample departments and doctors
  assets/        background illustration
tests/
  queue-core.test.js   unit tests (node:test)
  e2e.test.js          browser tests (Playwright)
docs/
  CareQueue_MRD.pdf            Market Requirements Document
  CareQueue_PRD.pdf            Product Requirements Document
  CareQueue_Epics.pdf          4 epics with traceability
  CareQueue_User_Stories.pdf   13 stories, 35 acceptance criteria, test checklist
  features/                    feature specs and design decisions
  automation-log.md            how each feature was built and tested
  project-status.md            role-wise backlog
  screenshots/
```

## Connecting a real queue

`app/queue.js` keeps the same function names a backend would need (`issue`, `callNext`, `skip`, `recall`, `view`,
`publicView`, `subscribe`). Replace its `load`/`save` with API calls and server push, and the three screens keep
working. The rules in `app/queue-core.js` can run on the server unchanged (they are plain functions with tests).
