# Property Manager V1 - Build Plan

## 1. Current platform / stack truth
- Frontend: Next.js + TypeScript on Vercel
- Backend: Next.js server actions + route handlers on Vercel
- Database target: Neon Postgres via Prisma
- ORM: Prisma
- Auth: custom landlord session + tenant mobile session flow
- File/media target: Cloudflare R2 for private request photos
- Rate-limit target: Upstash Redis for shared login / OTP throttling
- Notifications: provider-agnostic notification layer, SMTP/Twilio capable
- Current migration truth: the repo has been split into its own standalone GitHub repo, app/test/build gates are green, and the first hosted-production migration now in flight is SQLite -> Postgres

## 2. Mission control surfaces

### Landlord mission control
Current truth:
- dashboard inbox with queue cards, claim state, quick actions, and language/currency filters
- request detail page with status flow, comments, photos, preferences, triage tags, vendor assignment, and audit context
- property detail history
- unit detail history
- reports page with aging and repeat-issue visibility
- exceptions view and ops surface
- vendor directory with in-app create/edit capability management

### Tenant-facing surfaces
Current truth:
- public maintenance submission form
- tenant mobile portal dashboard
- tenant mobile request detail and status trail
- tenant-facing status/comment visibility where appropriate

## 3. Current workflow

### Request intake workflow
1. tenant submits a maintenance request from public submit or tenant mobile portal
2. request stores preferred language and preferred currency
3. system derives triage tags from those preferences
4. photos are currently stored through a private-storage abstraction that still needs to be migrated from local disk paths to R2 object keys
5. request lands in landlord dashboard inbox and queue views

### Landlord operating workflow
1. landlord logs in and lands in dashboard mission control
2. landlord can create a property and unit in-app
3. landlord reviews inbox / request detail
4. landlord updates status, assigns vendor details, and adds comments
5. request history is visible from request, property, and unit views
6. tenant sees allowed updates in the portal trail

### Vendor management workflow
1. landlord opens vendor directory
2. creates or edits vendor records in-app
3. defines vendor capability set:
   - categories
   - supported languages
   - supported currencies
   - active/inactive state
4. recommendation and dispatch flows use that capability data where applicable

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
- VendorDispatchEvent
- VendorDispatchLink
- RequestTender
- TenderInvite
- BillingDocument
- BillingEvent
- AuditLog

## 5. Important product rules
- preferred language is handling context, not urgency
- preferred currency is handling/billing context, not urgency
- SLA should be explicit policy, not inferred from language alone
- vendor recommendation should assist assignment, not hide manual override
- hosted production cannot rely on SQLite files, local uploads, or in-memory rate limits

## 6. Near-term risks
- landlord request panel can get cluttered as more controls are added
- CSV-backed capability storage is workable now but not ideal long-term
- local file upload/storage is not durable enough for Vercel-hosted production and must move to R2
- in-memory rate limiting is not durable enough for multi-instance deployment and must move to Redis
- notification transport is still simple and may need stronger delivery guarantees
- recommendation logic is heuristic, not capacity-aware or schedule-aware

## 7. Gate status and next targets

### Jeff gate status
- Core landlord workflow is implemented
- DB-backed integration gate is passing
- App build is passing
- Browser workflow path exists in CI
- Remaining work is no longer app-surface completeness; it is hosted-production substrate hardening

### Next targets
- complete SQLite -> Postgres migration for Neon
- move request media from local disk semantics to Cloudflare R2
- replace in-memory auth throttling with Upstash Redis
- productionize automation path on Vercel cron against the internal automation endpoint
- add production env validation and deployment runbook
- improve vendor recommendation with availability / category normalization / performance history

## 8. Success metric for this version
A landlord should be able to create properties and units, accept tenant maintenance requests, see communication preferences, assign a best-fit vendor directly from the request panel, manage vendor capabilities in-app, and track the request to completion without ambiguity, on a hosted stack that survives multi-user production reality.

## 9. Current ops wiring
- Standalone repo: `github.com/SimeonBerwick/propertymanager`
- Hosted target:
  - Vercel for app/runtime
  - Neon Postgres for relational data
  - Cloudflare R2 for media
  - Upstash Redis for shared rate limiting
- Internal automation endpoint:
  - `POST /api/internal/automation`
  - requires `Authorization: Bearer ${INTERNAL_AUTOMATION_SECRET}`
- Deployment requirements:
  - `DATABASE_URL` must point at Postgres, not SQLite
  - `SESSION_SECRET` must be production-grade
  - `INTERNAL_AUTOMATION_SECRET` must be set in runtime config / hosting secrets
  - do not rely on local ignored `.env` state for hosted production
