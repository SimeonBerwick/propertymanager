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
- Auth is represented as a shell/navigation concern only in Sprint 1; real authentication and route protection are not implemented yet.

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
6. Run the app:
   ```bash
   npm run dev
   ```

## Suggested next build steps
- Wire operator dashboard and inbox pages to Prisma queries
- Add request detail page with timeline, internal notes, and tenant-visible updates
- Build tenant intake form actions and attachment upload pipeline
- Add vendor assignment UI and scheduling form flow
- Replace local SQLite with PostgreSQL when deployment path is chosen
- Implement real auth and permission-aware data access

## QA handoff reminder
Jeff is the explicit QA gate after the first functional build. Use the checklist in the root workspace docs plus seeded data to validate operator, tenant, and vendor flows.
