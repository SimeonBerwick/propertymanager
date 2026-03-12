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

## Assumptions
- V1 remains maintenance-only and intentionally avoids broader property-management scope.
- The long-term target database is PostgreSQL per spec, but this scaffold uses SQLite locally so the repo can boot quickly and seed without external infrastructure.
- File uploads are represented in schema and placeholders only; object storage wiring is deferred to the next implementation slice.
- The demo now includes a simple signed-cookie auth layer with role switcher, route guards, and tenant/vendor ownership checks. It is practical demo security, not production IAM.

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

## Suggested next build steps
- Wire operator dashboard and inbox pages to Prisma queries
- Add request detail page with timeline, internal notes, and tenant-visible updates
- Build tenant intake form actions and attachment upload pipeline
- Add vendor assignment UI and scheduling form flow
- Replace local SQLite with PostgreSQL when deployment path is chosen
- Replace demo role-picker sign-in with real user identity verification / passwords or magic links
- Add per-request share tokens or invite links if tenants/vendors need deep links without a pre-existing session
- Move session storage and audit logging to a proper auth subsystem before production use

## QA handoff reminder
Jeff is the explicit QA gate after the first functional build. Use the checklist in the root workspace docs plus seeded data to validate operator, tenant, and vendor flows.
