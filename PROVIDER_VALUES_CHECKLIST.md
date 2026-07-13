# Provider Values Checklist

Use this before touching Vercel. The point is simple: collect every real hosted value first, then paste them into Vercel once.

Read order:
1. `VERCEL_ENV_COPY_BLOCK.md`
2. this file
3. `ONE_PAGE_DEPLOY_RUNBOOK.md`

---

## 1) Vercel app values
These are not provider-issued, but they must be decided before deploy.

### Required
- [ ] `APP_URL`
  - exact production URL
  - example: `https://pm.yourdomain.com`
- [ ] `NEXT_PUBLIC_APP_URL`
  - must exactly match `APP_URL`
- [ ] `SESSION_SECRET`
  - strong random secret
  - generate 32+ bytes minimum
- [ ] `INTERNAL_AUTOMATION_SECRET`
  - strong random bearer secret for internal automation
- [ ] `HOSTED_RUNTIME_REQUIRED`
  - set to exactly: `true`
- [ ] `NOTIFY_TRANSPORT`
  - set to exactly: `smtp`

### Landlord bootstrap values
- [ ] `LANDLORD_EMAIL`
- [ ] `LANDLORD_PASSWORD`
  - use a real strong password
- [ ] `LANDLORD_SLUG`
  - stable slug, typically `landlord`

### Vercel entry check
Before saving env vars in Vercel:
- [ ] every required variable is entered in the Production environment
- [ ] no localhost URLs remain
- [ ] no placeholder values remain
- [ ] `APP_URL` and `NEXT_PUBLIC_APP_URL` are identical

---

## 2) Neon values
Neon provides the production Postgres connection.

### You need from Neon
- [ ] project created for production
- [ ] production database name
- [ ] production database user
- [ ] production database password
- [ ] production host
- [ ] production port
- [ ] SSL required

### Vercel variable populated from Neon
- [ ] `DATABASE_URL`
  - format:
    - `postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`

### Neon truth checks
- [ ] this is the production database, not local, not preview, not dev
- [ ] hostname is Neon
- [ ] `sslmode=require` is present
- [ ] credentials can connect successfully
- [ ] Prisma migrations are intended to run against this exact database

---

## 3) SMTP provider values
This is the real notification substrate. If this is fake, deploy is fake.

### You need from your SMTP provider
- [ ] SMTP username
- [ ] SMTP password or API key
- [ ] SMTP host
- [ ] SMTP port
- [ ] encryption mode
  - usually SMTPS on 465 or STARTTLS on 587
- [ ] verified sending domain or sender identity
- [ ] from address to use in production

### Vercel variables populated from SMTP provider
- [ ] `SMTP_URL`
  - common format:
    - `smtps://USER:PASSWORD@HOST:465`
  - if using STARTTLS/587, use the provider’s required URL format
- [ ] `NOTIFY_FROM`
  - example:
    - `Property Manager <noreply@yourdomain.com>`

### SMTP truth checks
- [ ] provider account is active
- [ ] credentials are production credentials
- [ ] sender/domain is verified
- [ ] `NOTIFY_FROM` is allowed by the provider
- [ ] test send succeeds outside localhost assumptions

---

## 4) Cloudflare R2 values
R2 is required for hosted private media.

### You need from Cloudflare R2
- [ ] R2 account ID
- [ ] R2 API access key ID
- [ ] R2 API secret access key
- [ ] bucket name
- [ ] bucket already created
- [ ] credentials have permission to read/write that bucket

### Vercel variables populated from R2
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET`

### R2 truth checks
- [ ] bucket name exactly matches the real bucket
- [ ] credentials are not scoped to the wrong account
- [ ] credentials are not read-only if uploads are required
- [ ] app is not falling back to local disk
- [ ] private upload and fetch both work after deploy

---

## 5) Upstash Redis values
Upstash is the shared hosted rate-limit substrate.

### You need from Upstash
- [ ] Redis REST URL
- [ ] Redis REST token
- [ ] production instance selected
- [ ] REST access enabled

### Vercel variables populated from Upstash
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

### Upstash truth checks
- [ ] this is the production instance, not a test instance
- [ ] URL is the REST URL, not some other connection string
- [ ] token is valid for that instance
- [ ] throttling works across hosted instances, not per-process only

---

## 6) Final paste checklist for Vercel
Do not deploy until all of this is true.

### Exact env set in Vercel Production
- [ ] `DATABASE_URL`
- [ ] `SESSION_SECRET`
- [ ] `APP_URL`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `INTERNAL_AUTOMATION_SECRET`
- [ ] `HOSTED_RUNTIME_REQUIRED=true`
- [ ] `LANDLORD_EMAIL`
- [ ] `LANDLORD_PASSWORD`
- [ ] `LANDLORD_SLUG`
- [ ] `NOTIFY_TRANSPORT=smtp`
- [ ] `SMTP_URL`
- [ ] `NOTIFY_FROM`
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

### Sanity checks
- [ ] no placeholder text like `your-...`, `example.com`, or `replac...`
- [ ] no localhost value anywhere
- [ ] no dev/test credentials mixed into production
- [ ] all secrets pasted exactly once and saved
- [ ] app redeployed after env entry

---

## 7) Immediate post-deploy checks
After env entry and redeploy:
- [ ] run Prisma deploy migrations
- [ ] open `/ops`
- [ ] require zero blocking failures
- [ ] landlord login works
- [ ] SMTP notification sends for real
- [ ] private media upload/read works through R2
- [ ] rate limiting works through Upstash
- [ ] internal automation succeeds with bearer auth

If any one of those fails, production is not green.
# QuickBooks Online

- Add `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET` from the Intuit developer app.
- Set `QUICKBOOKS_ENVIRONMENT=production` for live companies or `sandbox` for Intuit test companies.
- Register `https://YOUR_APP_HOST/api/quickbooks/callback` as the OAuth redirect URI.
- After deployment, connect the company at `/account/quickbooks` and select the expense, income item, staff expense, and offset mappings before syncing.
