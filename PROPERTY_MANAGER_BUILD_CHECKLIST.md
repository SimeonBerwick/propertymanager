# Property Manager V1 - Build Checklist

## Current status
- Local V1 demo flow is built and smoke-tested
- Operator core is in place
- Tenant submission, status, and photo flow are in place
- Vendor dispatch, queue, and detail workflow are in place
- Attachment rendering QA fix landed
- Demo auth/access hardening landed
- Jeff cleared it as a local V1 demo/smoke flow
- Still not production-ready; main gaps are auth/authorization, polish, and hardening

## Phase 0 - Lock the package
- [x] Confirm V1 stays strictly focused on maintenance workflow
- [x] Confirm web-first, mobile-responsive approach
- [x] Confirm initial stack: Next.js, TypeScript, Postgres, Prisma, object storage
- [ ] Confirm Jeff is the required QA gate after first build

## Phase 1 - Product definition
- [x] Finalize MVP spec
- [x] Write user stories for operator, tenant, vendor
- [x] Define explicit acceptance criteria for each workflow
- [x] Freeze non-goals to avoid scope creep
- [x] Define screen inventory

## Phase 2 - Technical design
- [x] Design core data model
- [x] Define request lifecycle state machine
- [x] Define permissions by role
- [x] Define attachment/photo handling approach
- [x] Define visibility rules for internal notes vs tenant-visible updates
- [x] Define deployment/storage/auth path

## Phase 3 - App scaffold
- [x] Create project scaffold
- [x] Set up TypeScript, linting, formatting, env handling
- [x] Set up database and Prisma schema
- [x] Set up auth shell
- [x] Set up object storage integration for photos
- [x] Create base layout/navigation

## Phase 4 - Slice 1: operator-only core
- [x] Create property CRUD
- [x] Create unit CRUD
- [x] Create maintenance request CRUD
- [x] Create maintenance inbox list view
- [x] Create request detail page
- [x] Implement status changes with timeline events
- [x] Add internal notes

## Phase 5 - Slice 2: tenant intake
- [x] Create tenant submission form
- [x] Add category and urgency inputs
- [x] Add photo upload
- [x] Create request confirmation page
- [x] Route submitted requests into operator inbox as status=new

## Phase 6 - Slice 3: communication trail
- [x] Add tenant-visible updates
- [x] Add request timeline view
- [x] Ensure internal notes are hidden from tenant views
- [x] Add tenant request status page

## Phase 7 - Slice 4: vendor dispatch
- [x] Create vendor records
- [x] Add vendor assignment flow
- [x] Add scheduled date/time
- [x] Add dispatch notes
- [x] Show dispatch events in request timeline
- [x] Add vendor queue view
- [x] Add vendor detail/update workflow

## Phase 8 - Slice 5: reporting
- [ ] Open vs closed summary
- [ ] Aging buckets
- [ ] Repeat issue flags by unit/property

## Phase 9 - QA prep
- [x] Seed realistic test data
- [ ] Write Jeff QA checklist
- [x] Test operator flow end to end
- [x] Test tenant flow end to end
- [x] Test vendor assignment flow end to end
- [x] Test attachment handling
- [ ] Test permission boundaries and note visibility with production-grade auth

## Phase 10 - Sign-off gate
- [x] Jeff reviews first finished build
- [x] Capture defects and fix blockers
- [x] Approve or reject for next stage

## Next Sprint - Private Beta Candidate

### Sprint goal
Move Property Manager V1 from a convincing local demo to a controlled private beta candidate.

### Workstream 1 - Auth & role authorization
- [x] Add real sign-in flow
- [x] Define canonical roles: operator, tenant, vendor
- [ ] Enforce route-level permissions
- [ ] Enforce action-level permissions
- [ ] Prevent cross-account and cross-property data leakage
- [ ] Verify tenant-visible vs internal-only content boundaries
- [ ] Add unauthorized/expired-session handling

### Workstream 2 - Core workflow polish
- [ ] Tighten operator dashboard triage flow
- [ ] Make assignment flow faster and clearer
- [ ] Standardize status labels across all views
- [ ] Standardize allowed status transitions
- [ ] Improve vendor job queue clarity
- [ ] Improve vendor detail/update flow
- [ ] Improve tenant request submission UX
- [ ] Improve tenant status visibility across request lifecycle

### Workstream 3 - Reliability & safety
- [ ] Add stronger form validation
- [ ] Improve empty states
- [ ] Improve loading states
- [ ] Improve error states
- [ ] Add activity log/event history for key actions
- [ ] Add basic audit trail for request changes and dispatches
- [ ] Review obvious security gaps before private beta

### Workstream 4 - QA pass
- [ ] Test full end-to-end lifecycle: tenant submits request -> operator reviews -> operator assigns vendor -> vendor updates -> tenant sees progress
- [ ] Test mobile responsiveness for tenant-facing screens
- [ ] Test role boundaries across all primary routes
- [ ] Test note visibility boundaries
- [ ] Fix rough UI issues that damage demo confidence
- [ ] Prepare concise Jeff QA handoff checklist

### Suggested day-by-day breakdown

#### Day 1 - Auth foundation
- [ ] Choose auth approach and session model
- [ ] Implement login flow
- [ ] Create role model and seed users
- [ ] Protect primary routes

#### Day 2 - Permission enforcement
- [ ] Enforce action-level permissions
- [ ] Lock tenant/vendor data visibility
- [ ] Test cross-role access attempts
- [ ] Fix leakage risks

#### Day 3 - Workflow polish
- [ ] Tighten operator intake and assignment UX
- [ ] Improve vendor queue/detail flow
- [ ] Improve tenant submission and status UX
- [ ] Normalize statuses and transitions

#### Day 4 - Hardening
- [ ] Add validation and state handling
- [ ] Add activity log/audit basics
- [ ] Clean up top UI rough edges
- [ ] Run security sanity check

#### Day 5 - QA and sign-off prep
- [ ] Run end-to-end smoke tests for all three roles
- [ ] Run mobile pass on tenant views
- [ ] Write Jeff QA checklist
- [ ] Fix final blockers

## Sprint definition of done
- [ ] Operator, tenant, and vendor can all sign in
- [ ] Each role can access only what it should
- [ ] One maintenance request can move end-to-end without confusion
- [ ] No obvious trust-breaking bugs in normal use
- [ ] Stable enough for a private demo/beta without apology-driven narration

## Suggested owners
- Barry Bot: planning, implementation support, QA coordination
- Bob the Builder: feature implementation and workflow/UI fixes
- Jeff: QA gate and release readiness review
- Mario: product judgment on whether the flow is ready for private beta
