# PropertyManagerV1 Deployment Punch List

This is the shortest path to hosted production truth.

## 1. Preview access protection
Before treating preview deploys as usable, enable Vercel's built-in deployment protection for previews.

Required setting:
- Project -> Settings -> Deployment Protection -> Vercel Authentication

Goal:
- preview deployments stay private
- only authorized Vercel users can access them
- do not build custom login/user accounts for preview protection

## 2. Vercel project env
Use `apps/web/.env.hosted.example` as the source template.

Set these values in the Vercel project:

### Core
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_AUTOMATION_SECRET`
- `HOSTED_RUNTIME_REQUIRED=true`

### Notifications
- `NOTIFY_TRANSPORT=smtp`
- `SMTP_URL`
- optional: `NOTIFY_FROM`
- `FIREBASE_SERVICE_ACCOUNT_JSON` for Android native push

### Private media
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

### Shared rate limits
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 3. Database
- confirm Neon production database exists
- confirm `DATABASE_URL` points to production Neon
- run Prisma deploy migrations
- seed only if bootstrap landlord data is still required

## 4. Deploy
- trigger Vercel deploy from branch/merge target
- wait for deploy to finish cleanly
- confirm app loads at `APP_URL`
- confirm preview deployments require Vercel Authentication before unauthenticated access is possible

## 5. Ops truth check
Open `/ops` and require zero blocking failures.

Must be green:
- app URL generation
- SMTP notification transport
- internal automation substrate
- R2 media substrate
- Upstash rate-limit substrate

## 6. Functional hosted checks
### Auth
- log in as landlord
- verify session works across page navigation

### Notifications
- trigger a tenant/vendor notification
- verify it sends through SMTP, not log sink
- enable notifications in the Android app and verify the same event arrives through Firebase Cloud Messaging

### Media
- submit/upload a private photo
- fetch the private media asset
- verify object storage path is R2-backed

### Rate limiting
- trigger login/OTP attempts repeatedly
- verify throttling works
- verify shared state behavior is correct

### Automation
- call internal automation with bearer auth
- verify hosted automation sweep completes successfully

## 7. Release gate
Do not call hosted production ready unless all are true:
- Playwright browser gate passed
- `/ops` has zero blocking failures
- SMTP is real
- R2 is real
- Upstash is real
- automation works in hosted runtime

## 8. If something fails
- `/ops` blocking failure -> fix env/substrate first
- media failure -> inspect R2 credentials, bucket, object permissions
- rate-limit failure -> inspect Upstash REST URL/token
- notification failure -> inspect SMTP URL/from and provider acceptance
- automation failure -> inspect `INTERNAL_AUTOMATION_SECRET`, base URL, and notification/runtime checks
