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
- [x] Standalone repo extraction + CI path repair
- [x] Dependency security baseline hardened

## M6 - Hosted production substrate
Status: In progress
- [x] Hosted target locked: Vercel + Neon + Cloudflare R2 + Upstash Redis
- [x] Standalone repo is live on GitHub
- [x] Production migration plan defined
- [ ] Prisma datasource moved from SQLite to Postgres
- [ ] Postgres baseline migration generated and validated against Neon-compatible flow
- [ ] Test / CI database harness updated for Postgres
- [ ] Media storage moved from local disk semantics to R2
- [ ] Shared rate limiter moved to Upstash Redis
- [ ] Production env contract documented in code/docs
- [ ] Vercel cron path wired for automation endpoint

## Gate status
Status: App gate passed; hosted production gate in progress
- [x] Core landlord workflow exists end-to-end
- [x] Unit/integration gate passes locally/in CI-compatible setup
- [x] Build passes locally
- [x] Browser gate has CI execution path
- [ ] Browser gate executed on the hosted Postgres-backed path
- [ ] Hosted production substrate completed

## Next milestone focus
- [ ] Finish Postgres migration first
- [ ] Then move media to R2
- [ ] Then replace in-memory throttling with Upstash
- [ ] Then wire hosted automation / deployment hardening
