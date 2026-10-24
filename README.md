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

No install and no build step. The app is plain HTML, CSS and JavaScript.

1. Clone the repo:
   ```bash
   git clone https://github.com/AshikAR-sys/CareQueue.git
   cd CareQueue
   ```
2. Open `app/index.html` in Chrome, Edge or Safari (double-click it).

Optional, to serve it locally instead:
```bash
npx serve app        # or: python3 -m http.server 8000 --directory app
```

## What works today

The **token generation page** (demo hospital: CarePlus Hospital):

- Choose a department and, optionally, a doctor; enter name, age, gender and a 10-digit mobile number.
- Form validation with a message on each field that needs fixing.
- Generates a token per department per day (e.g. `C001`, `C002`), with loading, success and error states.
- Live token preview that follows the form; a clearly labelled **Sample preview** before you submit.
- **Print Token** (one A5 page) and **Download** (PNG of the token slip).
- Responsive: three columns on desktop, two on tablet, one on phone. Liquid Glass styling with fallbacks when backdrop blur or transparency is unavailable.

## Honest limits

- **No backend yet.** Tokens are numbered in the browser (`localStorage`) on this device only and are labelled "Demo token". They are not a real hospital queue position.
- **No waiting-time estimate yet** for generated tokens: the page says "Not available yet" rather than inventing one. The `20–30 min` shown before submitting is part of the labelled sample.
- Departments, doctors and room locations in `app/data.js` are **sample data**.
- The Departments, Our Doctors and Patient Guide links and the notification bell are placeholders.
- **Not yet built from the backlog:** the staff Call Next console, the Now-Serving waiting-room display and the live estimated waiting time (PRD Must-Haves M2 and M3; stories US-05, US-06, US-09, US-10).

## Project structure

```
app/
  index.html     page markup
  styles.css     Liquid Glass styling, responsive layout, print styles
  app.js         form, validation, preview states, print and download
  queue.js       queue service; replace `issue()` to connect a backend
  data.js        sample departments and doctors
  assets/        background illustration
docs/
  CareQueue_MRD.pdf            Market Requirements Document
  CareQueue_PRD.pdf            Product Requirements Document
  CareQueue_Epics.pdf          4 epics with traceability
  CareQueue_User_Stories.pdf   13 stories, 35 acceptance criteria, test checklist
  screenshots/
```

## Connecting a real queue

`app/queue.js` exposes one function, `TokenQueue.issue(details)`, which resolves to `{ number, issuedAt, mode, estimate }`. Replace its body with a call to your backend and return `estimate: { minMinutes, maxMinutes }` from live queue data; the page shows it automatically.
