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

- M3 email notifications complete:
  - `lib/notify.ts`: provider-agnostic notification layer. Default transport logs to stdout (zero config, safe for dev). Set `NOTIFY_TRANSPORT=smtp` + `SMTP_URL` for real email — works with any SMTP endpoint (Gmail, SendGrid, Resend, MailHog, etc.). `NOTIFY_FROM` is optional.
  - `buildNewRequestMessages()`: tenant confirmation + landlord alert on new submission.
  - `buildStatusChangedMessage()`: tenant notification when landlord transitions status.
  - `request-actions.ts` updated: notifications fire after successful DB write, before redirect. Fixed pre-existing bug where `redirect()` inside try/catch was caught as an error.
  - `request-detail-actions.ts` updated: `updateStatusFormAction` fetches tenant contact via `include` inside the transaction, then sends status-change notification. Revalidation happens outside the transaction.
  - `nodemailer` + `@types/nodemailer` added as dependencies.
  - `.env.example` updated with `NOTIFY_TRANSPORT`, `SMTP_URL`, `NOTIFY_FROM` documentation and SMTP URL examples (SendGrid, Resend, MailHog).
- TypeScript check: zero errors.

## 2026-03-22 (M4)
- `lib/data.ts`: added `getReportData()` (property stats, aging requests, repeat issue groups + seed fallback), `getUnitDetailData()` (unit + property + full request history with open/closed counts + seed fallback). New exported types: `PropertyStats`, `AgingRequest`, `RepeatIssueGroup`, `ReportData`, `UnitDetailData`.
- `app/reports/page.tsx` (new): Reports page at `/reports`. Three sections — summary stat row (total/open/closed), open vs closed by property table, open request aging table (color-coded: green <7d, amber 7–14d, red ≥14d), repeat issue flags table (units with 2+ requests in same category).
- `app/units/[id]/page.tsx` (new): Unit history page at `/units/[id]`. Shows tenant info, open/closed/total stat cards, full request history table with per-row age indicator.
- `app/properties/[id]/page.tsx`: Added open/closed/total stat cards row. Unit labels now link to `/units/[id]`. Empty-state copy on history section.
- `app/dashboard/page.tsx`: Added Done stat as 4th card; stat row changed from `cols-3` to `cols-4`.
- `app/layout.tsx`: Added "Reports" nav link.
- `app/globals.css`: Added `.grid.cols-4`, `.badge.age-fresh`, `.badge.age-warn`, `.badge.age-old`. Responsive breakpoint updated to include `cols-4`.
- `.next/types/link.d.ts`: Patched generated route types to include `/reports` and `/units/[id]` (will be regenerated properly on next build).
- TypeScript check: zero errors.

## 2026-03-22 (M5)
- **Seed data expanded**: Palm Court Fourplex now has all 4 units (added unit-2a/Maria Soto, unit-2b/Dev Patel, unit-2d/Vacant). Added req-1004 (Plumbing, in_progress) and req-1005 (Plumbing, new) — req-1005 shares unit+category with req-1001, triggering the repeat issue flag. req-1003 promoted to `done` with full event lifecycle (new→scheduled→in_progress→done). All requests now include `submittedByName/Email`. Event trail expanded to 10 events. Comments expanded to 6 with richer copy.
- **Empty states**: Dashboard inbox table shows a centred message when no requests exist. Properties list shows a standalone card when no properties are found. Properties page unit list falls back to "No units on record."
- **Validation**: `request-actions.ts` now enforces max-length on tenantName (120), tenantEmail (254), title (200), description (2000). `request-detail-actions.ts` enforces vendorName (120) and comment body (2000).
- **Login page**: Replaced internal dev note with user-facing copy.
- **Request detail**: Status event labels now display human-readable names (e.g. "In Progress" not `in_progress`). Comment visibility rendered as "Internal note" / "Tenant-facing" with colour-coded badge. Property name and unit label are now hyperlinked.
- **`.gitignore`**: Added `public/uploads/` — photo uploads are local disk and must not be committed.
- **QA checklist**: `JEFF_TEST_GATE.md` expanded with a 12-section step-by-step walk-through script covering every Jeff test gate criterion.
- TypeScript check: zero errors.

## Current state
All milestones M1–M5 are complete and the app-level Jeff gate is effectively passed. The remaining unclosed proof point is executing the Playwright browser workflow in a Playwright-capable environment and keeping that path green.

## 2026-04-24
- Added a DB-backed workflow integration test covering login, property/unit creation, request submission, dispatch, status flow, comments, and property/unit history views.
- Added Playwright browser harness: config, boot script, fixture, and end-to-end landlord workflow spec.
- Fixed login form wiring to use the real server action path.
- Hardened private media access: guarded media routes now only resolve `uploads/requests/...` and legacy `/uploads/requests/...` paths, rejecting unsafe paths.
- Added media tests for unsafe path rejection and aligned real-file tests with private upload storage.
- Deduplicated upload logic through shared helpers and fixed tenant mobile upload cleanup on DB failure.
- Added `setup:local` and `dev:local` scripts plus CI/container paths for Playwright execution in environments with browser libs.
- Added auth abuse resistance on highest-risk flows: landlord login rate limiting and tenant OTP issuance throttling. Current implementation is intentionally single-node/in-memory, which is appropriate for present packaging but will need a shared store for multi-instance deployment.

## 2026-04-27
- Split `PropertyManagerV1` into the standalone `propertymanager` repo and repaired standalone repo packaging/path drift.
- Added standalone root `.gitignore`, restored GitHub Actions workflow wiring, and verified fresh-clone integrity.
- Hardened dependency baseline: Next.js 15.5.15, nodemailer 8.0.7, Vitest 4.1.5, plus package overrides for safe Vite/PostCSS versions. `npm audit` now reports 0 vulnerabilities.
- Hosted production target is now explicitly locked to Vercel + Neon Postgres + Cloudflare R2 + Upstash Redis.
- Mission control / workflow docs updated to reflect hosted-production reality instead of local-only SQLite assumptions.
- Postgres migration started:
  - Prisma datasource moved off SQLite assumptions and CI workflow is being rewired around Postgres service infrastructure.
  - Test/e2e harness is being converted from file-backed DB URLs to Postgres-backed env URLs.
  - Remaining blocker for full runtime verification here is lack of a local Postgres service or Neon connection string in this environment.

## Next
- Finish the SQLite -> Postgres migration and verify it against a real Postgres instance.
- Then move request media to Cloudflare R2.
- Then replace in-memory rate limiting with Upstash Redis.
- Then harden hosted automation, env validation, and deployment runbooks.

## Known limitations / post-V1 work
- Local browser E2E still cannot run on this host without Playwright system libraries; use CI or the Playwright container path.
- Email notifications require `NOTIFY_TRANSPORT=smtp` + `SMTP_URL` env vars; dev uses log sink.
