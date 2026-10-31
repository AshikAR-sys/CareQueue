# Automation log

How CareQueue (Hospital Digital Token and Queue Management System) was developed with AI assistance, stage by stage.
Every entry records what actually ran. Where a skill could not be loaded, the fallback is stated.

Team (Future Coders): BA Sam Austin · Dev Ashik Rasool · UI/UX Nishandhini · QA Rogasree.
AI: Claude Code (cloud session), directed by the team.

---

## Before this log (summary of earlier work, already in `main`)

| What | Evidence |
|---|---|
| MRD, PRD, Epics (4), User Stories (13, 35 acceptance criteria) | `docs/*.pdf` |
| Token generation page: form, validation, preview states, print, download, Liquid Glass design | `app/index.html`, `app/app.js`, `app/styles.css`; PR #1 (commit `9a286fe`) |
| Bugs found then: a pasted phone number with a space lost its last digit (fixed by removing `maxlength`); error boxes showed while hidden (fixed with `[hidden]{display:none!important}`); print split over two pages (fixed with A5 + `break-inside`) | Browser tests at the time; fixes in PR #1 |

## Audit (24–25 Oct, read-only)

- **Found:** one static page (`app/`), no login, no authentication, no backend, no database, no API routes.
  Tokens were counted per department in `localStorage`. Searched the whole workspace for login/auth code: none.
- **Verified working** (Playwright run on `main`): validation (5 field errors), sequential tokens C001→C002,
  download, no overflow at tablet/phone, no console errors.
- **Gap:** PRD Must-Haves M2 (Call Next + display) and M3 (estimated wait) were not built; the doctor field is outside
  the PRD; the PRD names Registration/Billing queues while the page uses departments.
- **Skills available:** `design-taste-frontend`, `test-driven-development`, `webapp-testing`, `systematic-debugging`,
  `brainstorming`. **Not installed:** `frontend-design`, `grill-me`.

---

## Feature F1 — Shared queue, staff console, Now-Serving display, estimated wait

**Objective:** make the "displays the current token and estimated waiting time" half of the problem statement work.
**Stories:** US-05, US-06, US-07, US-09, US-10 (PRD M2, M3, S1). **Branch:** `feature/queue-display`.

### Stage A — Business Analyst
- **Output:** `docs/features/F1-queue-and-display.md` (stories, acceptance criteria copied from the PDF, business
  rules, edge cases).
- **Decisions recorded, reversible:** a queue = a department (engine works for any queue set; R/B is a data change);
  one counter per queue; Call Next completes the current patient; no server (browser storage shared between tabs);
  login out of scope (not in the PRD).
- **Open decision for the human BA:** keep departments and update PRD wording, or switch `app/data.js` to R/B.
- **Skill:** `brainstorming` was available but not used: its flow interviews a human one question at a time, and the
  requirements already existed in the PRD and stories.

### Stage B — UI/UX Designer
- **Skill:** `design-taste-frontend`, loaded with the Skill tool; its app-screen rules applied.
- **Output:** `docs/features/F1-design.md`: each screen's one question, reading order, states, and six measurable
  approval criteria.
- Taste bans glass, gradients and floating shadows; the approved Liquid Glass design overrides those, and the
  inspector checks for them are switched off by name (`--allow glass,gradient,shadow,button-fx,heavy-shadow`).
- **`frontend-design` skill:** not installed, not used.

### Stage C — Developer
- **Skill:** `test-driven-development`. The Skill tool returned "Unknown skill" (it is installed under `/home/user`,
  outside this repo), so its `SKILL.md` was read directly. **Deviation:** the 19 unit tests were written as one batch
  before the module, not one test at a time.
- **RED:** `node --test tests/*.test.js` → `Cannot find module '../app/queue-core.js'` (1 failing file).
- **GREEN:** implemented `app/queue-core.js` → **19/19 pass**.
- **Files added:** `app/queue-core.js` (rules), `app/staff.html`, `app/staff.js`, `app/display.html`,
  `app/display.js`, `app/screens.js`, `app/screens.css`, `tests/queue-core.test.js`, `tests/e2e.test.js`,
  `package.json`.
- **Files changed:** `app/queue.js` (now a shared store with live sync; same `TokenQueue.issue()` shape),
  `app/app.js` (shows real estimates and updates them live), `app/index.html` (loads the core, links to staff/display).
- **Unchanged:** `app/styles.css`, `app/data.js`.

### Stage D — QA Engineer
- **Skill:** `webapp-testing`. Skill tool returned "Unknown skill"; `SKILL.md` read directly. It prescribes Python
  Playwright, which is **not installed** here; fallback: **Node Playwright 1.63.0** with the same patterns
  (file:// for static HTML, wait for load, capture console errors).
- **Commands and results (final code):**
  - `npm test` → **19 pass, 0 fail**
  - `npm run test:e2e` → **10 pass, 0 fail** (covers AC-01.1, 02.1, 03.1, 05.1–05.3, 06.1–06.4, 07.1–07.2, 09.2–09.3,
    persistence across reload, no overflow at 390 px, no console errors)
- **Mutation check** (in a throwaway copy, not the repo): leaking patient names into the display and disabling
  live sync made **4 e2e tests and 1 unit test fail**, so the tests do detect those regressions.
- **Measured:** display updated 28 ms after Call Next (target < 2 s); display number 158 px at 1440 wide (target ≥ 120).
- **Bugs found and fixed (all visual, found by reviewing screenshots or the inspector):**
  1. One department on the display stretched across the TV with a large empty area → serving and next side by side.
  2. Staff "3 min (default)" wrapped onto two lines → value kept on one line, "default" as a small note.
  3. Display empty state left a 596 px blank stretch (inspector `blank-gap`) → centred; re-run shows the warning gone.
  4. `node --test tests/` failed with "Cannot find module .../tests" → npm scripts name the files explicitly.
- **`systematic-debugging`:** not needed: no functional test failed on the real code.
- **Taste inspector** (`inspect.mjs --app`): staff **0 FAIL, 2 WARN**; display **0 FAIL, 1 WARN**. Remaining warnings
  kept on purpose: colour share (the requested glass background), uneven card heights on the staff screen (the
  waiting list grows).

### Stage E — Integration
- Token page → shared queue → staff console → display verified together in one browser (same test run).
- Persistence: queue survives reload (e2e test). Validation and error states on the token page unchanged (e2e test).
- Authentication: none exists; staff and display pages are open (documented limitation).

### Remaining limitations
- No server: the queue is shared only between tabs/windows of one browser on one computer.
- No login: anyone with the page can open the staff console.
- One counter per queue (US-11 not built); no voice announcement (US-08 not built); no QR phone tracking (US-13).
- Departments, doctors and locations are sample data.

### Final status
**Completed** for US-05, US-06, US-07, US-09, US-10, with the test evidence above. Awaiting human review of the PR
and the BA decision on queue naming.

---

## Change — Rename to CareQueue

**Requested by:** the team. **Objective:** use one product and web name, **CareQueue**, everywhere.

- **Replaced:** "CarePlus Hospital", "CarePlus" and "QueueEase" in page titles, the header wordmark, the welcome
  headline, the token slip, the downloaded file name (`CareQueue-token-C001.png`), the sample data, code comments,
  `package.json`, and these docs. Internal names changed too: `CAREPLUS_DATA` → `CAREQUEUE_DATA`, storage keys
  `careplus-*` → `carequeue-*` (a queue saved under the old key is not carried over).
- **Check:** `grep -riE "careplus|queueease"` over the repo finds nothing; the four PDFs already used CareQueue.
- **Tests:** `npm test` 19/19 pass; `npm run test:e2e` 10/10 pass.
- **Screenshots:** all six in `docs/screenshots/` retaken from the renamed build.

---

## Demo-readiness audit (25 Oct 2026, ~01:10 IST)

**Objective:** verify the app works end-to-end on the demo laptop before the hackathon presentation.

### What was checked (read-only first)
- All 10 app files in `app/` read and verified for completeness.
- `package.json` `start` script: used `python3` — **Python 3 is not installed on this machine** (Windows 11).
- Disk space: C: drive at 100% (281 MB free) — Playwright Chromium (196 MB) cannot be downloaded.
- Chrome is installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`. ✓
- Node.js v24.17.0 is installed. `npx http-server@14.1.1` is available (pre-cached). ✓

### What was fixed

**1. Start command — `package.json`**
- **Before:** `python3 -m http.server 8000 --directory app` (fails: Python not installed)
- **After:** `npx http-server app -p 8000 -c-1 --cors` (Node-based, no install needed, already cached)
- Verified: all three pages return HTTP 200 via `curl -sL`.

**2. E2e tests — `tests/e2e.test.js`**
- **Before:** `chromium.launch()` — tries to use Playwright's downloaded Chromium (not present, disk too full to download)
- **After:** `chromium.launch({ channel: "chrome" })` — uses the installed Chrome binary; no download needed.

### Test results

```
npm test          →  19 / 19 pass   (queue-core unit tests, Node v24.17.0)
npm run test:e2e  →  10 / 10 pass   (Playwright e2e, installed Chrome, TEMP redirected to D:)
npm run test:all  →  29 / 29 pass
```

All 10 e2e tests cover the exact demo flow: token generation, Call Next, skip, recall, persistence across
reload, live display update (< 2 s), no patient details on the display, phone layout (no overflow at 390 px).

### No functional changes
No queue rules, HTML, CSS, data or validation logic was modified. Only `package.json` (start script) and
`tests/e2e.test.js` (browser channel) were changed. The working UI and token flow are untouched.

---

## Change — Standardize the CareQueue name and description

**Objective:** one name (**CareQueue**) and one description (**Hospital Digital Token and Queue Management System**).

- **Audit (read-only first):** no CarePlus/QueueEase left in repo code, UI, docs, PDFs or file names (fixed in the
  previous change). Inconsistent *descriptions* found in README, `package.json`, this log, the token page's meta
  description, and the subtitle of all four PDFs ("…for Small Clinics").
- **Changed:** those descriptions. The four PDFs were regenerated from their original generator scripts with only the
  subtitle changed; a text diff of each PDF before and after shows exactly two changed lines per PDF (the subtitle and
  the "Product" row), with page counts unchanged (3, 3, 4, 7).
- **Added:** `docs/role-conversations.md`: names and starter prompts for CareQueue role conversations. Only the
  Main Orchestrator conversation exists; the others are marked "Not yet".
- **Session:** this Claude Code conversation renamed to "CareQueue — Main Orchestrator".
- **Not changed, on purpose:** the merged git branch `add-careplus-token-prototype` and merge commit `5c1d720`
  (rewriting history is destructive); the package name `carequeue`; the domain word "queue" in code.
- **Blocked:** setting the GitHub repository description failed (HTTP 403, settings writes are not permitted from
  this environment). Manual action needed.
- **Open:** the MRD content still targets small clinics as its market; whether to reword it for hospitals is a BA
  decision, not a naming fix.

---

## Demo deck, backup recording and a form fix

**Deck:** `docs/deck/CareQueue_Team12_Demo_Deck.pptx`, built from the official team template
(`JJCET_Hackathon_Team_Demo_Template_1.pptx`) by replacing only the bracketed placeholder text inside the template's
own text runs; every shape, colour, font size and position is unchanged. Team 12, Future Coders; BA Sam Austin,
UI/UX Nishandhini, Dev Ashik Rasool, QA Rogasree. Speaker notes rewritten as a presenter script per slide.
Checks: `validate.py --original template` → all validations passed; leftover-placeholder search → none; every slide
rendered and reviewed. First render showed text auto-shrinking in seven boxes (sentences longer than the template
boxes allow); text shortened to fit at the template's own sizes, re-rendered and confirmed.

**Backup recording:** `docs/demo/CareQueue-backup-demo.webm` (47 s, 1440×900), recorded with Playwright from the real
app: patient sign-in → tokens issued → sign out → receptionist sign-in (PIN 1234) → Call Next → display → Skip →
Call Next → display. No page errors during the run. One frame at ~33 s is a mid-navigation paint (blank panel); a
DOM check and a screenshot of the same step confirmed the display shows the token correctly.

**Bug found by the recording:** after a token was issued, typing the next patient's details showed
"Please fix 1 field below" while still typing (validate-as-you-type stayed on after a successful submit).
- RED: new e2e test "after a token is issued, entering the next patient shows no errors until submit" failed
  (`expected: false, actual: true`).
- Fix: `app/app.js` resets the flag after a successful issue.
- GREEN: `npm test` 19/19; `PW_CHANNEL=chromium npm run test:e2e` 18/18 (Ashik's 7 login tests included).

**Test setup note:** commit `4e0bd53` switched the browser tests to installed Google Chrome (`channel: "chrome"`),
which this cloud session does not have. Chrome stays the default; `PW_CHANNEL=chromium` now runs the same tests on
Playwright's own Chromium.

---

## New epic and story: E5 Sign-in and access / US-14

**Why:** sign-in (landing page, patient sign-in, receptionist PIN, page guards) was built in commit `4e0bd53` and
tested, but no PRD feature, epic or story covered it, which breaks the demo → story → epic → PRD → need chain.

- **PRD:** added Should-Have **S6 Role-based sign-in** (demo-level security, no server).
- **Epics:** added **E5 Sign-in and access** (Should; traces to S6, MR-1, MR-2) with user need, goal and definition
  of done; added to the traceability chain and build order.
- **Stories:** added **US-14 Sign in as patient or receptionist** with four acceptance criteria:
  AC-14.1 role choice on the landing page · AC-14.2 patient sign-in opens the token page with the name filled in ·
  AC-14.3 correct PIN opens the staff console, wrong PIN is refused · AC-14.4 pages redirect when nobody is signed in.
- **Regenerated:** PRD, Epics and User Stories PDFs from their generator scripts. A line-by-line text check shows
  every previous line is still present; the only changed line is the count ("5 epics and 14 user stories").
  Backlog checks in the script passed: 5 epics, 14 stories, 39 acceptance criteria, every story traced.
- **Tests:** the 7 existing sign-in tests were renamed with their AC-14 IDs (no logic changed).
  `npm test` 19/19; `PW_CHANNEL=chromium npm run test:e2e` 18/18 — AC-14.1 to AC-14.4 all pass.
- **Docs:** README no longer says "No login"; run steps start at the landing page. Project status marks US-14 Completed.

---

## Feature F2 — Send to Billing (US-04, PRD S4)

**Objective:** a patient finishing at a department counter joins the Billing queue in one click, keeping their
details, so the system covers both halves of "registration and billing". Chosen by the team from the four unbuilt
backlog stories.

- **BA:** `docs/features/F2-send-to-billing.md`: story, AC-04.1/04.2, seven business rules, edge cases.
  Decision: Billing is a queue of its own (code B), shown on the staff console and the display; patients can also
  choose it directly.
- **Developer (TDD):**
  - RED: 6 new unit tests failed with `Q.sendTo is not a function`; 5 new browser tests failed (no button, no Billing
    queue). Existing 19 unit and 18 browser tests still passed.
  - GREEN: `QueueCore.sendTo(day, from, to, now)` completes the serving token, issues a linked token at the end of
    Billing with the patient's details (doctor cleared), links both ways (`linkedFrom`, `forwardedTo`).
    `TokenQueue.sendTo`, a Billing entry in `app/data.js`, a **Send to Billing** button on the staff console
    ("from G001" on billing tokens), and the patient's token page shows "Sent to Billing: your billing token is B00x".
  - Files: `app/queue-core.js`, `app/queue.js`, `app/data.js`, `app/app.js`, `app/staff.html`, `app/staff.js`,
    `app/screens.css`, `tests/queue-core.test.js`, `tests/e2e.test.js`.
- **QA:** `npm test` **25/25**; `PW_CHANNEL=chromium npm run test:e2e` **23/23**. Screens reviewed in the browser
  (staff before/after, Billing tab, display with the Billing queue, patient card); no page errors; no sideways scroll
  at 390 px.
- **Integration:** the display shows the Billing queue live; patient names stay off the display (unit + e2e test).
- **Demo deck:** slide 4's cut list no longer lists Send to Billing (now built); replaced with voice announcement
  (US-08, not built). Speaker notes updated. Validation passed; slide re-rendered.
- **Limits:** one counter per queue still; the PRD's separate Registration (R) queue is not used (departments act as
  the first stop).

---

## Merge — PR #6 (Flask backend + SQLite) with everything since

**Objective:** bring Ashik's open PR #6 into `main` without losing the work merged after it was branched
(PRs #7–#10: form fix, demo deck, architecture, US-14, Send to Billing).

- **Trial merge** of `main` into the PR branch: 6 files changed on both sides merged automatically through the
  `app/` → `frontend/` move; 4 conflicts: `README.md`, `docs/project-status.md`, `tests/e2e.test.js` (test startup),
  and `app/queue.js` (deleted in PR #6, extended with Send to Billing on `main`).
- **Send to Billing ported to the server** (tests first): 5 new backend tests failed, then passed after adding
  `linked_from` / `forwarded_to` columns, an automatic upgrade for existing databases, Billing in `seed.sql`,
  `send_to()` in `queue_service.py`, route `POST /api/queue/<code>/send-to/<target>`, and `sendTo` in
  `frontend/js/queue.js`.
- **Bug found in PR #6:** the staff console confirmed "Called undefined." because `act()` did not wait for the
  server. A new test reproduced it (`actual: 'Called undefined. It is now on the display.'`); `act()` now awaits the
  call and shows server errors. Test passes.
- **Test fix:** three billing browser tests clicked twice without waiting for the server; they now wait for the
  expected state, as PR #6's own tests do.
- **Results:** `npm test` 25/25 · `npm run test:backend` 11/11 · `npm run test:e2e` 24/24 (three consecutive runs).
- **Re-measured:** display update after Call Next on the server version: 0.11–0.70 s over 10 calls (median 0.35 s),
  replacing the 28 ms figure from the browser-only version on deck slide 4.
- **Deck:** slide 4 no longer lists "Server and database" as cut (now built); cut list is multiple counters, QR
  tracking, voice announcement. Notes say to start the app with `npm start`.
- **Not yet updated:** `docs/architecture/` diagrams (marked out of date).

---

## QA fixes 1 and 2 (approved by the team)

From the QA report (deployed branch tested locally under gunicorn; the live URL was blocked by the session's network
policy, so it was not tested directly).

- **Fix 1 — deploy `main`:** `render.yaml` deployed `refactor/organize-frontend-backend-database` (commit `91195c7`),
  which still shows "Called undefined." / "Recalled undefined." on the staff console and lacks Send to Billing.
  `branch:` is now `main`; README deploy step updated. Takes effect when Render redeploys from `main`.
- **Fix 2 — patient privacy:** root cause: `frontend/js/queue.js` treated every page except the display as a staff
  screen, so the patient page downloaded `/api/queue/state` with every patient's name and phone. Now only the staff
  console (`body.screen-staff`) loads `/api/queue/state`; the patient page and display load `/api/queue/public-state`.
  - RED: new e2e test failed (`actual: ['/api/queue/state']`); GREEN after the one-line change.
  - Results: `npm test` 25/25 · backend 11/11 · e2e 26/26 · QA run under gunicorn 45/46.
- **Still open (fix 3, not applied):** `/api/queue/state` and the queue actions are still callable by anyone who
  sends the request directly, because the PIN is checked only in the browser.

---

## Feature F3 — Voice announcement (US-08, PRD S2)

**Objective:** announce each called token on the waiting-room display, for patients who are not watching the screen.
Chosen by the team as the next story for the live demo.

- **BA:** `docs/features/F3-voice-announcement.md` (AC-08.1, AC-08.2, seven rules: sound starts off because browsers
  block sound until someone clicks; a call = new token or same token with a new call time, so Recall is announced;
  opening the display is silent; names are never spoken).
- **Developer (TDD):** 9 unit tests and 4 browser tests written first and watched fail (`Cannot find module
  announce.js`; no `#sound-toggle`). Then `frontend/js/announce.js` (rules + Web Audio chime + speechSynthesis,
  queued one at a time), a **Turn on sound** switch in the display header, and call detection in `display.js`.
- **Debugging (systematic-debugging):** after merging `main` into the branch, the browser test file failed with
  `SyntaxError: Unexpected end of input`. Root cause: both sides ended with the same two closing lines, which git kept
  once outside the conflict, so joining the two blocks dropped the US-08 test's closing lines. Restored; the file
  then held exactly the branch's lines plus main's 31 new lines.
- **QA (webapp-testing, Python Playwright via gunicorn):** announcement heard as "Token G 0 0 1, please come to
  General Medicine." with chime; no page errors; no sideways scroll at 390 px. Results: `npm test` 34/34 ·
  backend 11/11 · e2e 30/30 (three consecutive runs).
- **Deck:** slide 4's cut list no longer lists voice announcement; replaced with online booking (PRD Won't-Have).

---

## Feature F4 — Track my token on my phone (US-13, PRD S3)

**Objective:** let patients follow their token on their own phone by scanning a QR code on the slip, so they do
not have to watch the display. Chosen by the team as the next story (best live demo: judges scan with their phones).

- **BA:** `docs/features/F4-qr-phone-tracking.md` (AC-13.1–13.3, seven rules: QR code on card, print and PNG; no
  sign-in; numbers only, no patient details; live every second; waiting / almost / your turn / missed / sent to
  Billing / completed; slips from another day are recognised).
- **Developer (TDD):** 6 unit tests (`tests/track.test.js`) written first and watched fail (`Q.trackPath is not a
  function`). Then `QueueCore.track()` and `trackPath()`, the phone page `frontend/track.html` + `js/track.js`, and
  the QR code on the token card, print and download (`js/vendor/qrcode.js`, qrcode-generator 1.4.4, MIT, Kazuhiko
  Arase). No backend change: the page uses the existing public endpoint.
- **QA (webapp-testing):** 4 browser tests (QR shown with the right link; AC-13.1 on a 390 px phone with no
  sign-in and no patient details; AC-13.2/13.3 live updates and alert; invalid / unknown / old links). Decoded the
  card QR and the downloaded PNG's QR with OpenCV: both read `…/track.html?t=G004&d=<today>`. Print stays one A5
  page. Results: `npm test` 40/40 · backend 11/11 · e2e 34/34.
- **Deck:** slide 4's cut list no longer lists QR phone tracking; replaced with secure staff login (demo PIN only).

---

## Epic E6 — Queue reports (US-15, US-16, PRD C2)

**Objective:** a new epic chosen by the team: give the hospital today's queue figures (tokens, real waits, missed,
busiest hour) without counting slips by hand. Traces to the PRD's Could-Have **C2 Daily stats** and MRD MR-3/MR-4.

- **BA:** E6 and two stories (US-15 summary, 4 ACs; US-16 busiest hour + CSV, 2 ACs) added to
  `docs/CareQueue_Epics.pdf` and `docs/CareQueue_User_Stories.pdf` with the same generator as before (overview,
  traceability chain, build order, matrix and QA checklist updated). The backlog is now 6 epics, 16 stories,
  45 acceptance criteria, above the Stage 4 guideline of 3–5 epics / 8–15 stories; noted in the PDFs and status.
  Spec: `docs/features/F5-queue-reports.md`.
- **Developer (TDD):** 6 unit tests (`tests/report.test.js`) written first and watched fail (`Q.report is not a
  function`). Then `QueueCore.report()` and `reportCsv()`, the staff-only page `frontend/reports.html` +
  `js/reports.js` (totals, department table, tokens-per-hour bar chart, Download CSV), and a Reports link in the
  staff console. The page loads only `/api/queue/public-state`. No backend change.
- **Debugging:** two browser tests failed on the first run. (1) AC-15.4 expected a signed-in patient to land on
  `index.html`; the landing page correctly forwards patients to `patient.html`, so the test now expects that.
  (2) The report overflowed a 390 px phone: the grid let the wide table set its width; fixed with a
  `minmax(0, 1fr)` column so the table scrolls inside its card. The screenshot review also found the staff console's
  phone rule hiding every table's 4th column (here "Waiting"); the report now keeps all columns.
- **QA:** 7 browser tests (AC-15.1–15.4, AC-16.1–16.2, phone fit) plus a public-data-only check. Screenshots on
  desktop and phone reviewed. Results: `npm test` 46/46 · backend 11/11 · e2e 41/41.

---

## Feature F6 — Multiple counters (US-11, PRD S5)

**Objective:** the last unbuilt story. The team chose "full counters": up to 3 counters per queue, each calling its
own patient, instead of changing only the estimate.

- **BA:** US-11 widened in `docs/CareQueue_User_Stories.pdf` (title "Serve from more than one counter", size L,
  AC-11.3 each counter calls its own patient, AC-11.4 display/voice/phone name the counter). Spec:
  `docs/features/F6-multiple-counters.md` (seven rules: Counter 1 open by default; my counter per receptionist;
  one waiting line; no pausing a busy or the last counter; EWT = R + (N / C) x AST; where the counter shows; old
  tokens count as Counter 1).
- **Developer (TDD):** 10 unit tests (`tests/counters.test.js`) and 5 API tests written first and watched fail
  (`Q.openCounters is not a function`; 404 on `/api/queue/G/counters/2`). Then: `tokens.counter` column (added to old
  databases by `upgrade_schema`), `open_counters` table, counter-aware call / skip / recall / send-to and a new
  `POST /api/queue/<code>/counters/<n>` route on the server; the same rules in `QueueCore`; counter chips with
  Open/Pause in the staff console; counter badges on the display; "counter 2" in the voice; the counter on the token
  card and phone page. Four older tests were updated for the new wording and the list of serving tokens.
- **Debugging:** (1) one browser test failed on two console errors; they were the two pauses the test asks the server
  to refuse (HTTP 400), so the test now expects exactly those. (2) Screenshot review: on a 390 px phone the three
  serving numbers overlapped; the slots now wrap onto new lines (checked for overlap at 390, 1024 and 1440 px).
- **QA:** 5 browser tests (default counters, AC-11.1–11.4 including two receptionists in separate browsers).
  Results: `npm test` 56/56 · backend 16/16 · e2e 46/46.
- **Deck:** slide 4's cut list no longer lists multiple counters; replaced with reports for past days.

---

## Architecture diagram and ERD updated

The diagrams in `docs/architecture/` had been marked out of date since PR #6 (they showed the browser-only version
with `localStorage`). Redrawn from the code as it stands:

- **Architecture:** people → 6 pages → shared modules → Flask API → SQLite, plus browser storage, Render hosting,
  the three test suites and the known limits (browser-only PIN, polling, ephemeral SQLite on the free plan).
- **ERD:** the four SQLite tables from `database/schema.sql` (`departments`, `tokens`, `queue_counters`,
  `open_counters`) with keys and relationships, including the Send to Billing link between tokens, plus the browser
  session.
- PNG (2x), SVG and a two-page PDF regenerated; the README has the same content as Mermaid. A screenshot review moved
  three labels that sat on arrows.

---

## QA fix 3 — staff PIN checked on the server (approved by the team)

From the QA report: the PIN was checked only in the browser, so anyone could call the queue actions or read
`/api/queue/state` (patient names and phones) directly.

- **Developer (TDD):** 5 API tests written first and watched fail (404 on `/api/staff/sign-in`; staff routes answered
  200 without a pass). Then: `POST /api/staff/sign-in` checks the PIN (`CAREQUEUE_STAFF_PIN`, default `1234`,
  constant-time compare) and returns a signed staff pass (itsdangerous, 8 hours, key from `CAREQUEUE_SECRET_KEY` or
  a new random key per start). `/api/queue/state`, call-next, skip, send-to, recall and counters need
  `Authorization: Bearer <pass>` and answer 401 otherwise. Patient and public routes are unchanged.
- **Browser:** the landing page asks the server to check the PIN; the staff console sends the pass with every request
  and goes back to sign-in on a 401 (an expired pass, an old session from before this change, or a server restart
  without a fixed key). The browser no longer knows the PIN.
- **Tests:** browser test sessions now sign in through the API for a real pass; the wrong-PIN test waits for the
  server's answer. 2 new browser tests (old session sent back to sign-in; actions without a pass refused).
  Checked under gunicorn as on Render (401 without a pass, 200 with it, test reset 404).
  Results: `npm test` 56/56 · backend 21/21 · e2e 48/48.
- **Docs:** README, project status, demo checklist, architecture diagram and README updated; `render.yaml` gains a
  generated `CAREQUEUE_SECRET_KEY` (applies to Blueprint-managed services).

---

## Four new stories (US-17 to US-20) and Feature F7 — Priority tokens (US-17, PRD C1)

**Backlog:** the team asked for 4 new stories and chose Tamil display + voice; the other three were filled from the
PRD's Could-Haves as offered: priority tokens (C1), turn-is-near alert (C4) and a visit rating shown in Reports
(extends C2). Added to the User Stories and Epics PDFs (20 stories, 60 acceptance criteria); built one at a time.

- **BA:** `docs/features/F7-priority-tokens.md` (AC-17.1–17.4, six rules).
- **Developer (TDD):** 6 unit tests (`tests/priority.test.js`) and 4 API tests written first and watched fail. Then:
  `tokens.priority` column (checked values; added to old databases), validation and Senior age rule on the server,
  `ORDER BY priority IS NULL, seq` for Call Next, the same order in `QueueCore`, priority kept when sent to Billing,
  public state reduced to "priority: yes". Token form gains a Priority choice; token card, print and PNG show it;
  staff list and display mark it.
- **Debugging:** a browser test failed on the second token: the form kept "Senior 60+" selected after issuing, so the
  next patient (age 40) was refused. Root cause: the form keeps its values between patients by design, but priority
  belongs to one patient. The form now resets priority to None after each token.
- **QA:** 2 browser tests (AC-17.1; AC-17.2–17.4 on staff list and display, reason never on the display). Screenshots
  of the form, card, staff list, display and phone. Results: `npm test` 62/62 · backend 25/25 · e2e 50/50.

---

## Feature F8 — Tamil display, voice and phone page (US-18, PRD C3)

- **BA:** `docs/features/F8-tamil.md` (AC-18.1–18.3, five rules, and a review step for the Tamil wording).
- **Developer:** `frontend/js/i18n.js` holds the English and Tamil text, Tamil department names, places and the
  Tamil announcement. The tables were written before their tests (6 unit tests in `tests/i18n.test.js` check every
  English text has a Tamil version in Tamil script with the same placeholders). The voice choice was test-first:
  `pickVoice` failed (`A.pickVoice is not a function`), then passed. The display and phone page have an
  English / தமிழ் switch (remembered per device, `?lang=ta`), Noto Sans Tamil, and a note when the screen has no
  Tamil voice (calls then stay in English).
- **QA:** 4 browser tests (display in Tamil and remembered after reload; Tamil voice with a stubbed Tamil voice;
  English fallback and note without one; phone page in Tamil, also via `?lang=ta`). Screenshots at 1920 px and
  390 px; the phone header was tidied so the sound button and clock do not wrap. Headless Chromium has no voices,
  so actual Tamil speech is not covered by the tests and needs a check on the demo PC.
  Results: `npm test` 68/68 · backend 25/25 · e2e 54/54.

---

## Feature F9 — Turn-is-near alert (US-19, PRD C4)

- **BA:** `docs/features/F9-turn-alert.md` (AC-19.1–19.3, four rules; phone notifications instead of SMS, with the
  reason).
- **Developer (TDD):** 4 unit tests (`tests/alerts.test.js`) written first and watched fail (`Cannot find module
  alerts.js`). Then `frontend/js/alerts.js` (alert rules; notification through the service worker, which Android
  requires, or `new Notification`; vibration), `frontend/sw.js`, `frontend/favicon.svg`, and an **Alert me** button
  on the phone page in English and Tamil.
- **QA:** 2 browser tests with recorded notifications and vibration (one alert at 2 ahead, none at 1 ahead, one when
  called; none for the state when turned on; none after turning off). A separate run with the real service worker
  and notification permission showed the notification "Almost your turn (G004) | General Medicine: 2 ahead of you."
  Results: `npm test` 72/72 · backend 25/25 · e2e 56/56.

---

## Feature F10 — Rate my visit (US-20) · all 20 stories built

- **BA:** `docs/features/F10-visit-rating.md` (AC-20.1–20.3, five rules, one known limit).
- **Developer (TDD):** 3 unit tests (report averages, CSV columns, when tracking may ask) and 3 API tests written
  first and watched fail. Then `tokens.rating` (1–5, added to old databases), `POST /api/tokens/<number>/rating`
  (400 for a bad value, 404 for an unknown token, 409 when not finished, sent to Billing or already rated), star
  buttons on the phone page (English and Tamil) and a rating tile and column in Reports and the CSV. Two older
  tests were updated: one compares the whole tracking result, one the CSV header.
- **Debugging:** the new browser test first waited for "waiting", but G001 with nobody ahead is in the "almost"
  state; the test now waits for 0 people ahead.
- **Docs:** architecture diagram and ERD updated for priority, Tamil, alerts and ratings.
- **QA:** 2 browser tests (rate once, refused again, shown after reload, Reports and CSV; Tamil question).
  Results: `npm test` 75/75 · backend 28/28 · e2e 58/58. All 20 stories in the backlog are now built.

---

## Five more stories (US-21 to US-25) and Feature F11 — Doctor delay notice (US-21)

**Backlog:** the team asked for 5 new stories and "a unique feature", so the stories go beyond a standard queue:
doctor delay notice (US-21), hold my place while stepping out (US-22), share my token with family (US-23), estimate
accuracy against the PRD success metric (US-24) and best time to visit (US-25). Added to the PDFs (25 stories,
74 acceptance criteria); built one at a time.

- **BA:** `docs/features/F11-delay-notice.md` (AC-21.1–21.3, five rules).
- **Developer (TDD):** 4 unit tests (`tests/delay.test.js`) and 3 API tests written first and watched fail. Then the
  `delays` table, `POST /api/queue/<code>/delay` (staff pass; fixed reasons; 5–180 minutes; `{"clear": true}`),
  `QueueCore.delayIn()` and the delay added to estimates; a delay row in the staff console; a banner on the display
  and the phone page in English and Tamil. One older test compares the whole tracking result and gained `delay`.
- **QA:** 2 browser tests (post → display, phone, +20 min, Tamil, clear; refused without a staff pass). Screenshots
  of staff console, display and phone. Results: `npm test` 79/79 · backend 31/31 · e2e 60/60.

---

## Feature F12 — Hold my place (US-22, PRD S1)

- **BA:** `docs/features/F12-hold-my-place.md` (AC-22.1–22.3, five rules, one known limit).
- **Developer (TDD):** 5 unit tests (`tests/away.test.js`) and 2 API tests written first and watched fail. Then
  `tokens.away_until` (kept after return, so each token steps out once), the Call Next filter on the server and
  `QueueCore.nextUp()`, `POST /api/tokens/<number>/away`, a step-out card on the phone page (English and Tamil), an
  "Away until" tag and the next present patient on the staff console, and "Stepped out" on the display.
- **QA:** 1 browser test covering the whole flow (step out, passed over, front place kept, back, called).
  Screenshot review: the card still asked "Need to step out?" while the patient was away; headings now say
  "You've stepped out" and "Welcome back". Results: `npm test` 84/84 · backend 33/33 · e2e 61/61.

---

## Feature F13 — Share my token (US-23, PRD S3)

- **BA:** `docs/features/F13-share-token.md` (AC-23.1–23.2, three rules).
- **Developer (TDD):** 3 unit tests (`tests/share.test.js`) written first and watched fail (`Cannot find module
  share.js`). Then `frontend/js/share.js` (message without patient details; Web Share, else clipboard; cancel is not
  an error) and a **Share with family** button on the token card and the phone page (English and Tamil).
- **QA:** 2 browser tests (share sheet on the token card with the exact message and link; clipboard fallback on the
  phone page, and the shared link shows no name or phone). Results: `npm test` 87/87 · backend 33/33 · e2e 63/63.

---

## Feature F14 — Estimate accuracy (US-24, PRD success metric)

- **BA:** `docs/features/F14-estimate-accuracy.md` (AC-24.1–24.3; measured exactly as the PRD's "EWT accuracy" row).
- **Developer (TDD):** 3 unit tests (accuracy from the 4th token, empty when nothing to check, CSV columns) and
  2 API tests with hand-worked estimates (0/3/6/9 min; priority; two counters 4.5 → 5; a 20-min delay → 26) written
  first and watched fail. Then `estimate_for_new()` on the server (the same rule as `QueueCore.estimate`), saved in
  `tokens.estimate_min` for new and Billing tokens; accuracy in `QueueCore.report()`; a tile with the 80% target, a
  column and two CSV columns in Reports. Four older CSV checks and one table-column index were updated for the new
  columns.
- **QA:** 2 browser tests (the saved estimate equals the token card's with a patient at the counter and two counters
  open; Reports and CSV show 0% (2) and "not met" when calls come much earlier than estimated). Screenshot with
  realistic times in a throwaway database: 70% (10), not met. Results: `npm test` 90/90 · backend 35/35 · e2e 65/65.

---

## Feature F15 — Best time to visit (US-25) · all 25 stories built

- **BA:** `docs/features/F15-best-time.md` (AC-25.1–25.3, five rules).
- **Developer (TDD):** 3 unit tests (`tests/besttime.test.js`: averages with empty hours as 0, quietest and busiest
  hours, fewer than 3 days) and 1 API test (earlier days only, 28-day window, no names or phones) written first and
  watched fail. Then `QueueCore.bestTimes()`, `GET /api/history/hourly`, a test-only `POST /api/test/seed-history`
  (404 outside test mode, checked by a test), and the public `best-time.html` page with English / Tamil, linked from
  the landing page and the phone page.
- **Docs:** architecture diagram and ERD updated for US-21 to US-25 (`delays` table, `away_until`, `estimate_min`,
  new routes and page).
- **QA:** 2 browser tests (page with 4 days of history at 390 px, Tamil, no patient details; "not enough history" with
  2 days). Results: `npm test` 93/93 · backend 37/37 · e2e 67/67. All 25 stories in the backlog are now built.
