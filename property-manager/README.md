# Property Manager V1

Initial Sprint 1 scaffold for a maintenance-focused property management app.

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
- Operator route stubs for dashboard, properties, units, requests, vendors, and reporting
- Tenant placeholders for submission and request status
- Vendor placeholders for queue and assigned request detail
- `lib/permissions.ts` for role/action checks
- `lib/request-lifecycle.ts` for canonical status transitions
- Credential-based sign-in with seeded operator / tenant / vendor accounts and signed session cookies
- Explicit unauthorized and expired-session handling for protected pages
- Vendor-side progress updates on assigned jobs with server-side ownership checks
- Operator org-scoped sessions plus org-filtered operator reads/writes for properties, units, requests, and dispatch flows

## Assumptions
- V1 remains maintenance-only and intentionally avoids broader property-management scope.
- The long-term target database is PostgreSQL per spec, but this scaffold uses SQLite locally so the repo can boot quickly and seed without external infrastructure.
- File uploads are represented in schema and placeholders only; object storage wiring is deferred to the next implementation slice.
- Auth is now materially stronger than the original role picker, but it is still app-local auth rather than production-grade IAM / MFA / invite management.

## Local setup
1. Copy env example:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
4. Create the local database and apply schema:
   ```bash
   npx prisma db push
   ```
5. Seed starter data:
   ```bash
   npm run prisma:seed
   ```
6. Set an auth secret in `.env` (required for signed session cookies):
   ```bash
   AUTH_SECRET="replace-with-a-long-random-string"
   ```
7. Run the app:
   ```bash
   npm run dev
   ```

## Seeded credentials
- Operator: `olivia@example.com` / `operator123`
- Tenant: `tina@example.com` / `tenant123`
- Vendor: `dispatch@aceplumbing.test` / `vendor123`

## Auth boundary regression tests
- Run `npm run test:authz` to boot the built app against a disposable SQLite database and verify:
  - tampered cookie rejection
  - expired session redirect handling
  - tenant direct-object access denial
  - vendor unassigned-request denial
  - internal-note non-leakage to tenant/vendor surfaces

## Suggested next build steps
- Extend org scoping beyond the current operator hardening slice into memberships, invite flows, and eventually row-level posture suitable for PostgreSQL
- Add deeper cross-account leakage tests for manipulated list queries and cross-org write attempts
- Expand vendor updates into richer completion / parts / invoice-ready workflow if V1 needs it
- Replace local SQLite with PostgreSQL when deployment path is chosen
- Move session storage, password reset, invite flows, and audit logging to a fuller auth subsystem before production use

## QA handoff reminder
Jeff is the explicit QA gate after the first functional build. Use the checklist in the root workspace docs plus seeded data to validate operator, tenant, and vendor flows.
