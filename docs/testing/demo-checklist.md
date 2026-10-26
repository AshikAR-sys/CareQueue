# CareQueue Demo Checklist

**Event:** JJCET AI-PDLC Hackathon · 25 October 2026  
**Team:** Future Coders (Sam Austin, Ashik Rasool, Nishandhini, Rogasree)

## Pre-demo setup

- [ ] Install Python and Node.js.
- [ ] From the repository root, run `python -m pip install -r backend/requirements.txt`.
- [ ] Run `npm install` and, for browser tests, `npx playwright install chromium`.
- [ ] Start CareQueue using `npm start`.
- [ ] Open http://127.0.0.1:8000 in Chrome or Edge.
- [ ] Sign in through the demo Patient Portal or Receptionist Portal.
- [ ] Open the waiting-room display from the login page or navigate to `http://127.0.0.1:8000/display.html`.

All screens must connect to the same running CareQueue server. By default, it listens on `127.0.0.1` and is intended for a single demo computer.

## Core demo flow

| # | Action | Expected result | Pass / Fail |
|---|---|---|---|
| 1 | Sign in as patient and submit valid details (General Medicine, name, age 30, gender, phone 9876543210) | Token card shows a unique token such as G001 | |
| 2 | Issue a second token in the same department | Number increments (for example G002) without duplicates | |
| 3 | Open the receptionist console and select General Medicine | New tokens appear in the waiting list | |
| 4 | Press **Call Next** | First waiting token becomes serving; display updates without manual refresh | |
| 5 | Refresh the staff tab | Serving and waiting status remains, loaded from SQLite | |
| 6 | Press **Skip** on the serving token | Token appears in Missed | |
| 7 | Press **Call Next**, then **Recall** the missed token | Recalled token becomes serving; prior serving token is completed | |
| 8 | Check the public display | It shows token numbers/status only, not patient names or phone numbers | |
| 9 | Check print/download on the patient token card | Print and PNG download still work after the architecture change | |

## Automated test commands

```bash
npm test
npm run test:backend
npm run test:e2e
npm run test:all
```

Record the actual command output before declaring the migration verified.

## Known limitations

| Limitation | Explanation |
|---|---|
| Demo authentication | The PIN is checked client-side. Do not treat it as secure authentication. |
| Local host binding | The server listens on `127.0.0.1`; other devices cannot connect by default. |
| Sample departments and doctors | Data is demo content; configure for the target hospital before any real use. |
| Single counter per department | Multiple counters (US-11) are not implemented. |
| QR tracking needs a reachable server | A phone cannot open the laptop's `127.0.0.1`; demo the QR scan on the deployed site. |
| No production safeguards | Do not use real patient data or expose publicly without security/privacy review. |

## Clean demo database

The local database is stored at `database/carequeue.sqlite3` and is intentionally ignored by Git. To start with a fresh demo queue, stop the server and remove that file; the schema and sample departments are recreated at the next startup. Do not delete the database while the server is running.
