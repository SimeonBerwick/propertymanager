# Property Manager V1 - Elon Execution Brief

## Mission
Focus exclusively on completing the Property Manager V1 app.

Do not chase side quests, platform work, reporting expansions, or unrelated cleanup.
The only objective is to move Property Manager V1 from a strong local demo to a controlled private beta candidate.

---

## What matters most
Property Manager V1 already has the core demo slices.
The main remaining problem is not feature imagination.
The main remaining problem is trust, boundary enforcement, and coherent end-to-end workflow quality.

Your job is to make the app real enough to trust in a controlled private beta.

---

## Priority order

### 1. Finish real data isolation and trust boundaries
This is the highest-priority work.

Deliver:
- tenant can only see their own requests
- vendor can only see assigned work
- operator data is scoped appropriately
- cross-account leakage is blocked
- cross-property leakage is blocked where applicable
- route guards and backend/server enforcement agree
- internal-only content never leaks into tenant-visible surfaces

Standard:
- permissions must be real in backend/server logic, not cosmetic in UI
- direct URL access and manipulated request scenarios should not break boundaries

### 2. Tighten operator workflow
Deliver:
- better triage readability
- faster assignment/update flow
- clearer urgency/status scanning
- less friction in common operator actions

### 3. Normalize the status model
Deliver:
- one canonical request status set
- one allowed transition model
- same labels across operator, tenant, and vendor surfaces
- invalid transitions blocked in backend/server logic

### 4. Improve vendor workflow
Deliver:
- clearer vendor queue/detail flow
- vendor accept / decline action
- planned start date capture
- expected completion date capture
- pricing capture
- PDF bid upload attached to the maintenance ticket

### 5. Improve tenant workflow
Deliver:
- better submission UX
- clearer request confirmation state
- clearer lifecycle visibility and progress tracking

### 6. Add reliability and audit basics
Deliver:
- stronger validation
- better loading/error/empty states
- activity log for key actions
- basic audit trail for request and dispatch changes

### 7. Prepare Jeff QA handoff
Deliver:
- full end-to-end lifecycle works cleanly
- role-boundary validation is ready
- tenant mobile pass is ready
- build can be reviewed without apology-driven narration

---

## How to operate
- Own the build sequence and integration logic
- Keep Bob focused on adjacent implementation slices that accelerate completion
- Optimize for a coherent product, not scattered progress
- Choose the next slice based on risk reduction, not novelty
- Report concrete progress, blockers, and decisions only

---

## Anti-patterns to avoid
- fake auth or cosmetic permissions
- random polish before trust boundaries are real
- reporting or expansion work before core lifecycle is trustworthy
- demo theater that hides real leakage or brittle workflows

---

## Definition of success
Property Manager V1 is ready for controlled private beta review when:
- operator, tenant, and vendor can sign in
- each role can access only what it should
- one maintenance request moves end-to-end cleanly
- no obvious trust-breaking bugs remain in normal use
- Jeff can review it as a coherent product
