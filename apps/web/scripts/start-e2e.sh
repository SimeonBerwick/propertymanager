#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATABASE_URL="${E2E_DATABASE_URL:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_dev?schema=e2e}}"
export SESSION_SECRET="${SESSION_SECRET:-e2e-session-secret-2026-abcdefghijklmnopqrstuvwxyz}"
export LANDLORD_EMAIL="${LANDLORD_EMAIL:-landlord@example.com}"
export LANDLORD_PASSWORD="${LANDLORD_PASSWORD:-changeme}"
export LANDLORD_SLUG="${LANDLORD_SLUG:-landlord}"
export NOTIFY_TRANSPORT="${NOTIFY_TRANSPORT:-log}"
export SMS_TRANSPORT="${SMS_TRANSPORT:-log}"
export NODE_ENV="development"

npx prisma db push --force-reset --skip-generate
npm run prisma:seed
exec npx next dev -H 127.0.0.1 -p 3005
