# Property Manager V1 - Next Coding Task

## Task
Upgrade the operator maintenance inbox and request detail into a real triage surface.

## Why this is the next best task
Auth boundaries and vendor workflow plumbing are already materially in place.
The current highest-leverage gap is that the operator triage surface still underuses the data already available in the app.

Right now, the operator can access the records, but the inbox/detail flow does not yet feel like a true maintenance command center.
The next move is to make operator review, prioritization, assignment, and follow-up faster and clearer.

## Objective
Improve operator clarity and speed without expanding scope.

This task should make the operator experience better at:
- spotting what needs attention fast
- understanding vendor state at a glance
- seeing timeline-critical dates without drilling unnecessarily
- understanding whether pricing/bids exist
- moving from triage to assignment/update with less friction

## Required deliverables

### 1. Improve operator inbox cards (`/operator/requests`)
Expose more actionable triage information directly in the list view.

Add or improve visibility for:
- vendor response status
- planned start date
- expected completion date
- pricing state
- whether a PDF bid exists
- stronger visual urgency/status signaling
- clearer “unassigned / awaiting vendor / in progress / done” scanning cues

The inbox should help the operator answer quickly:
- what is urgent?
- what is stuck?
- what is waiting on a vendor?
- what already has dates/pricing/bids?
- what needs operator attention now?

### 2. Improve operator request detail (`/operator/requests/[id]`)
Make the detail page more useful as a decision surface.

Improve:
- vendor state visibility
- dispatch state visibility
- planned vs expected completion clarity
- pricing / bid summary visibility
- clearer placement of common next actions
- stronger readability around status, urgency, and current owner/state

### 3. Reduce triage friction
Without changing scope, reduce obvious operator friction.

Examples:
- make assignment/update controls easier to find
- make important metadata more visible above the fold
- reduce ambiguity around current vendor state
- reduce unnecessary mental overhead in deciding next action

## Constraints
- Do not expand product scope beyond Property Manager V1
- Do not start reporting work
- Do not chase cosmetic polish that does not improve operator decision-making
- Reuse existing backend/vendor workflow data wherever possible
- Prefer coherent triage improvements over one-off UI tweaks

## Likely files to inspect/edit
- `app/operator/requests/page.tsx`
- `app/operator/requests/[id]/page.tsx`
- `app/operator/requests/[id]/actions.ts`
- `lib/vendor-workflow.ts`
- `lib/request-display.ts`
- any operator UI/shared presentation components that help list/detail readability

## Acceptance criteria
- operator inbox exposes richer triage signals without opening every ticket
- operator detail page makes vendor state, dates, pricing, and bid status much easier to understand
- common next actions are easier to spot and use
- triage flow feels more like a maintenance command center and less like a thin database viewer
- no scope creep into unrelated features

## Definition of success
When an operator opens the inbox, they should be able to decide what needs attention next with much less hunting, less ambiguity, and fewer clicks.
