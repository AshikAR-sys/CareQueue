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
