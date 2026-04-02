# Property Manager Hosted Validation Gate

## Purpose
This is the next real gate for Property Manager.

We are no longer proving feature breadth. We are proving that the system works in a real hosted environment with real infrastructure.

If this gate fails, the result is a short must-fix list.
If this gate passes, then companion packaging can move forward.

---

## Pass criteria
A hosted validation pass is only considered real if all of the following are true:

1. **real database**
   - production-shaped Postgres
   - migrations apply cleanly
   - app reads/writes against the hosted DB

2. **real deploy target**
   - actual hosted URL
   - production env vars wired
   - app boots cleanly in hosted runtime

3. **real auth flows**
   - operator login works
   - tenant access/invite flow works
   - vendor access/login works
   - role boundaries/redirects hold

4. **real media/storage behavior**
   - upload works
   - persisted file is retrievable after refresh
   - protected media paths work honestly
   - no local-disk illusion on ephemeral hosting

5. **real notifications truth**
   - invite/OTP/email behavior is verified honestly
   - failures are visible
   - no fake “sent” story

---

## Environment requirements

### Database
- Neon Postgres (or equivalent hosted Postgres)
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- optional dedicated auth test DB if running authz integration separately

### Hosting
- Vercel project with root pointed at `property-manager/`
- `NEXT_PUBLIC_APP_URL` set to actual deployment URL or custom domain
- `AUTH_SECRET` set to real production secret

### Storage
- Cloudflare R2 bucket
- `STORAGE_PROVIDER=r2`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### Notification transports
- Twilio for SMS if phone-channel tenant login is expected
- Resend for email if email-channel invite/OTP is expected

---

## Validation sequence

## 1. Infra bring-up
- create Neon database
- create R2 bucket
- configure Vercel env vars
- run Prisma migrate deploy against direct DB URL
- optionally run seed once for smoke data
- deploy app
- update `NEXT_PUBLIC_APP_URL` to real hosted URL and redeploy

## 2. Operator flow
- open hosted URL
- confirm redirect/auth shell behavior
- log in as operator
- verify dashboard loads real data
- verify property/unit/request reads are live
- verify operator mutation persists after refresh

## 3. Tenant flow
- generate tenant invite or use seeded tenant path
- verify login / OTP / session behavior
- submit a maintenance request
- confirm operator can see it
- verify media/comment visibility behaves correctly

## 4. Vendor flow
- log in as vendor
- view assigned work
- accept/decline/update if supported
- confirm operator side reflects vendor actions

## 5. Media/storage flow
- upload a real image/file
- verify no local-storage fallback lie
- refresh and confirm persistence
- access through protected route and confirm auth behavior

## 6. Notification truth
- send invite/OTP through real configured provider if available
- verify delivery success or visible failure
- ensure UI does not imply successful delivery when transport failed

---

## Failure handling
Any failure should be classified immediately into one of these buckets:

- **infra/config**
  - env var wrong
  - missing provider config
  - migration issue
  - storage credential issue

- **auth/session**
  - bad redirect
  - invite/session failure
  - cross-role access bug

- **workflow**
  - request creation broken
  - operator/vendor/tenant state drift
  - timeline/history mismatch

- **media/storage**
  - upload fails
  - stored media missing after refresh
  - protected route failure

- **notification truth**
  - send not actually sent
  - provider error hidden
  - broken invite URL

The output of a failed hosted validation gate is:
- a short ranked must-fix list
- no new platform work until that list is resolved

---

## Fastest execution path from current repo state
Based on current repo docs and env shape, the fastest sane path is:

1. **Use Vercel + Neon + Cloudflare R2**
   - this is already the documented path in `property-manager/DEPLOY.md`
   - do not invent a new platform stack right now

2. **Set production env exactly from `.env.example` + `DEPLOY.md`**
   - DB URLs
   - AUTH_SECRET
   - NEXT_PUBLIC_APP_URL
   - STORAGE_PROVIDER=r2
   - R2 keys
   - Twilio/Resend only if testing live transport now

3. **Run migrations with direct DB URL**
   - do not use pooled URL for migration execution

4. **Seed once for smoke test**
   - only for controlled first-pass validation

5. **Deploy and smoke test in this order**
   - operator
   - tenant
   - vendor
   - uploads/media
   - notifications

---

## Honest current blockers from repo inspection
The repo/docs are reasonably aligned for this gate, but the following are still the real constraints:

1. **No hosted target is currently established**
   - this must be provisioned

2. **Real Postgres must exist and be wired**
   - local/dev assumptions are not enough

3. **Real storage must be configured**
   - production cannot rely on local storage

4. **Notification providers may still be absent**
   - if missing, notification truth must be described honestly during validation

---

## Recommended immediate action
Use the existing documented stack:
- **hosting:** Vercel
- **database:** Neon Postgres
- **storage:** Cloudflare R2
- **notifications:** Twilio + Resend as needed

Then run the hosted smoke gate and capture either:
- **PASS** → move to companion app packaging
- **FAIL** → produce must-fix list and stay on core stabilization
