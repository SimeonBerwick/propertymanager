# Property Manager V1 - Bob Execution Brief

## Mission
Focus exclusively on completing the Property Manager V1 app.

No side quests. No unrelated features. No random cleanup that does not help the sprint.
Your job is to help finish PM V1 so it becomes a controlled private beta candidate.

---

## Operating rule
Work the highest-leverage adjacent implementation slices that help Elon complete the build without duplicating architecture work.

Do not drift. Do not invent a new roadmap. Build the next practical slices that make the app more real, more trustworthy, and more reviewable.

---

## Priority order

### 1. Support real data isolation and leakage prevention
Help land the implementation details that make permissions real.

Focus on:
- tenant query scoping
- vendor assigned-work scoping
- operator scoping support
- direct-link / manipulated-request boundary cases
- backend/server enforcement support
- tenant-visible vs internal-only content separation

### 2. Improve operator triage and assignment workflow
Focus on:
- clearer inbox scanning
- clearer request detail actions
- fewer clicks for common operator tasks
- stronger assignment/update usability

### 3. Help normalize request statuses
Focus on:
- consistent status labels everywhere
- UI alignment with canonical lifecycle
- removing confusing or duplicate status language
- supporting blocked invalid transitions

### 4. Improve vendor workflow
Focus on:
- clearer queue readability
- stronger detail/update flow
- accept / decline action
- planned start date
- expected completion date
- pricing capture
- PDF bid upload support

### 5. Improve tenant workflow
Focus on:
- cleaner submission experience
- clearer photo upload feedback
- stronger confirmation state
- better progress/status readability

### 6. Reliability and audit basics
Focus on:
- validation improvements
- loading/error/empty states
- activity/event history visibility
- request/dispatch audit support

### 7. QA support prep
Focus on:
- fixing rough edges exposed by lifecycle testing
- mobile tenant polish
- role-boundary bug cleanup
- final implementation support before Jeff review

---

## Build standard
- UI restrictions are not enough; support backend/server enforcement
- tenant trust matters more than cosmetic polish
- reduce ambiguity and friction in normal use
- leave the app in a state Jeff can review without needing translation

---

## Anti-patterns to avoid
- polishing around broken permissions
- feature scatter
- adding things that do not help PM V1 completion
- shipping demo-looking shortcuts that fail real use

---

## Definition of success
Your work is successful if it helps make these statements true:
- each role can only access what it should
- one maintenance request can move through the full lifecycle cleanly
- vendor and tenant flows feel understandable and trustworthy
- the build has fewer trust-breaking bugs and fewer rough edges
- Jeff can QA the product as a serious private beta candidate
