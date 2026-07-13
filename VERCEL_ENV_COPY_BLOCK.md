# Vercel Env Copy Block

Use this as the exact field list for the PropertyManagerV1 web app.

## Required env vars

```env
# Core runtime
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
SESSION_SECRET=replace-with-32+-char-random-secret
APP_URL=https://simeonware.com
NEXT_PUBLIC_APP_URL=https://simeonware.com
INTERNAL_AUTOMATION_SECRET=replace-with-long-random-secret
CRON_SECRET=replace-with-separate-long-random-secret
HOSTED_RUNTIME_REQUIRED=true

# Auth bootstrap / seed-time landlord values
LANDLORD_EMAIL=landlord@example.com
LANDLORD_PASSWORD=replace-at-seed-time-only
LANDLORD_SLUG=landlord

# Notifications
NOTIFY_TRANSPORT=smtp
SMTP_URL=smtps://user:pass@smtp.example.com:465
NOTIFY_FROM=Property Manager <noreply@simeonware.com>
OPS_ALERT_EMAIL=support@simeonware.com
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"replace-me"}

# Google Play reviewer access
ANDROID_REVIEWER_ACCESS_ENABLED=true
ANDROID_REVIEWER_LANDLORD_EMAIL=play-review-landlord@simeonware.com
ANDROID_REVIEWER_LANDLORD_PASSWORD=replace-with-stable-reviewer-password
ANDROID_REVIEWER_TENANT_EMAIL=play-review-tenant@simeonware.com
ANDROID_REVIEWER_VENDOR_EMAIL=play-review-vendor@simeonware.com
ANDROID_REVIEWER_STAFF_EMAIL=play-review-staff@simeonware.com
ANDROID_REVIEWER_OTP_CODE=replace-with-six-digit-reviewer-code

# Cloudflare R2 private media
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=property-manager-private-media

# Upstash Redis shared rate limiting
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token

# Stripe subscriptions
STRIPE_SECRET_KEY=sk_live_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
```

## Vercel target
Set these for:
- Production
- Preview if you want hosted substrate checks there too

## After env entry
- redeploy
- open `/ops`
- require zero blocking failures

## Must verify after deploy
- landlord login works
- SMTP notification sends
- a forced test error reaches `OPS_ALERT_EMAIL` without credentials or personal data
- Android native push notification sends through Firebase Cloud Messaging
- private photo upload/read works
- rate limiting works through Upstash
- Stripe Checkout opens from `/account/subscription`
- Stripe webhook endpoint `/api/stripe/webhook` updates account subscription status
- internal automation succeeds with bearer auth
# QuickBooks Online OAuth (create an app at developer.intuit.com)
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_ENVIRONMENT=production
