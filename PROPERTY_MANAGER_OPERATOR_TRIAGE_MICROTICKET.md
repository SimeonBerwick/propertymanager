# Property Manager V1 - Operator Triage Micro-Ticket

## Purpose
This is the immediate implementation ticket for the next PM V1 slice.

Do this before chasing additional workflow expansion.
The goal is to make the operator surface feel like a real maintenance command center using data that already exists in the app.

---

## Scope
Focus only on:
- `app/operator/requests/page.tsx`
- `app/operator/requests/[id]/page.tsx`
- any small helper/presentation additions needed to support clearer triage labels

Do not expand scope beyond this slice unless absolutely required to make the surface coherent.

---

## Micro-task 1 - Upgrade operator inbox cards

### File
- `app/operator/requests/page.tsx`

### Goal
Make each request card answer the operator’s triage questions at a glance.

### Add or improve directly on each card
- vendor response status
- vendor planned start date if present
- vendor expected completion date if present
- pricing state if present
- PDF bid presence/count if present
- clearer “unassigned / assigned / waiting on vendor / active / done” state cues
- stronger visual emphasis for urgency + stuck items

### Desired outcome
Without opening the detail page, the operator should be able to scan:
- what is urgent
- what has no vendor yet
- what is waiting on vendor action
- what already has dates
- what already has pricing/bid info
- what likely needs follow-up now

### Acceptance criteria
- inbox cards show materially more useful workflow state
- cards are easier to scan for actionability
- the operator can prioritize work faster without opening every ticket

---

## Micro-task 2 - Upgrade top-of-detail summary

### File
- `app/operator/requests/[id]/page.tsx`

### Goal
Make the top summary area do more decision-making work for the operator.

### Improve top-of-detail visibility for
- current request status
- urgency
- tenant
- assigned vendor
- vendor response status
- scheduled visit date
- vendor planned start date
- vendor expected completion date
- pricing state / amount if present
- PDF bid presence/count
- tenant visibility flag
- vendor visibility flag

### UX requirement
The most important maintenance-state information should be visible above the fold and grouped coherently.
Do not bury critical triage data deep in the page.

### Acceptance criteria
- operator can understand the current maintenance state quickly from the top summary area
- vendor/date/pricing/bid context is much clearer
- common next action feels more obvious

---

## Micro-task 3 - Add small triage-state presentation helpers

### Likely file
- helper in `lib/vendor-workflow.ts`, `lib/request-display.ts`, or a small shared UI helper if cleaner

### Goal
Turn raw workflow data into operator-friendly triage labels.

### Add helper logic for labels such as
- Unassigned
- Awaiting vendor response
- Vendor accepted
- Vendor declined
- Pricing submitted
- Bid uploaded
- Scheduled but missing expected completion
- In progress with no planned start date

### Rule
Do not over-engineer this.
A few sharp, useful labels are better than a taxonomy explosion.

### Acceptance criteria
- operator-facing state labels feel clear and practical
- labels help scanning rather than adding noise
- presentation logic stays coherent and reusable

---

## Constraints
- no scope creep into reporting
- no unrelated feature additions
- do not rewrite backend flows that already work unless needed for coherence
- reuse existing request/vendor fields before inventing new data
- optimize for operator clarity and speed

---

## Definition of done
This micro-ticket is done when:
- operator inbox is materially better at triage
- operator detail page shows the most important workflow state clearly at the top
- vendor/date/pricing/bid state is obvious instead of hidden
- the surface feels more like a command center and less like a thin list/detail CRUD app
