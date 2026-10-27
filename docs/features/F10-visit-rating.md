# Feature F10 — Rate my visit

**Role:** Business Analyst (stage A) · **Story:** US-20 (Could) · **Epic:** E6 Queue reports · **PRD:** C2 (daily
stats, extended) · **MRD:** MR-3

## Story

**As a** patient, **I want** to give my visit 1 to 5 stars on my phone page when it is finished, **so that** the
hospital learns how patients feel about the wait.

## Acceptance criteria

- **AC-20.1** When my visit is completed, my phone tracking page asks "How was your visit?" with 1 to 5 stars.
- **AC-20.2** Choosing a rating saves it and thanks me; a second rating for the same token is refused.
- **AC-20.3** Reports show each department's average rating and number of ratings, also in the CSV.

## Business rules

1. One tap on a star sends the rating (`POST /api/tokens/<number>/rating`, no sign-in, like the tracking page).
2. Only a finished visit can be rated, once. A patient sent on to Billing rates on the billing token at the end.
3. Only the number is stored (`tokens.rating`, 1–5). No comments, so no personal details can be typed in.
4. Reports: "4.5 / 5 (2)" = average and count, per department and in total; CSV columns "Average rating (1-5)" and
   "Ratings".
5. English and Tamil, like the rest of the phone page.

## Known limit

Anyone who knows a token number could rate it before the patient does (there is no login on the phone page). This is
acceptable for an internal quality signal, not for anything that needs proof.
