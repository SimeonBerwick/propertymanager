#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATABASE_URL="${E2E_DATABASE_URL:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_e2e?schema=public}}"
export SESSION_SECRET="${SESSION_SECRET:-e2e-session-secret-2026-abcdefghijklmnopqrstuvwxyz}"
export LANDLORD_EMAIL="${LANDLORD_EMAIL:-landlord@example.com}"
export LANDLORD_PASSWORD="${LANDLORD_PASSWORD:-changeme}"
export LANDLORD_SLUG="${LANDLORD_SLUG:-landlord}"
export APP_URL="${APP_URL:-http://localhost:3005}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3005}"
export NOTIFY_TRANSPORT="${NOTIFY_TRANSPORT:-log}"
export SMS_TRANSPORT="${SMS_TRANSPORT:-log}"
export ANDROID_REVIEWER_ACCESS_ENABLED="${ANDROID_REVIEWER_ACCESS_ENABLED:-true}"
export ANDROID_REVIEWER_LANDLORD_PASSWORD="${ANDROID_REVIEWER_LANDLORD_PASSWORD:-play-review-password-2026}"
export ANDROID_REVIEWER_TENANT_EMAIL="${ANDROID_REVIEWER_TENANT_EMAIL:-play-review-tenant@simeonware.com}"
export ANDROID_REVIEWER_VENDOR_EMAIL="${ANDROID_REVIEWER_VENDOR_EMAIL:-play-review-vendor@simeonware.com}"
export ANDROID_REVIEWER_OTP_CODE="${ANDROID_REVIEWER_OTP_CODE:-424242}"
export NODE_ENV="development"

npx prisma db push --force-reset --skip-generate
npm run prisma:seed
npm run seed:android-reviewers
exec npx next dev -H 127.0.0.1 -p 3005
