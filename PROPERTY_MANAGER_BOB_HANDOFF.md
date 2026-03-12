# Property Manager V1 - Bob Handoff

Bob,

Your next sprint is already defined. Use these two files as your source of truth:
- `PROPERTY_MANAGER_BUILD_CHECKLIST.md`
- `PROPERTY_MANAGER_BOB_TICKETS.md`

## Mission
Move Property Manager V1 from a convincing local demo to a controlled private beta candidate.

## Priority order
1. PM-001 - Implement real sign-in flow
2. PM-002 - Add canonical role model
3. PM-003 - Enforce route-level authorization
4. PM-004 - Enforce action-level permissions
5. PM-005 - Prevent cross-account data leakage
6. PM-006 - Normalize request statuses
7. PM-007 - Polish operator triage flow
8. PM-008 - Polish vendor workflow
9. PM-009 - Polish tenant workflow
10. PM-010 - Reliability and audit basics
11. PM-011 - Mobile QA pass
12. PM-012 - End-to-end smoke pass

## Non-negotiables
- Do not treat auth as cosmetic
- Enforce permissions in backend/server logic, not just UI
- Tenant-visible and internal-only content boundaries must be real
- Optimize for coherent end-to-end workflow, not random feature scatter
- Leave the build in a state Jeff can review without needing a translator

## Definition of done
- Operator, tenant, and vendor can sign in
- Each role can access only what it should
- A maintenance request can move end-to-end cleanly
- No obvious trust-breaking bugs remain in normal use
- Build is stable enough for controlled private beta review

## QA target
Jeff will review using:
- `PROPERTY_MANAGER_JEFF_QA_CHECKLIST.md`

Build toward that checklist, not toward vibes.
