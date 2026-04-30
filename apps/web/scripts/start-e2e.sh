#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_e2e?schema=public}"
export SESSION_SECRET="${SESSION_SECRET:-e2e-session-secret-2026-abcdefghijklmnopqrstuvwxyz}"
export LANDLORD_EMAIL="${LANDLORD_EMAIL:-landlord@example.com}"
export LANDLORD_PASSWORD="${LANDLORD_PASSWORD:-changeme}"
export LANDLORD_SLUG="${LANDLORD_SLUG:-landlord}"
export NOTIFY_TRANSPORT="${NOTIFY_TRANSPORT:-log}"
export NODE_ENV="${NODE_ENV:-development}"

npx prisma migrate deploy
npm run prisma:seed
exec npx next dev -H 127.0.0.1 -p 3005
