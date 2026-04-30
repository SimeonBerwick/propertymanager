#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATABASE_URL="file:./e2e.db"
export SESSION_SECRET="e2e-session-secret-2026-abcdefghijklmnopqrstuvwxyz"
export LANDLORD_EMAIL="landlord@example.com"
export LANDLORD_PASSWORD="changeme"
export LANDLORD_SLUG="landlord"
export NOTIFY_TRANSPORT="log"
export NODE_ENV="development"

rm -f prisma/e2e.db prisma/e2e.db-journal prisma/prisma/e2e.db prisma/prisma/e2e.db-journal e2e.db e2e.db-journal
npx prisma db push --skip-generate
npm run prisma:seed
exec npx next dev -H 127.0.0.1 -p 3005
