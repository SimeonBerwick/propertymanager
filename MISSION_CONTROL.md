# Mission Control

Updated: 2026-04-06
Owner: Sim

This file is the resume point for both active apps in this workspace.

---

## 1) PropertyManagerV1 (intended PM app)

**Path:** `/home/simeo/.openclaw/workspace-elon/PropertyManagerV1`

### What it is
Property Manager V1 is the actual PM app. It is a maintenance workflow system for small landlords / owner-operators.

### Structure
- app lives at: `PropertyManagerV1/apps/web`
- framework: Next.js 15
- runtime stack: React 19 + Prisma + iron-session
- local docs/status files exist at repo root:
  - `PROGRESS.md`
  - `MILESTONES.md`
  - `BUILD_PLAN.md`
  - `IMPLEMENTATION_BLUEPRINT.md`
  - `FIRST_BUILD_SLICE.md`
  - `JEFF_TEST_GATE.md`

### Current known state
From `PROGRESS.md`, milestones M1–M5 are marked complete and the app is described as ready for Jeff test gate walk-through.

Key completed areas already documented there:
- auth shell
- tenant issue submission
- photo upload
- landlord inbox / request operations
- email notification layer
- reports and unit history
- expanded seed data and QA gate

### New completed pass: billing request detail tightening
A real shipping pass was completed in `PropertyManagerV1/apps/web` on 2026-04-06.

What changed:
- request detail already had billing form, billing docs list, and billing activity trail
- added billing summary cards into request detail
- wired resend action end to end
- wired duplicate action end to end
- wired void action end to end
- expanded billing history typing and request-detail data mapping for BillingEvent-backed history
- added `void` billing status support in Prisma schema/client flow
- validated with successful production build

Commit:
- `9050035` — `Finish billing action wiring and request summary cards`

### Important truth
The request-detail billing surface is now materially closer to shippable.
The main remaining risk is not UI wiring, it is environment consistency.
If deployed environments do not apply the matching Prisma migration and regenerate client state, `void` status handling will drift and fail again.

### What should happen next in PM app
Before more feature work:
1. click-test billing flows on real seeded or staging requests
2. verify resend only on appropriate docs and confirm duplicate behavior is actually desired
3. apply the pending Prisma migration in each real environment
4. then return to broader operator-surface tightening

### Recommended next PM pass
Focus on maintenance workflow truth, not generic dashboard cosmetics:
1. click-test request-detail billing flow on real scenarios
2. decide whether duplicate should create a draft copy instead of preserving sent state
3. sharpen inbox / triage surface
4. reduce clicks for status + vendor + tenant update actions
5. verify mobile/operator responsiveness

### Git / repo note
The active git root for this work is inside `PropertyManagerV1/apps/web`, not the top-level `PropertyManagerV1` folder.

---

## 2) RealtorAid (worked on by mistake)

**Path:** `/home/simeo/.openclaw/workspace-elon/RealtorAid`

### What it is
A separate lead / CRM / follow-up application. This is **not** the intended PM app, but substantial work was done here during this session.

### What changed
The app was reshaped into a more serious operator surface:
- dashboard rebuilt into command-center style UI
- Today execution board added
- inline quick complete / reschedule flows added
- owner assignment added
- pipeline filters added
- interaction responsiveness improved
- compound backend work started for `log touch + set next step`

### Clean committed state
These commits exist in `RealtorAid`:
- `41bcf35` — `Sharpen PM app command surface`
- `305f634` — `Add PM execution board and quick actions`
- `b9a2854` — `Add assignment and inline PM controls`
- `0e4a95d` — `Tighten PM interactions and responsiveness`

### Current in-progress state after last clean commit
There is **uncommitted** work in `RealtorAid` for a compound workflow pass.

Implemented in-progress pieces:
- backend action for `logTouchAndSetNextStep`
- store support for completing current follow-up and scheduling the next one in one motion
- new components created for:
  - `touch-and-next-form.tsx`
  - `today-quick-log-form.tsx`

Not finished yet:
- compound-flow UI is **not fully wired** into lead detail and Today board
- current in-progress pass is **not yet built / validated / committed**

### Recommended next RealtorAid resume steps
1. wire `logTouchAndSetNextStep` into Today board fast path
2. wire `TouchAndNextForm` into lead detail as primary workflow
3. remove duplicate old paths where needed so the UI stays tight
4. run build
5. commit completed pass

### Strategic note
Do **not** confuse this app with PropertyManagerV1 again.
RealtorAid is CRM / lead follow-up.
PropertyManagerV1 is maintenance operations.
The useful cross-app transfer is interaction design and operating-surface discipline, not domain model reuse.

---

## 3) Routing correction log

### What went wrong
A billing follow-up request was initially checked against `RealtorAid` because that repo was explored first.
The actual billing target was `PropertyManagerV1/apps/web`.

### Corrective rule for next time
Before touching code for a named app or localhost target:
1. identify the exact project directory
2. confirm which app is serving the referenced port or flow
3. only then edit

---

## 4) Resume guidance

If resuming later, start with this sequence:
1. confirm whether the next task is for `PropertyManagerV1` or `RealtorAid`
2. if PM app: work in `PropertyManagerV1/apps/web`
3. if CRM app: work in `RealtorAid`
4. do not mix app-level mission, flows, or status
