# Feature F1 — Design decisions (UI/UX, stage B)

**Skill used:** `design-taste-frontend` (Taste skill v2), loaded with the Skill tool; its app-screen rules
(`references/app-screens.md`) applied. Where Taste's house rules ban glass, gradients and floating shadows, the
existing approved Liquid Glass design of the token page takes priority, as on the token page. Inspector checks for
those are switched off explicitly (`--allow`), never hidden.

## Screen 1 — Staff console (`frontend/staff.html`)

- **The screen's one question:** "Who do I call next?"
- **Biggest thing:** the token now being served, with the **Call Next** pill beside it (the most frequent job, one click).
- **Blocks, in reading order:**
  1. Department switcher: a row of pills, each showing its waiting count (counts computed from the rows).
  2. Now serving: token number, patient name, age and gender (staff may see names), time since called; Call Next, Skip.
  3. Waiting list: position, token, patient, waited so far, estimated wait. Tabular figures, right-aligned numbers.
  4. Missed list with a Recall action per row (shown only when not empty).
- **States:** empty queue ("No one is waiting" + Call Next disabled), nobody serving (Skip disabled, says why),
  storage unavailable notice, keyboard focus on every control.

## Screen 2 — Waiting-room display (`frontend/display.html`)

- **The screen's one question:** "Is it my turn, and how long?"
- **Biggest thing:** each active department's Now Serving number, at least 120 px high (AC-06.4), readable from 6 m.
- **Per department panel:** department name and letter, Now Serving number, the next 5 waiting tokens with their
  estimated wait. **Token numbers only; patient names are never put in the page (AC-06.3).**
- **Header:** CareQueue, live clock, a one-line instruction ("Keep your token. Your number will appear here.").
- **States:** no tokens yet today (one sentence in the frame), a department with nobody waiting ("No one waiting").
- **Layout:** fills a 1920×1080 TV; panels sized by the number of active departments (1–3 across, wraps).

## Shared visual language (from the token page)

Same tokens in `styles.css`: glass panels, rim highlight, pill buttons, the blue-to-cyan primary pill, SF-style
type, tabular figures for all numbers. The display adds a darker scrim behind numbers only if contrast fails.

## Approval criteria (checked in the browser before the feature is called done)

1. Both screens render with the same glass language as the token page (screenshot review).
2. Display: Now Serving numbers ≥ 120 px (measured from computed style).
3. Display: no patient name anywhere in the display's DOM (text search).
4. Taste inspector: 0 FAIL at 1440 / 768 / 390, with only the glass-related checks allowed.
5. Text contrast ≥ 4.5:1 on every surface (inspector contrast check).
6. Staff console usable at phone width (no sideways scroll), and every control reachable by keyboard.
