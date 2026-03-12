# Property Manager V1 - Bob the Builder Ticket List

## Purpose
This file breaks the next Property Manager V1 sprint into implementation-ready tickets for Bob the Builder.

Sprint goal: move the app from a convincing local demo to a controlled private beta candidate.

---

## PM-001 - Implement real sign-in flow

### Goal
Replace demo-grade access with a real login/logout and session flow.

### Tasks
- Add login screen/entry point
- Add logout action
- Implement session handling
- Protect authenticated routes
- Add expired-session handling

### Acceptance criteria
- Users can sign in successfully
- Users can sign out successfully
- Unauthenticated users cannot access protected pages
- Expired/invalid sessions are handled cleanly
- No role dashboard is reachable without authentication

---

## PM-002 - Add canonical role model

### Goal
Establish a clean, enforceable role system for operator, tenant, and vendor.

### Tasks
- Define role enum/model
- Seed or create demo users for each role
- Attach role to authenticated session/user record
- Ensure app can resolve current user role reliably

### Acceptance criteria
- System recognizes operator, tenant, and vendor as distinct roles
- Demo/test users exist for all three roles
- Authenticated sessions expose the correct role
- Role checks can be consumed across routes and server actions

---

## PM-003 - Enforce route-level authorization

### Goal
Ensure each role can only access the pages intended for that role.

### Tasks
- Restrict operator dashboard/routes to operators
- Restrict tenant routes to tenants
- Restrict vendor routes to vendors
- Add unauthorized state or redirect flow
- Verify role-specific navigation only shows permitted destinations

### Acceptance criteria
- Operators cannot access tenant-only or vendor-only dashboards unless explicitly allowed
- Tenants cannot access operator/vendor areas
- Vendors cannot access operator/tenant areas beyond approved surfaces
- Unauthorized access attempts redirect or fail gracefully
- Navigation does not expose inappropriate route entry points

---

## PM-004 - Enforce action-level permissions

### Goal
Ensure allowed actions are limited by role and request relationship.

### Tasks
- Limit vendor assignment to operators
- Limit job status updates to appropriate actors
- Limit tenant request viewing to own requests
- Keep internal notes operator-only
- Enforce permissions in both UI and backend/server layer

### Acceptance criteria
- Only operators can assign vendors
- Only allowed roles can change request states
- Tenants can only view their own requests
- Vendors can only update work assigned to them
- Internal notes never appear in tenant-visible surfaces
- UI restrictions are backed by server-side enforcement

---

## PM-005 - Prevent cross-account data leakage

### Goal
Make role and ownership scoping real, not cosmetic.

### Tasks
- Scope tenant queries to current tenant
- Scope vendor queries to assigned jobs only
- Scope operator data appropriately by organization/property access rules
- Review key endpoints/server actions for leakage risk
- Test direct URL access and manipulated request scenarios

### Acceptance criteria
- Tenants cannot access other tenants’ requests
- Vendors cannot access unassigned jobs through direct links or modified requests
- Unauthorized records are not returned from server-side queries
- Obvious cross-account leakage paths are blocked
- Boundary tests exist for common abuse cases

---

## PM-006 - Normalize request statuses

### Goal
Create one clean lifecycle model used consistently across the app.

### Tasks
- Define final status set
- Define allowed transitions
- Update UI labels to match canonical statuses
- Enforce allowed transitions in backend/server layer
- Ensure timeline/history reflects transitions clearly

### Acceptance criteria
- One canonical status model exists
- All views use the same labels
- Invalid state transitions are blocked
- Timeline/history entries align with actual state changes
- Operators, tenants, and vendors see status language that makes sense for their role

---

## PM-007 - Polish operator triage flow

### Goal
Make operator intake, review, assignment, and status handling faster and clearer.

### Tasks
- Improve inbox readability
- Make urgency/category/status easier to scan
- Reduce clicks for common actions
- Improve request detail layout
- Make assignment and update actions obvious

### Acceptance criteria
- Operator can triage a new request quickly without hunting for controls
- Inbox makes priority and current status easy to scan
- Request detail view supports common actions without confusion
- Common operator tasks require fewer/friction-reduced steps

---

## PM-008 - Polish vendor workflow

### Goal
Make the vendor queue and job update process feel clear and usable.

### Tasks
- Improve vendor queue readability
- Improve vendor job detail layout
- Clarify next action/status update controls
- Make scheduling/dispatch context easy to understand

### Acceptance criteria
- Vendor queue makes assigned work easy to scan
- Vendor can open a job and understand what to do next immediately
- Status updates are easy to submit and reflect back correctly
- Dispatch/scheduling details are visible and understandable

---

## PM-009 - Polish tenant workflow

### Goal
Make tenant submission and status tracking feel trustworthy and simple.

### Tasks
- Improve submission form UX
- Improve photo upload feedback
- Improve confirmation state
- Improve tenant status/progress visibility
- Make timeline/updates easier to understand

### Acceptance criteria
- Tenant can submit a request without confusion
- Photo upload gives clear feedback
- Confirmation page/state reassures the tenant the request was received
- Tenant can check status and understand current progress quickly
- Tenant-visible updates are readable and useful

---

## PM-010 - Reliability and audit basics

### Goal
Reduce trust-breaking app behavior and add basic operational traceability.

### Tasks
- Add stronger form validation
- Improve loading states
- Improve empty states
- Improve error states
- Add activity/event history for key actions
- Add basic audit visibility for request changes and dispatches

### Acceptance criteria
- Invalid submissions are handled clearly
- Users are not left in ambiguous loading/error states
- Empty states are understandable and useful
- Key request actions are logged in a visible history trail
- Operators can review major request and dispatch changes

---

## PM-011 - Mobile QA pass

### Goal
Ensure the tenant-facing experience works well enough on mobile for a private beta.

### Tasks
- Test tenant screens on mobile widths
- Fix layout issues
- Verify request submission flow on mobile
- Verify photo upload behavior on mobile
- Verify request status/tracking screens on mobile

### Acceptance criteria
- Tenant submission works on mobile without major friction
- Photo upload works on mobile
- Status/progress screens are readable on mobile
- No major layout breakage remains on tenant-critical paths

---

## PM-012 - End-to-end smoke pass

### Goal
Verify the full multi-role lifecycle works before Jeff reviews it.

### Tasks
- Run tenant -> operator -> vendor -> tenant lifecycle test
- Document blockers found during smoke pass
- Fix highest-confidence blockers
- Prepare concise QA handoff notes for Jeff

### Acceptance criteria
- A maintenance request can move end-to-end through the intended lifecycle
- Major blockers are documented clearly
- High-priority blockers found during smoke pass are fixed or explicitly noted
- Jeff receives a concise, reviewable handoff package

---

## Suggested build order
1. PM-001 - real sign-in flow
2. PM-002 - canonical role model
3. PM-003 - route-level authorization
4. PM-004 - action-level permissions
5. PM-005 - prevent cross-account leakage
6. PM-006 - normalize request statuses
7. PM-007 - operator triage polish
8. PM-008 - vendor workflow polish
9. PM-009 - tenant workflow polish
10. PM-010 - reliability and audit basics
11. PM-011 - mobile QA pass
12. PM-012 - end-to-end smoke pass

## Definition of success for Bob
- Auth is real enough to trust in a private beta
- Role boundaries are enforced for both routes and actions
- Normal request flow works across operator, tenant, and vendor roles
- UX is clean enough that a demo does not require narration to excuse rough edges
- Jeff can review a focused, coherent build instead of a pile of loose parts
