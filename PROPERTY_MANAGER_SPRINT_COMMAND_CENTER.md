# Property Manager V1 - Sprint Command Center

## Purpose
This is the single control document for the next Property Manager V1 sprint.

Use it to understand:
- where the product stands now
- what this sprint is trying to accomplish
- what Bob should build next
- how Jeff will decide whether it passes

---

## 1. Current status

Property Manager V1 is currently at **strong local demo / smoke-flow** level.

### What is already built
- Operator core workflow
- Create/edit flows
- Tenant submission flow
- Tenant status flow
- Tenant photo upload flow
- Vendor dispatch workflow
- Vendor queue and detail workflow
- Attachment rendering QA fix
- Demo auth/access hardening

### Current quality level
- Good enough for local demos and smoke testing
- Not yet good enough for real production use
- Not yet ready for a trustworthy private beta without tighter controls

### Main gaps
- Real authentication
- Real role authorization
- Cross-account / cross-role data protection
- Workflow polish across all three roles
- Reliability and auditability improvements

---

## 2. Sprint goal

### Goal
Move Property Manager V1 from **convincing demo** to **controlled private beta candidate**.

### Success looks like
- Operator, tenant, and vendor can all sign in
- Each role can only access what it should
- One maintenance request can move end-to-end cleanly
- No obvious trust-breaking bugs remain in normal use
- Jeff can review the build as a coherent product, not a pile of half-finished parts

---

## 3. Primary workstreams

### Workstream A - Auth and role authorization
- Add real sign-in flow
- Add session handling
- Define canonical roles: operator, tenant, vendor
- Enforce route-level permissions
- Enforce action-level permissions
- Prevent cross-account and cross-role leakage

### Workstream B - Workflow polish
- Improve operator triage flow
- Improve vendor queue/detail/update flow
- Improve tenant submission and status experience
- Normalize request status labels and transitions

### Workstream C - Reliability and safety
- Stronger validation
- Better loading/error/empty states
- Activity/event history for major actions
- Basic audit trail for request and dispatch changes

### Workstream D - QA pass
- End-to-end lifecycle test
- Mobile tenant pass
- Role-boundary validation
- Jeff handoff prep

---

## 4. Bob the Builder implementation order

Bob should execute in this order:

1. **PM-001** - Implement real sign-in flow
2. **PM-002** - Add canonical role model
3. **PM-003** - Enforce route-level authorization
4. **PM-004** - Enforce action-level permissions
5. **PM-005** - Prevent cross-account data leakage
6. **PM-006** - Normalize request statuses
7. **PM-007** - Polish operator triage flow
8. **PM-008** - Polish vendor workflow
9. **PM-009** - Polish tenant workflow
10. **PM-010** - Reliability and audit basics
11. **PM-011** - Mobile QA pass
12. **PM-012** - End-to-end smoke pass

### Bob source files
- `PROPERTY_MANAGER_BUILD_CHECKLIST.md`
- `PROPERTY_MANAGER_BOB_TICKETS.md`
- `PROPERTY_MANAGER_BOB_HANDOFF.md`

---

## 5. Jeff QA gate

Jeff is the release-quality gate for this sprint.

### Jeff will review:
- Auth behavior
- Role boundaries
- Data isolation and leakage risks
- Full end-to-end lifecycle flow
- Status consistency
- Workflow clarity
- Reliability and UX states
- Mobile tenant experience
- Audit/history visibility

### Jeff source file
- `PROPERTY_MANAGER_JEFF_QA_CHECKLIST.md`

### Jeff approval standard
Jeff should only pass the sprint if:
- role boundaries are real
- end-to-end flow works cleanly
- tenant-facing experience feels trustworthy
- no obvious security or trust-breaking bugs appear in normal use
- the app can be shown privately without apology-driven narration

---

## 6. Suggested sprint cadence

### Day 1
- real sign-in flow
- session handling
- protected routes

### Day 2
- canonical role model
- route-level authorization
- action-level authorization foundations

### Day 3
- data isolation / leakage prevention
- status normalization
- backend enforcement cleanup

### Day 4
- operator workflow polish
- vendor workflow polish
- tenant workflow polish

### Day 5
- validation and UX states
- activity log / audit basics
- mobile pass
- end-to-end smoke pass
- Jeff handoff

---

## 7. Risks to watch

### Highest-risk failure modes
- Auth exists but permissions are only cosmetic
- Tenants can access data they should not see
- Vendors can access work not assigned to them
- Internal notes leak into tenant-visible surfaces
- Status model becomes inconsistent across views
- Demo looks fine, but normal use exposes brittle behavior

### Anti-pattern to avoid
Do not ship a “private beta” that is just a prettier demo with fake trust boundaries.

---

## 8. Definition of done

This sprint is done only if:
- [ ] Real login/logout exists
- [ ] Operator / tenant / vendor role model is enforced
- [ ] Protected routes are actually protected
- [ ] Action-level permissions are actually enforced
- [ ] Cross-account leakage risks are blocked
- [ ] Status model is canonical and consistent
- [ ] Operator flow feels fast and legible
- [ ] Vendor flow feels clear and usable
- [ ] Tenant flow feels simple and trustworthy
- [ ] Reliability/validation/error handling is materially improved
- [ ] Tenant-facing mobile flow works cleanly
- [ ] End-to-end smoke pass succeeds
- [ ] Jeff can review against a clear QA standard

---

## 9. Linked files

### Planning
- `PROPERTY_MANAGER_MVP_SPEC.md`
- `PROPERTY_MANAGER_BUILD_CHECKLIST.md`

### Execution
- `PROPERTY_MANAGER_BOB_TICKETS.md`
- `PROPERTY_MANAGER_BOB_HANDOFF.md`

### QA
- `PROPERTY_MANAGER_JEFF_QA_CHECKLIST.md`

---

## 10. Plain-English summary

Right now, Property Manager V1 is a solid local demo. This sprint is about making it trustworthy.

Bob’s job is to make auth, permissions, workflow, and reliability real.
Jeff’s job is to verify that the app behaves like a product someone could actually use in a controlled private beta.

If Bob builds to the ticket list and Jeff reviews to the checklist, the team stops operating on vibes and starts operating on a real gate.
