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

## Current state
M1, M2, M3, M4 all complete. Next is M5 (hardening for Jeff test gate).

## Next milestone
M5: permissions cleanup, validation pass, empty states audit, demo seed data, QA checklist.
