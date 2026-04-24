# Property Manager V1

Streamlined maintenance command center for small landlords.

## Product goal
Move maintenance coordination out of ad hoc texts, calls, and memory into one tracked workflow.

## Primary users
- small landlords
- owner-operators
- small property managers

## V1 scope
- tenant issue submission
- photo upload
- category + urgency
- landlord/operator inbox
- request status tracking
- vendor dispatch
- tenant updates / communication trail
- property / unit issue history
- basic reporting

## Product truth
This is not a full property management suite.
This is a maintenance workflow system with a narrow, useful wedge.

## Local operator runbook

From `apps/web`:

1. `npm install`
2. `cp .env.example .env` (or set real env vars)
3. `npm run setup:local`
4. `npm run dev:local`
5. Sign in with `landlord@example.com / changeme` unless overridden in env

## Storage + media truth
- New uploads are stored under `uploads/requests/` outside `public/`
- Media is served only through guarded routes:
  - landlord: `/api/landlord/media/[id]`
  - tenant: `/api/tenant/media/[id]`
- Legacy public-path support exists only for older rows that still point at `/uploads/requests/...`

## Browser test truth
- `npm run test` covers server actions and DB-backed workflow integration
- `npm run test:e2e` runs the Playwright browser workflow harness
- The browser harness requires Playwright Linux dependencies on the host/container
- CI runner: `.github/workflows/property-manager-playwright.yml`
- Container path: `apps/web/Dockerfile.playwright`

Example container run from repo root:
- `docker build -f PropertyManagerV1/apps/web/Dockerfile.playwright -t pm-playwright PropertyManagerV1/apps/web`
- `docker run --rm pm-playwright`

## Current execution status
Core workflow, integration coverage, and browser harness are in place. Remaining work is deployment hardening and running browser coverage in an environment with Playwright system libraries.
