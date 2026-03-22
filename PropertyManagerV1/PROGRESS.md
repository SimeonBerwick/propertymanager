# Progress Log

## 2026-03-11
- Property Manager V1 approved for full build
- Product framing documented
- Build plan documented
- Milestone tracker created
- First build slice defined
- Implementation blueprint created
- Jeff first-build test gate defined

## 2026-03-21
- Refactored `lib/data.ts`: all five data functions now attempt real Prisma queries first, fall back to seed arrays on any DB error (connection refused, schema not migrated, etc). App is not broken when DATABASE_URL is unset.
- Removed direct `seed-data` import from `app/properties/page.tsx`; units now come through `getAllUnits()` in the data layer.
- Added `prisma/seed.ts`: idempotent seed script that writes seed-data into Postgres via upserts. Run with `npm run prisma:seed` or `npx prisma db seed`.
- Added `tsx` devDependency and `"prisma": { "seed": "..." }` config to package.json.
- Prisma client generated successfully (v6.9.0). TypeScript check: zero errors.

- Auth shell added (iron-session v8, password-based): `lib/session.ts`, `lib/auth-actions.ts`, `app/login/`, `middleware.ts`.
- Next.js upgraded 15.2.0 → 15.5.14 to close middleware auth-bypass CVE (GHSA-f82v-jwr5-mffw). 0 audit vulnerabilities.
- TypeScript check: zero errors.

## Current state
M1 complete. Auth shell protects all landlord routes via Next.js middleware + iron-session. Login page at `/login`. Session cleared via Sign out form action. No DB required — login uses `LANDLORD_PASSWORD` env var (dev default: `changeme`). All routes still fall back to seed data when no Postgres is configured.

## Next milestone
M2: run first migration against a live Postgres instance, seed it, then begin tenant issue submission (submission form, request creation, confirmation flow).
