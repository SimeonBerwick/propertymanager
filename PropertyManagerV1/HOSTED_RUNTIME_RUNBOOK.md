# Hosted Runtime Runbook

This is the next honest production slice for PropertyManagerV1.

## Goal
Make hosted production fail fast when the runtime substrate is fake, partial, or silently falling back to dev behavior.

## Required hosted env

### Core
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_AUTOMATION_SECRET`

### Notifications
- `NOTIFY_TRANSPORT=smtp`
- `SMTP_URL`
- optional: `NOTIFY_FROM`

### Private media target
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

### Distributed rate limiting target
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Enforcement mode
- Vercel production: enforced automatically via `VERCEL_ENV=production`
- other hosted production: set `HOSTED_RUNTIME_REQUIRED=true`
- local/dev: leave enforcement off

## Current truth
The validator and ops page now expose hosted-production gaps clearly.

What is now enforced:
- hosted notifications cannot silently fall back to log transport
- hosted app URL generation cannot silently fall back to localhost
- hosted internal automation refuses to run with missing base/notification substrate
- hosted private media reads/uploads switch to R2 automatically when R2 env is present
- hosted rate limiting switches to Upstash-backed shared state automatically when Upstash env is present

What this means operationally:
- if R2 env is missing, hosted media checks block readiness
- if Upstash env is missing, hosted rate-limit checks block readiness
- once both are configured, `/ops` can go fully green without code changes

## Vercel / Neon / R2 / Upstash checklist

### 1. Neon
- create production Postgres database
- set `DATABASE_URL`
- run Prisma migrate deploy
- run seed if landlord bootstrap data is still needed

### 2. Vercel project env
Start from `apps/web/.env.hosted.example`.

Set:
- `SESSION_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_AUTOMATION_SECRET`
- `NOTIFY_TRANSPORT=smtp`
- `SMTP_URL`
- optional `NOTIFY_FROM`
- if not on Vercel prod auto-detect: `HOSTED_RUNTIME_REQUIRED=true`

### 3. Cloudflare R2
Provision bucket and credentials.
Set:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

The app now uses R2 automatically for private media storage/read paths when these vars are present.

### 4. Upstash Redis
Provision REST Redis.
Set:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The app now uses Upstash-backed shared rate-limit state automatically when these vars are present.

## Hosted verification steps
1. Open `/ops`
2. Confirm zero blocking hosted failures
3. Trigger a tenant notification and verify it arrives via SMTP, not logs
4. Trigger OTP issuance twice and verify rate-limit state is shared across instances
5. Upload and fetch a private photo and verify the object is coming from production object storage
6. Trigger internal automation with bearer auth and verify it runs against production infra

## Release rule
Do not call hosted production ready while `/ops` still shows blocking hosted failures.
