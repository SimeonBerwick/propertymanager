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

## 1) Environment setup

### Required env file

- [ ] `.env` exists in repo root
- [ ] `.env` was created from `.env.example`
- [ ] `DATABASE_URL` is set to a real local Postgres DB
- [ ] `DATABASE_DIRECT_URL` is set

### Optional auth/integration test env

- [ ] `TEST_DATABASE_URL` is set to a separate disposable Postgres DB
- [ ] `TEST_DATABASE_DIRECT_URL` is set
- [ ] Test DB is not the same DB as dev/app DB

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
- [ ] Test Postgres database created separately
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

### Pass/fail checks

#### npm install
- [ ] `npm install` completed successfully
- [ ] No blocker-level install error occurred

Exact output / errors:
```text
```

#### db setup
- [ ] `npm run db:setup` completed successfully
- [ ] Migrations completed
- [ ] Seed completed
- [ ] No Postgres connection error
- [ ] No schema drift / migration failure

Exact output / errors:
```text
```

#### validate
- [ ] `npm run validate` exited 0
- [ ] No blocker-level validation error occurred

Exact output / errors:
```text
```

---

## 4) Start the app

Run:

```bash
npm run dev
```

### Pass/fail checks

- [ ] Dev server starts successfully
- [ ] Local app URL is shown clearly in terminal output
- [ ] App loads in browser
- [ ] No immediate crash, blank screen, or fatal startup error
- [ ] Browser console has no obvious blocker-level errors on first load
- [ ] Server logs have no obvious blocker-level errors on first load

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
- [ ] Operator login succeeds
- [ ] Operator lands on expected authenticated area
- [ ] No auth loop / redirect loop
- [ ] No crash after login

Notes / errors:
```text
```

### Tenant login
- [ ] Tenant login succeeds
- [ ] Tenant lands on expected authenticated area
- [ ] No auth loop / redirect loop
- [ ] No crash after login

Notes / errors:
```text
```

### Vendor login
- [ ] Vendor login succeeds
- [ ] Vendor lands on expected authenticated area
- [ ] No auth loop / redirect loop
- [ ] No crash after login

Notes / errors:
```text
```

---

## 7) Core smoke flows

## Operator flow

Minimum pass bar:
- [ ] Dashboard loads
- [ ] No obvious broken blank states
- [ ] Can view properties
- [ ] Can view units
- [ ] Can view work orders / maintenance items
- [ ] Can view tenants
- [ ] Can view vendors
- [ ] Operator-only actions are visible where expected

If maintenance/work-order creation exists in the current build:
- [ ] Operator can create a maintenance/work-order item successfully
- [ ] Created item persists after refresh

What happened:
```text
```

## Tenant flow

Minimum pass bar:
- [ ] Tenant can access tenant-facing dashboard/page
- [ ] Tenant can submit a maintenance request
- [ ] Submitted request appears in tenant-visible status/history
- [ ] Request survives refresh

If photo upload is enabled in the current build:
- [ ] Tenant can attach/upload photo successfully

What happened:
```text
```

## Vendor flow

Minimum pass bar:
- [ ] Vendor can access vendor-facing queue/list
- [ ] Vendor can open assigned item detail
- [ ] Vendor can update status if supported
- [ ] Vendor can add notes if supported
- [ ] Updates persist after refresh

What happened:
```text
```

---

## 8) Auth and org-boundary smoke

This is the part people hand-wave. Do not hand-wave it.

### Operator boundaries
- [ ] Operator can access operator/admin areas expected for that role

### Tenant boundaries
- [ ] Tenant cannot access operator/admin pages
- [ ] Tenant only sees their own relevant requests/data
- [ ] Tenant direct URL guess to protected operator page redirects or denies cleanly

### Vendor boundaries
- [ ] Vendor cannot access operator admin areas
- [ ] Vendor only sees assigned/vendor-facing items
- [ ] Vendor cannot see unrelated org or tenant data
- [ ] Vendor direct URL guess to protected page redirects or denies cleanly

### Cross-role checks
- [ ] Data created by one role appears only where intended
- [ ] No obvious org-scope leak
- [ ] No obvious authz failure

Exact boundary failures:
```text
```

---

## 9) Optional auth/integration test

Only run this if test DB vars are set correctly.

Run:

```bash
npm run test:authz
```

Pass/fail checks:
- [ ] Test used dedicated Postgres test DB
- [ ] Test did not point at dev DB
- [ ] No SQLite assumption appears
- [ ] `npm run test:authz` exited cleanly

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
