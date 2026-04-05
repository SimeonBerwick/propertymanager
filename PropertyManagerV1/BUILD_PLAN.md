# Property Manager V1 - Build Plan

## 1. Current platform / stack truth
- Frontend: Next.js + TypeScript
- Backend: Next.js server actions + route handlers
- Database: SQLite via Prisma
- ORM: Prisma
- Auth: custom landlord session + tenant mobile session flow
- File storage: local file-backed uploads for issue photos in current build
- Notifications: provider-agnostic notification layer, email/log transport first
- Hosting reality: local/dev-first SQLite app today; move to a networked DB later if multi-node deployment matters

## 2. Mission control surfaces

### Landlord mission control
- dashboard inbox with request filters for language and currency
- queue cards for non-English and non-USD requests
- request detail page with status, comments, photos, preferences, triage tags, and vendor assignment
- property detail history
- unit detail history
- reports page with aging and repeat-issue visibility
- vendor directory with in-app create/edit capability management

### Tenant-facing surfaces
- public maintenance submission form
- tenant mobile portal dashboard
- tenant mobile request detail and status trail

## 3. Current workflow

### Request intake workflow
1. tenant submits a maintenance request from public submit or tenant mobile portal
2. request stores preferred language and preferred currency
3. system derives triage tags from those preferences
4. request lands in landlord dashboard inbox and queue views

### Landlord operating workflow
1. landlord reviews inbox / request detail
2. landlord sees handling preferences and recommended vendors
3. landlord can assign:
   - one-click best-match vendor
   - selected recommended vendor
   - manual vendor details
4. vendor assignment notification includes tenant preference context
5. landlord updates status and adds internal or tenant-visible comments
6. tenant sees updates in the portal trail

### Vendor management workflow
1. landlord opens vendor directory
2. creates or edits vendor records in-app
3. defines vendor capability set:
   - categories
   - supported languages
   - supported currencies
   - active/inactive state
4. recommendation engine uses that capability data for request matching

## 4. Current data model truth
- User
- Property
- Unit
- MaintenanceRequest
- MaintenancePhoto
- RequestComment
- StatusEvent
- TenantIdentity
- TenantInvite
- TenantOtpChallenge
- TenantSession
- Vendor

## 5. Important product rules
- preferred language is handling context, not urgency
- preferred currency is handling/billing context, not urgency
- SLA should be explicit policy, not inferred from language alone
- vendor recommendation should assist assignment, not hide manual override
- SQLite constraints matter: primitive list fields are stored via CSV-backed columns where needed in this build

## 6. Near-term risks
- landlord request panel can get cluttered as more controls are added
- CSV-backed capability storage is workable now but not ideal long-term
- local file upload/storage is not durable enough for serious production deployment
- notification transport is still simple and may need stronger delivery guarantees
- recommendation logic is heuristic, not capacity-aware or schedule-aware

## 7. Next build targets
- add explicit SLA policy model instead of defaulting everything to standard
- improve vendor recommendation with availability / category normalization / performance history
- add vendor deletion/deactivation safeguards and assignment history
- move media + database architecture to production-safe infrastructure when deployment scope expands
- productionize automation path:
  - set INTERNAL_AUTOMATION_SECRET in deployment config, not just local .env
  - add automation failure reporting / last-run visibility
  - run daily automation from a reliable scheduler against the internal automation endpoint

## 8. Success metric for this version
A landlord should be able to create properties and units, accept tenant maintenance requests, see communication preferences, assign a best-fit vendor directly from the request panel, manage vendor capabilities in-app, and track the request to completion without ambiguity.

## 9. Current ops wiring
- OpenClaw cron job created for daily automation sweep:
  - name: `PropertyManagerV1 daily automation sweep`
  - job id: `e6e7ca87-ab38-4c48-9df0-54609a58fa4c`
  - schedule: 8:00 AM America/Phoenix
- Internal automation endpoint:
  - `POST /api/internal/automation`
  - requires `Authorization: Bearer ${INTERNAL_AUTOMATION_SECRET}`
- Deployment requirement:
  - `INTERNAL_AUTOMATION_SECRET` must be set in runtime config / hosting secrets
  - do not rely on local ignored `.env` state for production
