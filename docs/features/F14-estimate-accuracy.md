# Feature F14 — Estimate accuracy (PRD success metric)

**Role:** Business Analyst (stage A) · **Story:** US-24 (Could) · **Epic:** E6 Queue reports · **PRD:** M3 and the
success metric "EWT accuracy" · **MRD:** MR-3

## Story

**As a** hospital administrator, **I want** to see how close each estimate was to the real wait, **so that** we can
prove the PRD target of 80% within 5 minutes or see where it slips.

## Acceptance criteria

- **AC-24.1** When a token is issued, the estimate shown at that moment is stored with it.
- **AC-24.2** Reports show, per department, the share of tokens (after the first 3) whose real wait was within 5
  minutes of the estimate, and compare the total with the 80% target.
- **AC-24.3** The CSV includes the accuracy figures.

## Business rules

1. **Measured exactly as the PRD says:** "Actual wait (created → called) vs EWT shown at creation, after first 3
   tokens". The server works out the estimate when it creates the token (and the Billing token for Send to
   Billing) with the same rule as the screens, `EWT = delay left + R + (N / C) × AST`, and saves it in
   `tokens.estimate_min`. A browser test checks that it matches the token card.
2. **Checked tokens:** the 4th token onwards in each queue (each queue's first 3 use the default service time),
   once called. Still-waiting tokens are not counted yet.
3. **Reports:** an "Estimate accuracy" tile ("70% (10)" = share within ±5 min, tokens checked) with "Target 80% …
   met / not met", an Accuracy column per department, and two CSV columns.
4. The real wait includes any time the patient spent stepped out (US-22) or missed (US-07); those tokens can count as
   outside 5 minutes, which is honest about what patients experienced.
