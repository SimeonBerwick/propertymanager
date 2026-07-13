# Property Manager Operations

## Deployment baseline

- Treat `apps/web/.env.production.example` as the canonical deployment-surface checklist.
- Session secret, database URL, automation secret, and R2 credentials are production-surface changes. Review them explicitly before deploy.
- Treat `INCIDENT_RESTORE_SUPPORT_RUNBOOK.md` as a launch gate. Production requires a successful encrypted backup and a successful restore drill.

## Health

- `GET /api/health` is the first-line readiness check.
- Healthy means:
  - database query succeeds
  - session secret is configured
  - R2 storage config is present
- If this route is red, fix infra before debugging product behavior.
- The independent GitHub health workflow checks this route every 15 minutes and emails the operator when it fails.

## Hosted regression

- Configure `HOSTED_SMOKE_TOKEN` and `HOSTED_SMOKE_ALLOWED_EMAILS`.
- Run:
  ```bash
  cd apps/web
  HOSTED_BASE_URL="https://your-app.vercel.app" \
  HOSTED_SMOKE_TOKEN="..." \
  npm run test:hosted
  ```
- Current hosted regression validates:
  - health endpoint
  - landlord login surface
  - landlord dashboard via smoke session
  - tenant mobile portal and request detail via smoke session

## Logging

- Structured events are emitted to platform logs as JSON.
- Application errors also send redacted, throttled alerts to `OPS_ALERT_EMAIL`.
- Test alert delivery before launch with the authorized `/api/internal/operator-alert-test` endpoint described in the incident runbook.
- Initial events:
  - `auth.login.*`
  - `auth.mobile_otp.*`
  - `ops.smoke_session.*`

## Backup and restore

- The nightly production-backup workflow encrypts a validated PostgreSQL archive and stores it in a separate R2 backup bucket.
- Live private media is copied to a preserved prefix without mirroring deletions.
- Run the guarded restore-drill workflow before launch and monthly afterward.
- Full setup, recovery, support, and customer communication steps are in `INCIDENT_RESTORE_SUPPORT_RUNBOOK.md`.
