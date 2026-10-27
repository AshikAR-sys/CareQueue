# Feature F5 — Queue reports

**Role:** Business Analyst (stage A) · **Epic:** E6 Queue reports (new) · **Stories:** US-15, US-16 (Could) ·
**PRD:** C2 Daily stats · **MRD:** MR-3, MR-4

## User problem

The hospital has no record of how the queue performed: how many patients came, how long they really waited and when
the rush happened. Without it, staff rotas are guesswork and the waiting-time promise (MR-3) cannot be checked.

## Stories and acceptance criteria (added to the Epics and User Stories PDFs)

**US-15 See today's queue summary.** As a hospital administrator, I want to see today's tokens, waits and missed
patients for every department on one page, so that I can tell how the queue is performing without counting slips by
hand.

- **AC-15.1** Each department shows tokens issued, served, waiting and missed; totals match the staff console.
- **AC-15.2** It shows the average wait (issued to called) and the average service time (called to done) in minutes.
- **AC-15.3** The numbers update within 2 seconds without a page refresh.
- **AC-15.4** Anyone not signed in as staff is sent back to the landing page.

**US-16 Find the busiest hour and export the day.** As a hospital administrator, I want to see how many tokens were
issued in each hour and download the day's figures, so that I can put more staff on at the busiest time and keep a
record.

- **AC-16.1** A bar chart shows tokens issued per hour; the busiest hour is highlighted and named.
- **AC-16.2** Download CSV saves one row per department and a total row, with the same numbers and no patient names
  or phone numbers.

## Business rules

1. **Staff only:** `reports.html` opens for the receptionist sign-in, like the staff console. It is linked from the
   staff console's screen switcher.
2. **Numbers only:** the page reads the public queue endpoint, so patient names and phone numbers never reach it,
   and the CSV cannot contain them.
3. **Served** = completed at that department, including patients sent on to Billing (also counted under "To Billing").
   Billing is its own row.
4. **Average wait** = time from issuing a token to calling it, over every token called today (including missed ones).
   **Average service** = time from calling a token to completing it. Shown to one decimal place; "–" when there is
   nothing to average yet.
5. **Per hour:** tokens counted by the hour they were issued, every hour from the first to the last token shown (zero
   hours included). Ties for busiest go to the earliest hour.
6. **Today only:** the report covers today's tokens; history across days is out of scope.

## Out of scope

- Reports for past days or date ranges, charts per department, staff performance figures.
