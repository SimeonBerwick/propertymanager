# Property Manager Smoke Test Checklist

Purpose: verify the app actually boots, connects to Postgres, seeds usable demo data, allows role-based login, and survives the main happy-path flows without obvious auth or org-scope breakage.

Baseline reference: `9e3afcd`

---

## Tester info

- Date:
- Tester:
- Branch / commit tested:
- Local app URL:
- Result summary: PASS / PASS WITH ISSUES / FAIL

---

## Stop rules

If any of these fail, stop and mark the run failed:
- [ ] `.env` missing or invalid
- [ ] Postgres connection fails
- [ ] `npm run db:setup` fails
- [ ] Seeded accounts missing
- [ ] App does not boot
- [ ] Login fails for any seeded role

Do not declare a soft pass if one of the stop rules fails.

---

## 1) Environment setup

### Required env file

Pass only if all are true:
- [ ] `.env` exists in repo root
- [ ] `.env` was created from `.env.example`
- [ ] `DATABASE_URL` is set to a real local Postgres dev DB
- [ ] `DATABASE_DIRECT_URL` is set

### Optional auth/integration test env

Required for auth sign-off (`npm run test:auth-runtime` and `npm run test:authz`):
- [ ] `TEST_DATABASE_URL` is set to a separate disposable Postgres DB
- [ ] `TEST_DATABASE_DIRECT_URL` is set
- [ ] Test DB is not the same DB as dev/app DB
- [ ] Prefer pooled/runtime URL for `TEST_DATABASE_URL` and direct/non-pooled URL for `TEST_DATABASE_DIRECT_URL`

### Fail conditions
- [ ] Any required env var is missing
- [ ] Test DB points at the same DB as the dev/app DB

### Notes / exact values used

```text
DATABASE_URL=
DATABASE_DIRECT_URL=
TEST_DATABASE_URL=
TEST_DATABASE_DIRECT_URL=
```

---

## 2) Database preparation

Expected setup:
- Dev/app DB exists
- Test DB exists separately if auth/integration tests will be run

Suggested names:
- `property_manager_dev`
- `property_manager_test`

Checks:
- [ ] Dev/app Postgres database created
- [ ] Test Postgres database created separately if needed
- [ ] Test DB does not point at dev DB

Notes:
```text
```

---

## 3) Install and initialize

Run:

```bash
npm install
npm run db:setup
npm run validate
```

### A. Install

Pass only if:
- [ ] `npm install` completed successfully
- [ ] No blocker-level install error occurred

Fail if:
- [ ] Any install error blocks bring-up

Exact output / errors:
```text
```

### B. Database init

Run:

```bash
npm run db:setup
```

Pass only if all are true:
- [ ] Prisma client generates
- [ ] Schema push succeeds
- [ ] Seed completes
- [ ] Demo credentials are printed

Fail if any are true:
- [ ] Postgres connection error
- [ ] Prisma push error
- [ ] Seed error
- [ ] No seeded credential output

Expected seeded credentials:
- Operator: `olivia@example.com / operator123`
- Tenant: `tina@example.com / tenant123`
- Vendor: `dispatch@aceplumbing.test / vendor123`

Exact output / errors:
```text
```

### C. Validation

Run:

```bash
npm run validate
```

Pass only if:
- [ ] Exit code is `0`
- [ ] No blocker-level validation error occurred

Fail if any typecheck, lint, invite, attachment, or phone test fails.

Important:
- `npm run validate` does **not** prove auth boundaries are good.
- Auth sign-off coverage lives in `npm run test:auth-runtime` plus `npm run test:authz` and requires a separate Postgres test DB.

Exact output / errors:
```text
```

---

## 4) Start the app

Run:

```bash
npm run dev
```

Pass only if all are true:
- [ ] Dev server starts successfully
- [ ] Local app URL is shown clearly in terminal output
- [ ] App loads in browser
- [ ] No immediate crash, blank screen, or fatal startup error
- [ ] Browser console has no blocker-level errors on first load
- [ ] Server logs have no blocker-level errors on first load

Expected local URL by default:
- likely `http://localhost:3000`

If it differs, record the exact URL.

Actual local URL used:
```text
```

Startup / runtime errors:
```text
```

---

## 5) Seeded smoke-test accounts

Expected seeded accounts:
- Operator: `olivia@example.com / operator123`
- Tenant: `tina@example.com / tenant123`
- Vendor: `dispatch@aceplumbing.test / vendor123`

### Seed account verification

Pass only if all are true:
- [ ] Operator account exists and can attempt login
- [ ] Tenant account exists and can attempt login
- [ ] Vendor account exists and can attempt login

If any account is missing, stop pretending this passed and record the exact failure.

Notes:
```text
```

---

## 6) Role login checks

### Operator login
Use:
- `olivia@example.com / operator123`

Pass only if:
- [ ] Login succeeds
- [ ] Authenticated operator area loads
- [ ] No redirect loop
- [ ] No fatal UI error

Fail if:
- [ ] Login rejected
- [ ] Session loops
- [ ] Lands on unauthenticated page
- [ ] Page crashes

Expected authenticated area / route reached:
```text
```

Notes / errors:
```text
```

### Tenant login
Use:
- `tina@example.com / tenant123`

Pass only if:
- [ ] Login succeeds
- [ ] Tenant-facing area loads
- [ ] No redirect loop
- [ ] No fatal UI error

Fail if:
- [ ] Login rejected
- [ ] Session loops
- [ ] Lands on unauthenticated page
- [ ] Page crashes

Expected authenticated area / route reached:
```text
```

Notes / errors:
```text
```

### Vendor login
Use:
- `dispatch@aceplumbing.test / vendor123`

Pass only if:
- [ ] Login succeeds
- [ ] Vendor-facing queue/detail area loads
- [ ] No redirect loop
- [ ] No fatal UI error

Fail if:
- [ ] Login rejected
- [ ] Session loops
- [ ] Lands on unauthenticated page
- [ ] Page crashes

Expected authenticated area / route reached:
```text
```

Notes / errors:
```text
```

---

## 7) Core smoke flows

## Operator flow

Pass only if operator can:
- [ ] View dashboard
- [ ] View properties
- [ ] View units
- [ ] View work orders / maintenance requests
- [ ] View tenants
- [ ] View vendors

Fail if:
- [ ] Any listed core section crashes
- [ ] List pages are blank due to obvious load failure
- [ ] Critical operator section is inaccessible

Conditional pass:
- [ ] If request creation UI exists, create one and confirm it persists after refresh

What happened:
```text
```

## Tenant flow

Pass only if tenant can:
- [ ] Access tenant request area
- [ ] Submit a maintenance request
- [ ] See the submitted request in status/history
- [ ] Refresh and still see it

Conditional pass:
- [ ] If photo upload is exposed in UI, upload works and persists

Fail if:
- [ ] Submission appears to succeed but request is missing after refresh
- [ ] Tenant can see another tenant’s request
- [ ] Tenant can reach operator area directly

What happened:
```text
```

## Vendor flow

Pass only if vendor can:
- [ ] Access assigned queue/list
- [ ] Open assigned request detail
- [ ] Update status if supported
- [ ] Add notes if supported
- [ ] Refresh and still see the changes

Fail if:
- [ ] Vendor sees unassigned or unrelated work
- [ ] Vendor can access operator admin area
- [ ] Updates appear to save but disappear

What happened:
```text
```

---

## 8) Auth and org-boundary smoke

This is the part people hand-wave. Do not hand-wave it.

### Tenant boundary
Attempt:
- [ ] Direct navigation to operator/admin page
- [ ] Direct navigation to another tenant request if discoverable

Pass only if:
- [ ] Tenant is redirected or denied from operator pages
- [ ] Tenant sees only their own relevant requests/data

### Vendor boundary
Attempt:
- [ ] Direct navigation to operator/admin page
- [ ] Access to unrelated or unassigned request

Pass only if:
- [ ] Vendor is redirected or denied from operator admin areas
- [ ] Vendor sees only assigned/vendor-facing items

### Operator org boundary
Pass only if:
- [ ] Operator can access expected operator resources
- [ ] No obvious cross-org leakage appears in visible data or direct-object pages

### Attachment visibility
Pass only if:
- [ ] Tenant-visible request evidence is limited appropriately
- [ ] Vendor/private PDF-style material is not exposed to tenant view
- [ ] Operator/vendor views still show what they are supposed to see
- [ ] Operator/vendor attachment access is routed through `/api/attachments/:id` rather than relying on raw storage paths in rendered HTML

### Internal notes visibility
Pass only if:
- [ ] Operator can see internal note/history intended for operator use
- [ ] Tenant and vendor cannot see internal-only notes

Exact boundary failures:
```text
```

---

## 9) Auth sign-off gate

Only run this if test DB vars are set correctly.

Run:

```bash
TEST_DATABASE_URL="postgresql://...pooled-or-runtime..." \
TEST_DATABASE_DIRECT_URL="postgresql://...direct..." \
npm run test:auth-runtime

TEST_DATABASE_URL="postgresql://...pooled-or-runtime..." \
TEST_DATABASE_DIRECT_URL="postgresql://...direct..." \
npm run test:authz
```

Pass only if:
- [ ] Tests used a dedicated Postgres test DB
- [ ] Tests did not point at dev DB
- [ ] No SQLite assumption appears
- [ ] `npm run test:auth-runtime` exited cleanly
- [ ] `npm run test:authz` exited cleanly

Fail if:
- [ ] Test DB equals dev DB
- [ ] Auth tests mutate the wrong database
- [ ] Runtime auth abuse-resistance fails
- [ ] Boundary/session/object-scope tests fail

Exact output / errors:
```text
```

---

## 10) Required result capture

### High-level outcomes
- [ ] App boots locally: YES
- [ ] Connects to Postgres: YES
- [ ] Operator login works: YES
- [ ] Tenant login works: YES
- [ ] Vendor login works: YES
- [ ] Tenant request creation works: YES
- [ ] Vendor queue/detail works: YES
- [ ] No obvious auth leak or org-scope bug: YES

### If any answer is NO, explain why

```text
```

### Console/server errors

Paste exact errors, not summaries:

```text
```

### Blocker severity

Mark all that apply:
- [ ] setup
- [ ] data
- [ ] auth
- [ ] UI
- [ ] workflow
- [ ] none

---

## 11) Final verdict

### Smoke test outcome
- [ ] PASS
- [ ] PASS WITH ISSUES
- [ ] FAIL

### Ship-readiness judgment
- [ ] Good enough for broader QA
- [ ] Good enough to continue companion-app packaging prep
- [ ] Not good yet

### One-paragraph blunt summary

```text
```

---

## Quick checklist

- [ ] `.env` created
- [ ] Dev DB connected
- [ ] Test DB connected separately if used
- [ ] `npm install`
- [ ] `npm run db:setup`
- [ ] `npm run validate`
- [ ] `npm run dev`
- [ ] Operator login works
- [ ] Tenant login works
- [ ] Vendor login works
- [ ] Tenant request flow works
- [ ] Vendor queue/detail works
- [ ] No obvious auth boundary break
- [ ] `npm run test:auth-runtime` passed against disposable Postgres test DB
- [ ] `npm run test:authz` passed against disposable Postgres test DB
- [ ] Tenant mobile shell/auth entry/request-create surfaces feel app-ready enough to keep packaging prep moving
