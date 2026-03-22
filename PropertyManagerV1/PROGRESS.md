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

## 2026-03-22
- M2 complete: `/submit` tenant issue form with property/unit cascade select, category, urgency, photo upload (up to 5 × 5 MB), and confirmation screen.
- `lib/request-actions.ts`: `submitMaintenanceRequest` server action — validates, saves photos to `public/uploads/requests/`, creates DB request + photo rows + initial status event + auto-comment in a Prisma transaction. Falls back to a clear error message when no DB is configured.
- M3 request operations implemented (email notifications deferred):
  - `lib/request-detail-actions.ts`: three server actions — `updateStatusFormAction` (transitions + appends StatusEvent), `updateVendorFormAction`, `addCommentFormAction`. Each calls `revalidatePath` so the page refreshes server-side.
  - `app/requests/[id]/status-vendor-panel.tsx`: client component with status dropdown + vendor name field, both with inline success/error feedback.
  - `app/requests/[id]/add-comment-form.tsx`: client component that clears textarea on success via `useRef` + `useEffect`.
  - `app/requests/[id]/page.tsx`: wired in both new client components; empty-state fallback for timeline and comments.
- TypeScript check: zero errors.

## Current state
M1 + M2 complete. M3 mostly complete — status transitions, vendor assignment, and comment trail are all live on the request detail page. Email notifications are the only remaining M3 item (deferred; requires SMTP config decision from Sim). All landlord write operations require a real Postgres DB and surface a clear error if none is connected.

## Next milestone
M3 email notifications (needs Sim input on SMTP approach), then M4 history/reporting.
