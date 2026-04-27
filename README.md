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

## Operator runbook

From `apps/web`:

1. `npm install`
2. `cp .env.example .env` (or set real env vars)
3. point `DATABASE_URL` at Postgres (Neon dev branch or local Postgres)
4. `npm run setup:local`
5. `npm run dev:local`
6. Sign in with `landlord@example.com / changeme` unless overridden in env

## Storage + media truth
- Current app code still resolves private uploads through guarded media routes:
  - landlord: `/api/landlord/media/[id]`
  - tenant: `/api/tenant/media/[id]`
- Hosted-production target is Cloudflare R2, not local disk
- Any remaining local-path semantics are migration work, not the intended end state

## Auth abuse resistance truth
- Landlord password login is rate-limited per email on the server
- Tenant OTP issuance is rate-limited per identity/purpose/channel
- OTP verification still has per-challenge attempt caps + lockout in the DB
- Current limiter is in-memory, so it is real for single-node/local deployments but not yet shared across multiple app instances

## Companion-app / packaging prep
For any companion-app or remote-node packaging path, treat these as required truth:
- use a real `SESSION_SECRET`
- run `npm run setup:local` or the equivalent migrate + seed/bootstrap flow before first login test
- keep uploaded media on private storage, never under `public/`
- run browser coverage through CI/container, not by assuming the target host already has Playwright libs
- if deployment becomes multi-node, replace the in-memory auth limiter with a shared store

## Browser test truth
- `npm run test` covers server actions and DB-backed workflow integration
- `npm run test:e2e` runs the Playwright browser workflow harness
- The browser harness now targets Postgres-backed execution, not SQLite files
- Primary CI runner: `.github/workflows/property-manager-playwright.yml` (GitHub Actions + Postgres service)
- Container path: `apps/web/Dockerfile.playwright` now assumes an external Postgres endpoint if used

## Gate status
- Jeff app gate: effectively passed at the application layer
- `npm test`: passing
- `npm run build`: passing
- Browser workflow harness: implemented
- Browser execution: still needs a Playwright-capable CI/container run for final proof

## Hosted production target
- Vercel for app/runtime
- Neon Postgres for relational data
- Cloudflare R2 for private media
- Upstash Redis for shared rate limiting / OTP throttling

## Next
- Finish the SQLite -> Postgres migration first
- Then move media to R2
- Then replace in-memory throttling with Upstash
- Then focus on deployment/runtime hardening, SLA policy, and recommendation quality
