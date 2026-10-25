# Feature F3 — Voice announcement

**Role:** Business Analyst (stage A) · **Story:** US-08 (Should) · **Epic:** E2 Calling and Now-Serving display ·
**PRD:** S2 · **MRD:** MR-2

## User problem

Patients who cannot see the display well, or who are not looking at it (elderly patients, people with children,
anyone reading or on the phone), miss their turn. The receptionist then has to call out names, which the display was
meant to replace.

## Story

**As an** elderly patient, **I want** to hear my token number announced when it is called, **so that** I don't miss
my turn if I can't see the screen.

## Acceptance criteria (from the User Stories PDF)

- **AC-08.1** Given the display has sound on, when a token is called, then a chime plays and a voice says, for
  example, "Token G 0 0 1, please come to General Medicine".
- **AC-08.2** Given a token is recalled, when it becomes Now Serving again, then the announcement plays again.

## Business rules

1. **Sound starts off.** Browsers do not allow a page to play sound until someone interacts with it, so the display
   shows a **Turn on sound** button. Pressing it plays a short test chime and switches sound on; pressing it again
   switches sound off. The button says which state it is in.
2. **What triggers an announcement:** a new call, meaning the token being served in a department changes, or the
   same token is called again (Recall). Detected from the token number together with the time it was called, so a
   recall is announced even if the number on screen did not change.
3. **What is said:** "Token" + the token's characters spoken one by one + ", please come to" + the department name.
   Spelling the characters out ("G 0 0 1") keeps it clear in a noisy hall. Patient names are never spoken.
4. **Opening the display does not announce** the tokens already being served; only calls made after it opened.
5. Several calls close together are announced one after another, never over each other.
6. The display keeps working silently if the browser has no speech voice.
7. **Accessibility:** the button is keyboard reachable, uses `aria-pressed`, and the visible number change remains
   the primary signal.

## Out of scope

Choosing a voice or language (the browser's default English voice is used); announcements on the staff console.
