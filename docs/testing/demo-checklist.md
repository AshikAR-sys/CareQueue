# CareQueue Demo Checklist

**Event:** JJCET AI-PDLC Hackathon · 25 October 2026
**Team:** Future Coders (Sam Austin, Ashik Rasool, Nishandhini, Rogasree)
**Last updated:** 25 Oct 2026 by the Demo-Readiness audit

---

## Pre-demo setup (do before the judges arrive)

- [ ] Laptop is plugged in (no power-saving throttle)
- [ ] Browser zoom set to 100 %
- [ ] `npm start` running (`cd CareQueue && npm start`)
- [ ] Three tabs open in the **same browser window**:
  - Tab 1 — Token page: `http://localhost:8000`
  - Tab 2 — Staff console: `http://localhost:8000/staff.html`
  - Tab 3 — Display: `http://localhost:8000/display.html`
- [ ] (Optional) Display tab moved to a second monitor / TV
- [ ] localStorage cleared for a clean demo start (DevTools → Application → Storage → Clear site data)

---

## Core demo flow (steps 1–8 from the Phase 3 spec)

| # | Action | Expected result | Pass / Fail |
|---|--------|----------------|-------------|
| 1 | Submit a token request with valid details (dept: General Medicine, name: any, age: 30, gender: Male, phone: 9876543210) | Token card shows a unique token number (e.g. G001) with "Issued" status and an estimated wait | |
| 2 | Confirm unique token | Token number displayed — no two tokens share the same number in the same department per day | |
| 3 | Switch to the Staff console tab | G001 appears in the Waiting list for General Medicine | |
| 4 | Press **Call Next** on the Staff console | G001 moves to "Now serving"; Waiting list shrinks; Display tab shows G001 under "Now serving" without a browser refresh | |
| 5 | Switch back to Token page | The wait estimate on the G001 card updates to "It's your turn now" within 2 seconds | |
| 6 | Refresh the Staff console tab (F5) | G001 remains in "Now serving"; no data loss | |
| 7a | Submit the token form with all fields empty | Five inline error messages appear; token card stays at "Sample preview" state | |
| 7b | Try to submit a second token in the same session after changing the form | A new unique token (e.g. G002) is issued; it does not reuse G001 | |
| 8 | Press **Skip** on the Staff console while G001 is serving | G001 moves to the Missed list; now-serving shows "—" | |
| 9 | Press **Call Next** again | G002 (or next waiting token) is now serving | |
| 10 | Press **Recall G001** from the Missed list | G001 becomes serving again; missed list is empty | |

---

## Automated test evidence (run before the demo)

```
npm test          → 19 / 19 unit tests pass   (queue rules: issue, callNext, skip, recall, estimate)
npm run test:e2e  → 10 / 10 e2e tests pass    (all three screens, persistence, phone layout)
```

Run `npm run test:all` to execute both suites in one command and confirm **29/29 pass**.

---

## Validation error states

| Input | Expected error message |
|-------|----------------------|
| Empty department | "Select a department." |
| Empty name | "Enter the patient's name." |
| Empty age | "Enter the age." |
| No gender selected | "Select a gender." |
| Empty phone | "Enter a mobile number." |
| Phone: 1234567890 (starts with 1) | "Enter a 10-digit mobile number starting with 6, 7, 8 or 9." |
| Name: "A" (1 char) | "Name must be at least 2 letters." |
| Age: 150 | "Enter an age from 0 to 120." |

---

## Persistence check

1. Generate two tokens (G001, G002) and call G001.
2. Close the Staff console tab and reopen `http://localhost:8000/staff.html`.
3. G001 must still appear as "Now serving". ✓ Verified by automated e2e persistence test.

---

## Known limitations (state openly to judges)

| Limitation | Explanation |
|-----------|-------------|
| **No server/backend** | The queue lives in this browser's `localStorage`. Other computers on the network cannot see the queue. All three screens must be open in the same browser on the same computer. |
| **No login** | The staff console is open to anyone with the URL. Login was out of scope in the PRD. |
| **Single counter per queue** | One patient served at a time per department (US-11 not built). |
| **No voice announcement** | US-08 not built. |
| **No QR tracking** | US-13 not built. |
| **Queue resets daily** | Each calendar day starts fresh (by design — `YYYY-MM-DD` key in localStorage). |
| **Google Fonts dependency** | The Inter font loads from Google Fonts. If there is no internet, the fallback system font is used — UI is slightly different but fully functional. |

---

## Fallback if the server fails

The app runs without a server. Open the HTML files directly in Chrome:

- `frontend/index.html` — patient token page
- `frontend/staff.html` — staff console
- `frontend/display.html` — display

All features work identically via `file://`.
