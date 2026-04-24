# Property Manager V1 - Milestones

## M1 - App skeleton + core maintenance model
Status: Complete
- [x] Product direction locked
- [x] Build architecture defined
- [x] Milestone plan created
- [x] App scaffold
- [x] Auth shell (iron-session, password-based, middleware-enforced)
- [x] Property/unit schema
- [x] Maintenance request schema
- [x] Dashboard shell
- [x] Property detail route scaffold
- [x] Request detail route scaffold
- [x] Prisma-backed data layer (with seed fallback)
- [x] DB seed script

## M2 - Tenant issue submission
Status: Complete
- [x] Submission form
- [x] Category + urgency
- [x] Photo upload
- [x] Request creation
- [x] Confirmation flow

## M3 - Request operations
Status: Complete
- [x] Request detail page
- [x] Status transitions
- [x] Vendor assignment
- [x] Comment trail
- [x] Email notifications (provider-agnostic; log sink in dev, SMTP in prod)

## M4 - History + reporting
Status: Complete
- [x] Property history
- [x] Unit history
- [x] Open vs closed counts
- [x] Aging view
- [x] Repeat issue flags

## M5 - Hardening for Jeff test gate
Status: Complete
- [x] Permissions cleanup
- [x] Validation pass
- [x] Empty states
- [x] Demo seed data
- [x] QA checklist
- [x] DB-backed workflow integration test
- [x] Playwright browser harness
- [x] Private media route hardening
- [x] Local ops flow cleanup

## Gate status
Status: App gate passed
- [x] Core landlord workflow exists end-to-end
- [x] Unit/integration gate passes locally
- [x] Build passes locally
- [x] Browser gate has CI/container execution path
- [ ] Browser gate executed in a Playwright-capable environment

## Next milestone focus
- [ ] Run Playwright gate in CI/container and collect the first green browser artifact
- [ ] Deployment/runtime hardening
- [ ] SLA policy and vendor recommendation improvements
