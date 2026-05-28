# Mission Control

Updated: 2026-05-27
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
From `PROGRESS.md`, `MILESTONES.md`, and `README.md`, the PM app has moved past the old "build in progress" state.

Status board:
- Hosted Core: Validated
- Build: Validated
- Chrome: In progress
- Windows: In progress

What that actually means:
- milestones M1-M5 are complete
- hosted runtime validation was completed, with real production guardrails added for env/config correctness
- `npm run build` is documented green
- browser proof is validated with green GitHub Actions receipts:
  - `PropertyManager Playwright Browser Gate` run `26524888001`
  - `Property Manager Playwright` run `26524886949`
  - `Property Manager Hosted Regression` run `26526596478`
- hosted Vercel production now persists the required runtime env and the internal automation probe returns `200` after a plain production deploy
- hosted Neon production now has an explicit repo-native reconciliation path via `npm run hosted:db:reconcile`
- Chrome/Windows installability surface now exists in `apps/web` via manifest, service worker, and offline route, but explicit host-level install validation is not yet captured here

### Important truth
The core app is no longer the blocker.
The remaining risk is provider completeness and installability discipline:
- real SMTP credentials instead of the current placeholder transport URL
- real R2 and Upstash provider validation
- explicit installability validation on the target surfaces

### What should happen next in PM app
1. replace the placeholder hosted SMTP connection with a real provider credential and prove delivery
2. verify R2 and Upstash against `/ops`, not just env presence
3. click-test the Chrome install flow on a real target machine
4. validate the Windows install/use path instead of leaving it implicit

### Recommended next PM pass
Focus on provider truth and installability, not more feature drift:
1. finish real hosted provider credentials
2. confirm R2 / Upstash / SMTP are genuinely working
3. confirm Chrome/Windows installability on real devices
4. only then return to operator-surface tightening

### Git / repo note
The active git root for this work is the workspace root:
`/home/simeo/.openclaw/workspace-elon`

Operationally:
- app code lives in `PropertyManagerV1/apps/web`
- GitHub Actions workflows live in `.github/workflows/`
- do not assume `PropertyManagerV1` or `PropertyManagerV1/apps/web` is a separate git root

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
