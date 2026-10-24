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
