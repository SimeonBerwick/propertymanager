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
HOSTED_RUNTIME_REQUIRED=true

# Auth bootstrap / seed-time landlord values
LANDLORD_EMAIL=landlord@example.com
LANDLORD_PASSWORD=replace-at-seed-time-only
LANDLORD_SLUG=landlord

# Notifications
NOTIFY_TRANSPORT=smtp
SMTP_URL=smtps://user:pass@smtp.example.com:465
NOTIFY_FROM=Property Manager <noreply@simeonware.com>
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"replace-me"}

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
- Android native push notification sends through Firebase Cloud Messaging
- private photo upload/read works
- rate limiting works through Upstash
- Stripe Checkout opens from `/account/subscription`
- Stripe webhook endpoint `/api/stripe/webhook` updates account subscription status
- internal automation succeeds with bearer auth
