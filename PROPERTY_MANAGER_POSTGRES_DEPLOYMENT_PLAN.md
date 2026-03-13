# Property Manager V1 - Postgres + Deployment Plan

## Purpose
Turn Property Manager V1 from a laptop-bound demo into a pilot-ready web app with:
- PostgreSQL instead of local SQLite
- real object storage for request photos
- a simple deployment path for app + database + storage
- a rollout sequence that does not gamble with data

---

## Recommended default path

### Default stack for pilot-ready stage
Use this unless a strong reason appears not to:
- **App hosting:** Vercel
- **Database:** Neon Postgres
- **Object storage:** Cloudflare R2
- **ORM/migrations:** Prisma
- **Secrets/config:** Vercel project env vars
- **Monitoring:** Vercel built-in analytics/logs + Sentry next
- **Backups:** Neon automated backups / point-in-time restore + R2 versioning if enabled

### Why this is the best pilot-stage choice
It is the simplest sane path for a small, fast-moving Next.js app:
- native fit for the current Next.js deployment model
- managed Postgres without running servers
- cheap object storage without fighting AWS complexity on day one
- low ops burden while still being real infrastructure
- easy to replace later if the product graduates into heavier multi-tenant scale

### What not to do for pilot
Do **not** start with self-hosted Postgres, Docker Compose on a VPS, or local-disk uploads.
That saves a few dollars and creates avoidable failure modes around backups, storage durability, and maintenance.

---

## Target production-ish architecture

```text
Tenant / Operator / Vendor browser
            |
            v
      Vercel-hosted Next.js app
            |
   +--------+--------+
   |                 |
   v                 v
Neon Postgres   Cloudflare R2
(primary data)  (photos/attachments)
```

### Responsibilities
- **Next.js app**
  - auth/session handling
  - business logic and authorization
  - upload orchestration
  - UI for operator / tenant / vendor flows
- **Postgres**
  - organizations, regions, users, properties, units, requests, events, attachment metadata
- **R2**
  - actual photo/object bytes
  - private bucket preferred
  - app issues signed access URLs or proxied downloads

---

## Database migration plan: SQLite -> Postgres

### Current state
- Prisma datasource is still `sqlite`
- local dev database is `file:./prisma/dev.db`
- app behavior assumes single local database and local/dev workflows

### Required schema change
Update Prisma datasource to:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Recommended migration approach
Use a **fresh Postgres baseline for pilot** rather than trying to preserve the SQLite file as precious production data.

Why:
- current app is still pre-pilot
- data is likely demo/seed/smoke-test data
- a clean Postgres baseline is safer than a rushed one-off conversion script

### If existing demo data must be preserved
Use this one-time sequence:
1. freeze writes to the SQLite environment
2. export SQLite data through Prisma/scripted reads
3. transform records to match the Postgres schema and IDs exactly
4. import into a fresh Postgres database
5. run authz smoke tests against migrated data
6. manually validate one tenant, one vendor, and one operator lifecycle

Do **not** rely on `prisma db push` alone as the migration strategy for real rollout confidence.

---

## Object storage plan

### Recommended design
- store only attachment metadata in Postgres
- store binary files in **private R2 bucket**
- keep `Attachment.storagePath` as object key, not a public URL
- generate signed read URLs or proxy access through app routes after auth checks

### Naming convention
Use keys like:

```text
org/{organizationId}/request/{requestId}/{attachmentId}-{originalFilename}
```

### Why private-by-default matters
Current code treats attachment paths as directly renderable URLs. That is fine for local placeholders and wrong for real deployment.
Tenant/vendor/operator permissions must be checked before file access, otherwise attachment URLs become a data leak side door.

---

## Required production-ish env/config

## Core
- `DATABASE_URL` - Neon pooled Postgres connection string
- `AUTH_SECRET` - long random secret, required in all non-local environments
- `NODE_ENV=production`

## App base URL
- `APP_URL` - canonical public app URL, e.g. `https://property-manager.example.com`

## Object storage
- `STORAGE_PROVIDER=r2`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL` only if intentionally serving public assets; omit for private bucket pattern

## Monitoring
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`

## Optional but useful
- `LOG_LEVEL=info`
- `SEED_ALLOWED=false`

### Configuration rules
- production must fail fast if `AUTH_SECRET` is missing or still using a demo fallback
- production must fail fast if `DATABASE_URL` is missing
- production must not auto-seed by default
- production must not store uploads on local disk

---

## Code changes needed before pilot deploy

### 1) Prisma/Postgres cutover
- switch datasource provider to `postgresql`
- create an initial Prisma migration for Postgres
- validate all enum/model behavior against Postgres
- run seed against Postgres successfully

### 2) Auth hardening
Current auth has a demo fallback secret:
- `process.env.AUTH_SECRET || 'property-manager-demo-secret-change-me'`

Before pilot, change this behavior to:
- allow fallback only in local development
- throw an error in production if `AUTH_SECRET` is unset or weak

### 3) Attachment storage rewrite
Current attachment URL logic assumes local/public paths.
Before pilot:
- add a storage adapter layer
- upload to R2
- store object key in DB
- serve downloads through signed URL or authorized proxy route

### 4) Environment separation
Have at least:
- local `.env`
- Vercel preview env
- Vercel production env

Do not share the same database between preview and production.

### 5) Ops basics
Before pilot:
- install Sentry in the Next.js app
- verify Neon backups are enabled
- verify restore procedure exists in a short runbook
- define who gets alerted first when deploy/auth/upload breaks

---

## Rollout sequence

### Phase 0 - Local prep
1. switch Prisma schema to Postgres
2. create local/dev Postgres database or Neon dev database
3. run migrations
4. update seed script if SQLite assumptions break
5. run app locally against Postgres
6. run auth boundary tests

### Phase 1 - Storage integration
1. introduce storage adapter
2. wire uploads to R2
3. change attachment reads to authorized access pattern
4. validate tenant/vendor/operator visibility rules on attachments

### Phase 2 - Hosted staging/preview
1. create Neon project for non-prod
2. create R2 bucket for non-prod
3. configure Vercel preview env vars
4. deploy app
5. seed preview/staging dataset
6. run end-to-end lifecycle in hosted environment

### Phase 3 - Pilot production
1. create production Neon database
2. create production R2 bucket
3. configure production env vars
4. deploy from tagged/known-good commit
5. run smoke test immediately after deploy
6. onboard first friendly landlord only after smoke pass succeeds

### Phase 4 - Early pilot operations
1. monitor auth failures, upload failures, and request update errors
2. check backup status weekly
3. review logs/errors after first real user sessions
4. delay broader rollout until cross-account scoping is proven solid

---

## Biggest migration risks

### 1) Attachment access becomes the security hole
This is the biggest practical risk.
If object storage is bolted on with public URLs, the app can look permission-safe while leaking photos through direct links.

### 2) Demo auth assumptions survive into production
The fallback auth secret and app-local auth model are acceptable for a demo, not for real pilot exposure unless tightened.

### 3) SQLite-to-Postgres differences surface in edge behavior
Typical issues:
- case sensitivity/query differences
- timestamp handling differences
- migration/seed assumptions that worked in SQLite only
- unique/null behavior showing up differently in real use

### 4) Preview and production share state by accident
If preview deployments point at the same Postgres or storage bucket as production, test activity can pollute real pilot data.

---

## Pilot-ready deployment checklist

### Infra
- [ ] Postgres provider switched in Prisma
- [ ] Neon non-prod DB created
- [ ] Neon prod DB created
- [ ] R2 non-prod bucket created
- [ ] R2 prod bucket created
- [ ] Vercel project connected

### Security/config
- [ ] Production requires `AUTH_SECRET`
- [ ] No demo secret fallback in production
- [ ] Preview and production env vars separated
- [ ] Production uploads do not use local disk/public folder assumptions

### Data/storage
- [ ] Prisma migrations run cleanly on Postgres
- [ ] Seed works in non-prod only
- [ ] Attachment metadata stored in Postgres
- [ ] Attachment bytes stored in R2
- [ ] Attachment reads honor app authz rules

### QA
- [ ] Tenant submits request with photo in deployed env
- [ ] Operator sees and triages it
- [ ] Vendor sees only assigned work
- [ ] Tenant cannot access internal/vendor-only data
- [ ] Direct attachment URL access without auth is blocked or expires

---

## Recommendation in one sentence
For Property Manager V1, the simplest sane pilot path is: **deploy the Next.js app on Vercel, move Prisma to Neon Postgres, store attachments in private Cloudflare R2, and tighten auth/storage behavior before inviting any real users.**
