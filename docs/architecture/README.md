# CareQueue architecture and ERD

CareQueue (Hospital Digital Token and Queue Management System) as built on 25 Oct 2026.
Images: [`architecture.png`](architecture.png) · [`erd.png`](erd.png) · both in one PDF:
[`CareQueue_Architecture_and_ERD.pdf`](CareQueue_Architecture_and_ERD.pdf). The diagrams below are the same
content as editable Mermaid, which GitHub renders.

## System architecture

A static web app: four HTML pages share five JavaScript modules and keep their data in the browser's
`localStorage`. **There is no server and no database**, so the queue is shared only between tabs of one browser on
one computer.

```mermaid
flowchart TB
  subgraph People
    P([Patient])
    R([Receptionist])
    TV([Waiting-room TV])
  end

  subgraph Pages["Pages (app/*.html)"]
    IDX["index.html<br/>Landing and sign-in<br/><i>auth.js</i>"]
    PAT["patient.html<br/>Token form + token card<br/><i>app.js</i>"]
    STF["staff.html<br/>Staff console: Call Next, Skip, Recall<br/><i>staff.js</i>"]
    DSP["display.html<br/>Now serving + next 5, no names<br/><i>display.js</i>"]
  end

  subgraph Modules["Shared modules (app/*.js)"]
    AUTH["auth.js · CareAuth<br/>session, demo PIN, page guard"]
    DATA["data.js<br/>sample departments, doctors"]
    Q["queue.js · TokenQueue<br/>load/save, live sync between tabs"]
    CORE["queue-core.js · QueueCore<br/>issue, callNext, skip, recall<br/>EWT = R + N × AST"]
    SCR["screens.js<br/>clock, formatting"]
  end

  subgraph Storage["Browser localStorage (this computer only)"]
    KS[("carequeue-session")]
    KQ[("carequeue-queue:YYYY-MM-DD")]
    KD[("carequeue-staff-dept")]
  end

  P --> IDX
  R --> IDX
  P --> PAT
  R --> STF
  TV --> DSP
  IDX --> AUTH
  PAT --> Q
  STF --> Q
  DSP --> Q
  PAT --> DATA
  STF --> SCR
  DSP --> SCR
  Q --> CORE
  AUTH <--> KS
  Q <--> KQ
  STF -.-> KD
```

| Layer | What it does | Files |
|---|---|---|
| Pages | What each person sees | `index.html`, `patient.html`, `staff.html`, `display.html` |
| Page scripts | Behaviour of one page | `app.js`, `staff.js`, `display.js` |
| Shared modules | Rules, storage, sign-in, sample data | `queue-core.js`, `queue.js`, `auth.js`, `data.js`, `screens.js` |
| Storage | Today's queue, who is signed in | `localStorage` keys `carequeue-*` |
| Tests | 19 unit tests on the rules; 18 browser tests on all pages together | `tests/queue-core.test.js`, `tests/e2e.test.js` |

**Live sync:** when one tab changes the queue, the browser's `storage` event tells the other tabs at once; a
1-second check is the fallback. **To scale beyond one computer:** keep `TokenQueue`'s functions, replace its
`load`/`save` with API calls and server push, and run `queue-core.js` on the server unchanged.

## Entity relationship diagram

A **logical** model of the data CareQueue stores today. Keys are logical (there are no database constraints):
departments and doctors come from `app/data.js`; queue days, tokens and sessions are JSON in `localStorage`;
patient details are stored inside each token.

```mermaid
erDiagram
  DEPARTMENT ||--o{ DOCTOR : has
  DEPARTMENT ||--o{ TOKEN : "numbers (by code)"
  QUEUE_DAY ||--o{ TOKEN : contains
  TOKEN ||--|| PATIENT_DETAILS : embeds
  DOCTOR |o--o{ PATIENT_DETAILS : "requested (optional, by name)"

  DEPARTMENT {
    string id PK "gen, card, ortho"
    string code UK "token letter G, C, O"
    string name
    string location
  }
  DOCTOR {
    string name PK
    string department_id FK
  }
  QUEUE_DAY {
    string date PK "YYYY-MM-DD"
    map counters "last number per code"
  }
  TOKEN {
    string number PK "G001, unique per day"
    string date FK
    string code FK
    int seq
    string status "waiting, serving, done, missed"
    datetime createdAt
    datetime calledAt
    datetime doneAt
    datetime skippedAt
  }
  PATIENT_DETAILS {
    string name
    int age "0-120"
    string gender "Male, Female, Other"
    string phone "10 digits, starts 6-9"
    string doctor FK "optional"
  }
  SESSION {
    string role "patient, receptionist, admin"
    string name
    string phone "patient only"
    datetime timestamp "expires after 8 hours"
  }
```

`SESSION` has no relationship to the other entities: it records who is signed in on this browser (one sign-in at a
time). Patient details are never sent to the waiting-room display (`QueueCore.publicView` returns token numbers and
estimates only; covered by a unit test and a browser test).
