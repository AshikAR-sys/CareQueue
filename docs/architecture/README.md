# CareQueue architecture and ERD

CareQueue (Hospital Digital Token and Queue Management System) as built on 27 Oct 2026.
Images: [`architecture.png`](architecture.png) · [`erd.png`](erd.png) · both in one PDF:
[`CareQueue_Architecture_and_ERD.pdf`](CareQueue_Architecture_and_ERD.pdf). The diagrams below are the same
content as editable Mermaid, which GitHub renders.

## System architecture

Six browser pages share a few JavaScript modules. They talk to a **Flask API**, which stores the queue in an
**SQLite** database. Every page asks the server for the queue once a second, so a change on one screen reaches the
others within about a second, on any device that can reach the server.

```mermaid
flowchart TB
  subgraph People
    P([Patient])
    R([Receptionist / admin])
    TV([Waiting-room TV])
  end

  subgraph Pages["Browser pages (frontend/*.html)"]
    IDX["index.html<br/>Landing and sign-in"]
    PAT["patient.html<br/>Token form, token card,<br/>print, PNG, QR code"]
    TRK["track.html<br/>Phone tracking from the QR code<br/>alerts, rating, Tamil; no sign-in"]
    STF["staff.html<br/>Counters 1-3, Call Next,<br/>Skip, Recall, Send to Billing"]
    REP["reports.html<br/>Today's figures, busiest hour, CSV"]
    DSP["display.html<br/>Now serving + counter, next 5,<br/>priority marks, voice, English / Tamil"]
  end

  subgraph Modules["Shared modules (frontend/js/)"]
    Q["queue.js · TokenQueue<br/>fetch state every 1 s, POST actions"]
    CORE["queue-core.js · QueueCore<br/>EWT = R + N/C × AST, counters,<br/>tracking, reports"]
    AUTH["auth.js · CareAuth<br/>session, staff pass, page guard"]
    ANN["announce.js<br/>chime + speech"]
    QR["vendor/qrcode.js<br/>QR codes (MIT)"]
    I18N["i18n.js · alerts.js · sw.js<br/>Tamil text, turn-is-near alerts"]
  end

  subgraph Server["Server (backend/)"]
    API["app.py · Flask<br/>/api/staff/sign-in (checks the PIN)<br/>/api/queue/state (staff pass)<br/>/api/queue/public-state (numbers only)<br/>/api/tokens, call-next, skip, recall,<br/>send-to, counters"]
    SVC["services/queue_service.py<br/>validation, numbering, transitions"]
  end

  DB[("SQLite<br/>departments, tokens,<br/>queue_counters, open_counters")]
  LS[("Browser localStorage<br/>session, staff department + counter")]

  P --> IDX
  P --> PAT
  P -- scans QR --> TRK
  R --> IDX
  R --> STF
  R --> REP
  TV --> DSP
  PAT --> Q
  TRK --> Q
  STF --> Q
  REP --> Q
  DSP --> Q
  DSP --> ANN
  PAT --> QR
  TRK --> I18N
  DSP --> I18N
  Q --> CORE
  IDX --> AUTH
  AUTH <--> LS
  Q -- HTTP + JSON --> API
  API --> SVC
  SVC --> DB
```

| Layer | What it does | Files |
|---|---|---|
| Pages | What each person sees | `index.html`, `patient.html`, `track.html`, `staff.html`, `reports.html`, `display.html` |
| Page scripts | Behaviour of one page | `app.js`, `track.js`, `staff.js`, `reports.js`, `display.js` |
| Shared modules | Rules, server calls, sign-in, voice, QR, sample data | `queue-core.js`, `queue.js`, `auth.js`, `announce.js`, `vendor/qrcode.js`, `data.js`, `screens.js` |
| API | Validates and applies every queue change | `backend/app.py`, `backend/services/queue_service.py` |
| Database | Today's tokens, numbering, open counters | `database/schema.sql`, `database/seed.sql`, `backend/db.py` |
| Hosting | Public demo | `render.yaml` (Render free web service, gunicorn; deploys on every push to `main`) |
| Tests | 93 unit, 37 API, 67 browser tests; GitHub Actions on every pull request | `tests/`, `backend/tests/`, `.github/workflows/test.yml` |

**Privacy:** only the staff console loads `/api/queue/state`, which includes patient names and phones. The token
page, phone tracking page, display and reports load `/api/queue/public-state`, which has token numbers, times,
statuses and counters only. Browser tests check that no name reaches those pages.

**Staff sign-in:** `POST /api/staff/sign-in` checks the PIN on the server and returns a signed staff pass (8 hours).
The full queue and every queue action need that pass; patient and public routes do not.

**Known limits:** one shared staff PIN, no personal accounts and no limit on sign-in attempts. Pages poll every second instead of receiving server push. On the free Render plan the SQLite
file lives in `/tmp` and is reset on every redeploy or restart. Departments are listed in both `seed.sql` (server)
and `data.js` (pages), so the two must be kept in step.

## Entity relationship diagram

The SQLite tables from `database/schema.sql`. Patient details are stored on each token row. Doctors are a JSON list
on the department. The sign-in session is kept in the browser, not in the database.

```mermaid
erDiagram
  DEPARTMENTS ||--o{ TOKENS : "numbers (by code)"
  DEPARTMENTS ||--o{ QUEUE_COUNTERS : "per day"
  DEPARTMENTS ||--o{ OPEN_COUNTERS : "per day"
  DEPARTMENTS ||--o{ DELAYS : "delay notice per day"
  TOKENS |o--o| TOKENS : "Send to Billing (linked_from / forwarded_to)"

  DEPARTMENTS {
    text id PK "gen, card, ortho, bill"
    text code UK "token letter G, C, O, B"
    text name
    text location
    text doctors_json "doctor names"
    int active
    int sort_order
  }
  QUEUE_COUNTERS {
    text queue_date PK "YYYY-MM-DD"
    text code PK,FK "departments.code"
    int last_seq "last number issued, 1-999"
  }
  DELAYS {
    text queue_date PK
    text code PK,FK "departments.code"
    text reason "surgery, break, emergency, other (US-21)"
    int until_ms "when the notice ends"
  }
  OPEN_COUNTERS {
    text queue_date PK
    text code PK,FK "departments.code"
    text counters "open counters, e.g. 1,2 (no row = Counter 1)"
  }
  TOKENS {
    int id PK
    text queue_date "UK with number; UK with code + seq"
    text number "G001"
    text code FK "departments.code"
    int seq "1-999"
    text status "waiting, serving, done, missed"
    int counter "1-3, set when called"
    text priority "senior, pregnant, emergency (US-17)"
    int rating "1-5 stars after the visit (US-20)"
    int away_until "stepped out until, once (US-22)"
    int estimate_min "estimate shown at issue (US-24)"
    text patient_name
    int age "0-120"
    text gender "Male, Female, Other"
    text phone "10 digits, starts 6-9"
    text doctor "optional"
    int created_at "ms"
    int called_at
    int done_at
    int skipped_at
    text linked_from FK "tokens.number"
    text forwarded_to FK "tokens.number"
  }
  SESSION {
    text role "patient, receptionist (browser localStorage)"
    text name
    text phone "patient only"
    int timestamp "expires after 8 hours"
  }
```

How the tables are used:
- **Token numbers:** `queue_counters` keeps the last number per queue per day, so numbers restart each day.
- **Unique numbers:** two unique keys stop a number repeating on the same day.
- **Counters (US-11):** `open_counters` lists the service counters open per queue per day. `tokens.counter` records
  which counter called each token.
- **Older database files:** `upgrade_schema()` adds the columns that newer versions introduced.
