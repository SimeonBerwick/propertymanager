# Property Manager V1 - Build Checklist

## Phase 0 - Lock the package
- [ ] Confirm V1 stays strictly focused on maintenance workflow
- [ ] Confirm web-first, mobile-responsive approach
- [ ] Confirm initial stack: Next.js, TypeScript, Postgres, Prisma, object storage
- [ ] Confirm Jeff is the required QA gate after first build

## Phase 1 - Product definition
- [ ] Finalize MVP spec
- [ ] Write user stories for operator, tenant, vendor
- [ ] Define explicit acceptance criteria for each workflow
- [ ] Freeze non-goals to avoid scope creep
- [ ] Define screen inventory

## Phase 2 - Technical design
- [ ] Design core data model
- [ ] Define request lifecycle state machine
- [ ] Define permissions by role
- [ ] Define attachment/photo handling approach
- [ ] Define visibility rules for internal notes vs tenant-visible updates
- [ ] Define deployment/storage/auth path

## Phase 3 - App scaffold
- [ ] Create project scaffold
- [ ] Set up TypeScript, linting, formatting, env handling
- [ ] Set up database and Prisma schema
- [ ] Set up auth shell
- [ ] Set up object storage integration for photos
- [ ] Create base layout/navigation

## Phase 4 - Slice 1: operator-only core
- [ ] Create property CRUD
- [ ] Create unit CRUD
- [ ] Create maintenance request CRUD
- [ ] Create maintenance inbox list view
- [ ] Create request detail page
- [ ] Implement status changes with timeline events
- [ ] Add internal notes

## Phase 5 - Slice 2: tenant intake
- [ ] Create tenant submission form
- [ ] Add category and urgency inputs
- [ ] Add photo upload
- [ ] Create request confirmation page
- [ ] Route submitted requests into operator inbox as status=new

## Phase 6 - Slice 3: communication trail
- [ ] Add tenant-visible updates
- [ ] Add request timeline view
- [ ] Ensure internal notes are hidden from tenant views
- [ ] Add tenant request status page

## Phase 7 - Slice 4: vendor dispatch
- [ ] Create vendor records
- [ ] Add vendor assignment flow
- [ ] Add scheduled date/time
- [ ] Add dispatch notes
- [ ] Show dispatch events in request timeline

## Phase 8 - Slice 5: reporting
- [ ] Open vs closed summary
- [ ] Aging buckets
- [ ] Repeat issue flags by unit/property

## Phase 9 - QA prep
- [ ] Seed realistic test data
- [ ] Write Jeff QA checklist
- [ ] Test operator flow end to end
- [ ] Test tenant flow end to end
- [ ] Test vendor assignment flow end to end
- [ ] Test attachment handling
- [ ] Test permission boundaries and note visibility

## Phase 10 - Sign-off gate
- [ ] Jeff reviews first finished build
- [ ] Capture defects and fix blockers
- [ ] Approve or reject for next stage

## Immediate next 10 tasks
1. Finalize `PROPERTY_MANAGER_MVP_SPEC.md`
2. Choose and lock stack/deployment
3. Design Prisma data model
4. Map request lifecycle transitions
5. Define permissions matrix
6. Draft low-fi wireframes / screen map
7. Scaffold the app repo
8. Build operator-only inbox/request core
9. Build tenant submission with photo upload
10. Write Jeff’s QA checklist before handoff
