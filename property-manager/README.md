# Property Manager V1

Maintenance-focused property management app built with Next.js, Prisma, and PostgreSQL.

## What is included
- Next.js App Router + TypeScript + Tailwind scaffold
- Prisma schema for the core MVP models:
  - Organization
  - AppUser
  - Property
  - Unit
  - Tenant
  - Vendor
  - MaintenanceRequest
  - RequestEvent
  - Attachment
- Seed script scaffold with realistic starter data
- Operator route stubs for dashboard, regions, properties, units, requests, vendors, and reporting
- Invite foundation for tenant/vendor onboarding with hashed tokens and operator-generated invite links
- Tenant placeholders for submission and request status
- Vendor placeholders for queue and assigned request detail
- `lib/permissions.ts` for role/action checks
- `lib/request-lifecycle.ts` for canonical status transitions
- Credential-based sign-in with seeded operator / tenant / vendor accounts and signed session cookies
- Explicit unauthorized and expired-session handling for protected pages
- Vendor-side progress updates on assigned jobs with server-side ownership checks
- Operator org-scoped sessions plus org-filtered operator reads/writes for regions, properties, units, requests, and dispatch flows

## Assumptions
- V1 remains maintenance-only and intentionally avoids broader property-management scope.
- Local development and production both use **PostgreSQL**. This repo is no longer SQLite-backed.
- File uploads are represented in schema and local-storage helpers; object-storage wiring is deferred to the next implementation slice.
- Auth is materially stronger than the original role picker, but it is still app-local auth rather than production-grade IAM / MFA / invite management.

## Local setup
1. Copy env example:
   ```bash
   cp .env.example .env
   ```
2. Create a local PostgreSQL database (example names):
   - `property_manager`
   - `property_manager_test` (optional, only for integration auth tests)
3. Update `.env` with working local values:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/property_manager"
   DATABASE_DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/property_manager"
   AUTH_SECRET="replace-with-a-long-random-string"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Generate Prisma client, push schema, and seed starter data:
   ```bash
   npm run db:setup
   ```
6. Run static validation before opening the UI:
   ```bash
   npm run validate
   ```
7. Start the app:
   ```bash
   npm run dev
   ```

## Seeded credentials
- Operator: `olivia@example.com` / `operator123`
- Tenant: `tina@example.com` / `tenant123`
- Vendor: `dispatch@aceplumbing.test` / `vendor123`

## Validation commands
### Fast local validation
Runs typecheck, lint, invite tests, attachment tests, and phone parsing tests:
```bash
npm run validate
```

### Full test pass
Includes auth runtime tests plus the auth-boundary integration test:
```bash
TEST_DATABASE_URL="postgresql://...pooled-or-runtime..." \
TEST_DATABASE_DIRECT_URL="postgresql://...direct..." \
npm test
```

### Auth boundary integration tests
Runs a production build/start cycle and verifies:
- tampered session rejection
- expired session redirects
- tenant/vendor/operator object scoping
- internal note visibility boundaries
- tenant-hidden / operator-visible / vendor-visible vendor bid PDFs via the attachment API route

```bash
TEST_DATABASE_URL="postgresql://...pooled-or-runtime..." \
TEST_DATABASE_DIRECT_URL="postgresql://...direct..." \
npm run test:authz
```

### Auth runtime abuse-resistance tests
Runs against a dedicated disposable PostgreSQL database and is the canonical sign-off path for auth abuse-resistance behavior:
```bash
TEST_DATABASE_URL="postgresql://...pooled-or-runtime..." \
TEST_DATABASE_DIRECT_URL="postgresql://...direct..." \
npm run test:auth-runtime
```

What this proves in runtime:
- bad password throttling
- success-path rate-limit reset
- invalid invite throttling
- valid invite behavior after bad hits on another token bucket
- OTP lockout
- OTP success after cooldown-path issuance
- invite reuse fail-closed
- OTP reuse fail-closed

### Auth-boundary integration test requirements
`npm run test:authz` builds the app, starts the production server, and exercises signed-session boundary checks against a **dedicated PostgreSQL test database**.

Set these env vars before running it:
```bash
export TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/property_manager_test"
export TEST_DATABASE_DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/property_manager_test"
npm run test:authz
```

Why separate DB vars? Because the test suite wipes and recreates data. Do **not** point it at your normal local development database.

## Recommended pre-test checklist
Before manual UI testing, make sure this sequence is green:
1. `.env` exists and points to a real local PostgreSQL database
2. `npm run db:setup`
3. `npm run validate`
4. `npm run dev`
5. Sign in with the seeded operator / tenant / vendor credentials
6. Verify protected-route redirects and basic request visibility
7. Verify `/mobile/auth` loads unauthenticated without redirect looping and that valid operator login lands on `/operator`

## Current mission-control lane
The active product lane is now **companion-app packaging prep**.

What is already verified:
- notification transport truth
- auth abuse resistance
- auth/session/object boundaries

What is now in progress:
- tenant-facing mobile shell polish
- companion-app-oriented auth entry UX
- tenant request experience polish for packaging readiness

## Suggested next build steps
- Tighten tenant request detail and timeline presentation into the same app-ready visual system
- Review invite/open-link/deep-link behavior before packaging/wrapper work
- Define the installability/PWA-wrapper path and required branding/assets
- Add invite revocation/status management UI instead of one-shot creation only
- Expand vendor updates into richer completion / parts / invoice-ready workflow if V1 needs it
- Add production-ready object storage wiring (R2/S3) before serious shared testing
- Move session storage, password reset, and audit logging to a fuller auth subsystem before production use

## QA handoff reminder
Jeff is the explicit QA gate after the first functional build. Use the checklist in the root workspace docs plus seeded data to validate operator, tenant, and vendor flows.
