# PropertyManagerV1 One-Page Deploy Runbook

## Goal
Get hosted production to real green, not fake green.

## Preconditions
- Playwright browser gate passed
- production Neon database exists
- real SMTP credentials exist
- real Cloudflare R2 bucket + credentials exist
- real Upstash Redis REST instance + token exist

## Deploy order
1. Enter env vars in Vercel using `VERCEL_ENV_COPY_BLOCK.md`
2. Confirm `DATABASE_URL` points to production Neon
3. Run Prisma deploy migrations
4. Run the hosted Postgres reconciliation step
5. Redeploy the app
6. Open `/ops`
7. Do not proceed unless `/ops` shows zero blocking failures
8. Run the hosted regression release gate
9. Run the remaining hosted functional checks

## Exact commands
From `apps/web`:

1. `npm ci`
2. `npx prisma migrate deploy`
3. `npm run hosted:db:reconcile`
4. `vercel --prod` or trigger the equivalent production deploy from your normal release path
5. `npx playwright install --with-deps chromium`
6. `HOSTED_E2E_BASE_URL=https://your-production-url HOSTED_E2E_LANDLORD_EMAIL=... HOSTED_E2E_LANDLORD_PASSWORD=... HOSTED_E2E_INTERNAL_AUTOMATION_SECRET=... npm run test:hosted`

The hosted regression suite will:
- reset the dedicated production-safe fixtures through `/api/internal/automation`
- verify landlord visibility
- verify vendor returning login
- verify vendor request detail
- verify the lost-bid request no longer appears as active vendor work

Why the extra hosted DB step exists:
- the repo's Prisma datasource and migration lock are still sqlite-first for local work
- hosted Neon Postgres needs one explicit reconciliation pass for the vendor auth and vendor commercial schema contract
- `npm run hosted:db:reconcile` is idempotent and safe to re-run before production deploys

To make it a real merge gate after the first green run:
- restore GitHub CLI auth with `gh auth login`
- add the hosted workflow secrets in repo settings
- run `./scripts/apply-propertymanager-branch-protection.sh`

## Pass / fail rule
Deployment is **PASS** only if all are true:
- app loads at production URL
- landlord login works
- `/ops` has zero blocking failures
- hosted regression suite is green
- SMTP notifications send for real
- private media upload/read works through R2
- rate limiting works through Upstash
- internal automation runs successfully

Anything else is **FAIL**.

## Hosted functional checks
### 1. Login
- sign in as landlord
- move across pages
- confirm session persists

### 1b. Hosted regression release gate
- run `npm run test:hosted` with the hosted env vars above
- fail if any hosted Playwright smoke fails

### 2. Notifications
- trigger a tenant or vendor notification
- verify it was sent through SMTP
- fail if it only appears in logs

### 3. Private media
- upload a private request photo
- open/fetch it through the app
- fail if storage is local disk or access breaks

### 4. Rate limiting
- trigger repeated login or OTP attempts
- confirm throttling happens
- fail if each instance behaves independently or no throttle appears

### 5. Internal automation
- call the automation endpoint with bearer auth
- confirm the sweep runs successfully
- fail if runtime/env checks block it

## `/ops` failure meaning
### App URL failure
Meaning:
- `APP_URL` or `NEXT_PUBLIC_APP_URL` is wrong, missing, or still localhost

Fix:
- set both to the real hosted URL
- redeploy

### Notification transport failure
Meaning:
- SMTP is not configured correctly
- app is falling back to non-production behavior

Fix:
- set `NOTIFY_TRANSPORT=smtp`
- set `SMTP_URL`
- optionally set `NOTIFY_FROM`
- redeploy

### Internal automation failure
Meaning:
- automation secret missing
- base URL/runtime substrate incomplete
- notifications/runtime enforcement blocking execution

Fix:
- set `INTERNAL_AUTOMATION_SECRET`
- confirm app URL + SMTP env are correct
- if the runtime just crossed the vendor-auth/vendor-commercial migration boundary, run `npm run hosted:db:reconcile`
- redeploy

### R2 media failure
Meaning:
- hosted media substrate is incomplete
- app cannot use object storage for private media

Fix:
- set `R2_ACCOUNT_ID`
- set `R2_ACCESS_KEY_ID`
- set `R2_SECRET_ACCESS_KEY`
- set `R2_BUCKET`
- verify bucket exists and credentials are valid
- redeploy

### Upstash rate-limit failure
Meaning:
- hosted shared rate-limit substrate is incomplete
- throttling would fall back incorrectly or remain local-only

Fix:
- set `UPSTASH_REDIS_REST_URL`
- set `UPSTASH_REDIS_REST_TOKEN`
- verify token and instance
- redeploy

## Fastest debug order if red
1. app URL
2. SMTP
3. automation secret
4. R2
5. Upstash

That order removes the most foundational failures first.

## Release truth
Call production ready only when:
- hosted regression gate is green
- `/ops` is green
- hosted functional checks are green

No exceptions.
