# Property Manager V1 - Infra + Verification Handoff

## Situation in one line
Property Manager is currently blocked by missing machine/database prerequisites, not by a newly discovered product-code defect.

## What is actually true right now
- no code changes were required in the latest pass
- the app now behaves honestly when no database is present
- build passed
- health endpoint passed
- login / render / route-guard checks passed
- real DB-backed write flows are **not yet verified**
- real in-browser end-to-end verification is **not yet verified**

## Why the work stopped
The machine does not currently have the prerequisites needed to run the real database path.

### Current blockers
- no `DATABASE_URL` credentials present
- no PostgreSQL installed
- no `psql`
- no Docker
- no passwordless sudo, so missing prerequisites could not be installed by the agent
- no browser automation harness available for final in-browser write verification

## Correct status label
Use this status, not a softer one:

**Property Manager is infra-blocked on real DB verification.**

That means:
- basic app integrity is still intact
- guarded/read/demo behavior was checked
- the product is **not** yet cleared as "real database verified"
- the product is **not** yet cleared as "browser-verified end-to-end write flow working"

## Definition of done for unblocking this stage
This handoff is complete only when all of the following are true:
- a real PostgreSQL database is available
- `DATABASE_URL` is configured
- Prisma migrate succeeds against the real DB
- seed succeeds if required for test accounts/data
- the app runs against that DB without demo/disconnected ambiguity
- browser verification covers real create/edit/write flows
- Jeff can review against a real DB-backed walkthrough rather than a no-DB honesty pass

---

# Step-by-step handoff

## 1) Provision local prerequisites
Choose one of these paths:

### Path A - local PostgreSQL install
Install:
- PostgreSQL server
- `psql`

### Path B - Docker-based local database
Install:
- Docker

If agents are expected to perform local installs, the machine also needs the required sudo path/permissions.

---

## 2) Create the database and app user
If using local PostgreSQL directly, create:
- one database for Property Manager
- one dedicated app user
- a password for that user

Example shape:
- database: `property_manager`
- user: `property_manager_app`

If Sim wants, this can be adapted to whatever naming convention the machine already uses.

---

## 3) Add environment configuration
Populate the app env with a real Postgres connection string.

Required minimum:
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public`

Recommended additional truth rules:
- do not let production-ish runs silently fall back to fake/demo assumptions
- make sure the app is unmistakably connected to the real DB or unmistakably in demo/no-DB mode

---

## 4) Run Prisma against the real database
From the `property-manager/` app directory, run the real DB setup sequence:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

If this environment is still in a dev/local setup that expects a seed step, also run:

```bash
npx prisma db seed
```

If migrate/deploy is not the correct command for this repo state, use the repo’s actual Prisma flow — but the end result must be a real initialized Postgres database with usable test data/accounts.

---

## 5) Verify startup against the real DB
Required checks:
- app boots cleanly with `DATABASE_URL` set
- health endpoint still passes
- no misleading demo-like data appears when DB connectivity is broken
- no ambiguous "looks healthy but is actually disconnected" state remains

---

## 6) Run the browser verification checklist
This is the part that still matters most after infra is fixed.

### Minimum browser checklist
Use real DB-backed accounts/data and verify all of this in-browser:

#### Operator
- log in successfully
- load operator dashboard
- load operator request list
- open request detail
- create/edit flows behave correctly
- route guards still hold

#### Tenant
- submit a request
- include photo if the current environment supports it
- confirm request appears correctly afterward
- confirm status/progress surface renders correctly

#### Vendor
- access assigned work only
- open queue/detail views
- update intended fields/status where allowed
- confirm unauthorized work is still blocked

#### End-to-end flow
- tenant submits request
- operator sees request
- operator assigns vendor if available in this setup
- vendor updates progress/status
- tenant sees reflected update

### Hard rule
This stage is not done until at least one real DB-backed write flow is verified in-browser.

---

## 7) Jeff review handoff
After the infra and browser checks pass, hand the build to Jeff using:
- `PROPERTY_MANAGER_JEFF_QA_CHECKLIST.md`

Jeff should review the real DB-backed app state, not a disconnected/demo/no-DB simulation.

---

# Recommended owner split

## Bob
Own:
- infra unblocking sequence inside the repo/app context
- env wiring confirmation
- Prisma migrate/seed execution
- first-pass browser verification
- documenting exact failures if any step breaks

## Jeff
Own:
- QA gate after the DB path is genuinely live
- truth check that the app no longer only "looks healthy"
- final pass/fail/conditions judgment from a product-trust perspective

---

# Exact status update for Mission Control
Use this wording or close to it:

**Property Manager is infra-blocked on real DB verification. Build/health/login/render/route guards passed, and the app now behaves honestly in no-DB mode, but real DB-backed write flows remain unverified because the machine lacks `DATABASE_URL`, PostgreSQL/`psql`, Docker, install permissions, and browser automation for final verification.**

---

# Clean next move
The next real move is not more product-code churn.

The next move is:
1. provision DB prerequisites
2. wire `DATABASE_URL`
3. run Prisma migrate/seed
4. verify real write flows in-browser
5. hand to Jeff for the real gate

That is the shortest honest path forward.