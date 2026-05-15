# Property Manager Operations

## Deployment baseline

- Treat `apps/web/.env.production.example` as the canonical deployment-surface checklist.
- Session secret, database URL, automation secret, and R2 credentials are production-surface changes. Review them explicitly before deploy.

## Health

- `GET /api/health` is the first-line readiness check.
- Healthy means:
  - database query succeeds
  - session secret is configured
  - R2 storage config is present
- If this route is red, fix infra before debugging product behavior.

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
- Initial events:
  - `auth.login.*`
  - `auth.mobile_otp.*`
  - `ops.smoke_session.*`
