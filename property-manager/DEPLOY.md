# PM App — Production Deployment Runbook

> Audience: Bob / Sim. One-time first-deploy path from zero infra to live smoke test.
> Pre-condition: codebase is hardened; no external resources exist yet.

---

## 0. Prerequisites (local)

```bash
node -v   # ≥ 20
npm -v    # ≥ 10
npx vercel --version   # install if absent: npm i -g vercel
npx wrangler --version # install if absent: npm i -g wrangler
```

---

## 1. External Resources — Create in This Order

### 1-A. Neon Postgres (database)

1. Sign in at https://console.neon.tech
2. Create project → name it `property-manager` → region closest to your Vercel region (e.g. `us-east-1`)
3. From the **Connection Details** panel, copy:
   - **Pooled** connection string (pgbouncer) — this is `DATABASE_URL`
   - **Direct** connection string (non-pooled) — this is `DATABASE_DIRECT_URL`
   - Both look like `postgresql://USER:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb`
   - Pooled URL has `?pgbouncer=true&connection_limit=1&pool_timeout=0&sslmode=require` appended
4. Keep these strings in a scratch file; you'll paste them into Vercel env vars in step 3.

### 1-B. Cloudflare R2 (file storage)

1. Sign in at https://dash.cloudflare.com → **R2** in left nav
2. Create bucket → name `property-manager-prod` → region Auto
3. Go to **Manage R2 API Tokens** → Create API Token
   - Permissions: **Object Read & Write** on the specific bucket
   - Copy: Account ID (top-right of R2 page), Access Key ID, Secret Access Key

### 1-C. Twilio (SMS OTP) — skip if no phone-channel tenants

1. https://console.twilio.com → Buy a number (SMS-capable, E.164 format)
2. Copy: Account SID, Auth Token, purchased phone number

### 1-D. Resend (email OTP) — skip if no email-channel tenants

1. https://resend.com → API Keys → Create API Key (full access)
2. Domains → Add your domain → verify DNS records
3. Copy: API key, verified from-address (e.g. `noreply@yourdomain.com`)

### 1-E. Vercel (hosting)

1. https://vercel.com → Add New Project → Import Git Repo
2. Select the repo, set **Root Directory** to `property-manager`
3. Framework auto-detected as Next.js — no changes needed
4. **Do not deploy yet** — set env vars first (step 3)

---

## 2. Generate AUTH_SECRET

Run locally:

```bash
openssl rand -base64 48
```

Copy the output — this is your `AUTH_SECRET`. It must be ≥ 32 chars and not the demo placeholder.

---

## 3. Set Environment Variables in Vercel

In the Vercel project → **Settings → Environment Variables**, add all of the following.
Set scope to **Production** (and Preview if you want parity).

| Variable | Value / Format |
|---|---|
| `DATABASE_URL` | Neon pooled URL (`...?pgbouncer=true&connection_limit=1&pool_timeout=0&sslmode=require`) |
| `DATABASE_DIRECT_URL` | Neon direct URL (`...?sslmode=require`) |
| `AUTH_SECRET` | Output of `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (update after first deploy if you don't have a custom domain yet) |
| `STORAGE_PROVIDER` | `r2` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET` | `property-manager-prod` |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `NODE_ENV` | `production` (Vercel sets this automatically — verify it's present) |
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | E.164, e.g. `+15005550006` |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` |
| `RESEND_FROM_ADDRESS` | `noreply@yourdomain.com` (verified sender) |

**Do NOT set** `SEED_ALLOWED` in production. Leave it absent (defaults to false).

---

## 4. Run the Database Migration

From your local machine inside `property-manager/`:

```bash
cd property-manager

# Copy your Neon DIRECT URL into a temp env (never commit this)
export DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
export DATABASE_DIRECT_URL="$DATABASE_URL"

npm run prisma:generate
npx prisma migrate deploy
```

Expected output: `1 migration found in prisma/migrations` → `20260327000000_init` applied.

Verify in Neon console: Tables tab should show ~16 tables.

> `prisma migrate deploy` is idempotent — safe to rerun.

---

## 5. Seed Demo Data (optional, but recommended for first smoke test)

```bash
# Still using direct URL from step 4
SEED_ALLOWED=true npx prisma db seed
```

Expected output: `Seeded: 1 org, 3 users, 2 properties, ...`

This creates:
- Operator: `olivia@example.com` / `operator123`
- Tenant: `tina@example.com` / `tenant123`
- Vendor: `dispatch@aceplumbing.test` / `vendor123`

---

## 6. Deploy

Trigger from Vercel dashboard → **Redeploy**, or push to main branch.

Watch the build log:
- `npm run build` must complete without TypeScript errors
- Prisma client must generate successfully
- Build size should be < 500 kB first load JS

Once deploy is marked **Ready**, copy the deployment URL.

Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to match the actual URL, then **redeploy once more** so invite links resolve correctly.

---

## 7. Smoke Test Checklist

Run these in order. All tests use the seeded demo accounts.

### 7-A. Basic load

| Check | Expected | Failure signature |
|---|---|---|
| GET `https://your-app.vercel.app/` | Redirects to `/auth/login` (302) | 500 = missing env var; check Vercel function logs |
| Login page renders | Form with email + password fields | Blank page = Next.js build error |

### 7-B. Operator login

| Check | Expected | Failure signature |
|---|---|---|
| Log in as `olivia@example.com` / `operator123` | Redirects to operator dashboard | "Invalid credentials" = seed didn't run or DB not connected |
| Dashboard shows properties | List of seeded properties visible | Empty + no error = seed ran but query broken |
| Log out | Redirects to `/auth/login`, cookie cleared | Cookie persists = auth lib issue |

### 7-C. File attachment upload

| Check | Expected | Failure signature |
|---|---|---|
| Open a seeded maintenance request | Request detail page loads | 500 = DB query error |
| Attach a file (< 5 MB, any image) | Upload succeeds, thumbnail appears | "Storage error" = R2 credentials wrong or bucket name mismatch |
| Reload page | Attachment still visible | File gone = storage provider fell back to local (check `STORAGE_PROVIDER=r2`) |
| Download attachment | File downloads correctly | 403/404 = R2 IAM permissions missing read |

### 7-D. Tenant OTP — SMS path

| Check | Expected | Failure signature |
|---|---|---|
| As operator, send SMS invite to a real phone number | Invite sent confirmation | "Twilio error" = wrong SID/token; check Vercel logs for HTTP 401 from Twilio |
| Open invite link on mobile | OTP entry screen | Link 404 = `NEXT_PUBLIC_APP_URL` mismatch |
| Enter OTP received by SMS | Logs in, shows tenant dashboard | "Invalid code" after correct code = clock skew (NTP issue, rare on Vercel) |
| Submit a maintenance request from mobile | Request appears in operator dashboard | 500 = session/auth issue |

### 7-E. Tenant OTP — email path

| Check | Expected | Failure signature |
|---|---|---|
| Send email invite to a real address | Invite email delivered | Not delivered = Resend domain not verified; check Resend dashboard for bounces |
| Follow invite link, enter OTP | Logs in successfully | "Invalid code" = Resend API key wrong or email delayed > 10 min (OTP TTL) |

### 7-F. Vendor login

| Check | Expected | Failure signature |
|---|---|---|
| Log in as `dispatch@aceplumbing.test` / `vendor123` | Vendor queue visible | Same as operator login failures |
| Accept a work order | Status updates in operator view | Permission error = RBAC regression |

---

## 8. Rollback / Abort Criteria

| Condition | Action |
|---|---|
| Build fails in Vercel | Fix code, push. Previous deployment still live — no rollback needed. |
| `prisma migrate deploy` fails mid-migration | Neon console → run `SELECT * FROM _prisma_migrations` to see state; manually revert with `DROP TABLE` if partial; re-run migration after fix. |
| 500s on all routes after deploy | Vercel → Instant Rollback to previous deployment. Check env vars — most likely a missing or malformed variable. |
| R2 upload failures | Verify `R2_BUCKET` name exactly matches bucket in Cloudflare dashboard (case-sensitive). |
| OTP codes not arriving | Check Vercel function logs for transport errors. Twilio/Resend log dashboards show delivery status. |
| AUTH_SECRET missing or demo value in prod | App will throw at session creation. Fix env var, redeploy. No data loss. |
| Seed accidentally run in prod | `SEED_ALLOWED` guard prevents this. If somehow run, restore from Neon's point-in-time recovery (available on free tier, 7-day window). |

---

## 9. Post-Deploy Hardening (after smoke test passes)

- [ ] Set a custom domain in Vercel and update `NEXT_PUBLIC_APP_URL`
- [ ] Enable Neon connection pooling branch protection
- [ ] Add Sentry DSN for error tracking (`SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`)
- [ ] Review Cloudflare R2 CORS policy if serving attachments from a CDN subdomain
- [ ] Rotate `AUTH_SECRET` on a schedule (invalidates all sessions — coordinate with users)
