#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
  echo "DATABASE_URL must point at hosted Postgres for this reconciliation step." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/../prisma/hosted-postgres/20260527183000_reconcile_vendor_runtime.sql"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SQL_FILE}"
