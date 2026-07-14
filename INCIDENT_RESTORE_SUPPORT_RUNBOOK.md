# Simeonware Incident, Restore, and Support Runbook

## Launch gate

Production launch is blocked until every item below is complete:

- [x] Vercel is on Pro and the owner can perform an Instant Rollback.
- [x] Neon is on a paid plan and the restore window is set to at least 7 days.
- [x] A dedicated private R2 backup bucket exists. It is not the live media bucket.
- [x] A lifecycle rule expires only `database/` archives after 90 days. `media-preserved/` has no automatic deletion rule.
- [x] All GitHub backup, restore, health, and alert secrets below are configured.
- [x] `Property Manager Production Backup` has completed successfully.
- [x] The backup bucket contains an encrypted database archive and preserved media objects.
- [x] `Property Manager Restore Drill` has restored the newest archive into a disposable Neon database and passed its record checks.
- [ ] `POST /api/internal/operator-alert-test` delivered an email to `OPS_ALERT_EMAIL`.
- [x] The scheduled production health workflow is enabled and GitHub Actions failure notifications are enabled.
- [x] The date, backup object name, restore target, result, duration, and person performing the drill are recorded in the drill log at the end of this document.

Having a backup is not enough. Launch requires one proven restore.

## Recovery targets

- **Database point-of-recovery target:** use Neon point-in-time restore first. The independent nightly archive limits worst-case database loss to 24 hours if Neon restore is unavailable.
- **Media point-of-recovery target:** uploaded media is copied nightly without deleting old backup objects. Worst-case loss is 24 hours.
- **Service recovery target:** restore the public app within 2 hours of a severe incident. Customer updates begin within 60 minutes.

These are operating targets, not guarantees. Record actual performance during every drill and incident.

## What is protected

1. **Bad app release:** Vercel retains deployable production versions. An Instant Rollback points production back to known-good code without changing the database.
2. **Accidental database change:** Neon point-in-time restore is the first recovery method.
3. **Neon outage, project loss, or unusable restore history:** the nightly GitHub workflow creates an encrypted PostgreSQL custom-format archive in the separate R2 backup bucket.
4. **Accidental media deletion:** the same workflow copies live R2 media to `media-preserved` without `--delete`, so disappearance from the live bucket does not remove the backup copy.

The backup passphrase must be kept in GitHub Secrets and in the owner's password manager. Losing it makes the database archives unusable.

## Required GitHub secrets

Set these in **Repository settings > Secrets and variables > Actions**:

| Secret | Purpose |
| --- | --- |
| `PM_HOSTED_BASE_URL` | Production origin, for example `https://simeonware.com` |
| `PM_HEALTH_RESEND_API_KEY` | Resend API key used only by independent monitor alerts |
| `PM_OPS_ALERT_EMAIL` | Operator address that receives health, backup, and drill failures |
| `PM_PRODUCTION_DATABASE_URL` | Direct production Neon PostgreSQL connection string |
| `PM_RESTORE_TEST_DATABASE_URL` | Direct URL for a disposable non-production database whose name contains `restore`, `drill`, or `test` |
| `PM_BACKUP_R2_ACCOUNT_ID` | Cloudflare account containing the live and backup buckets |
| `PM_BACKUP_R2_ACCESS_KEY_ID` | R2 token with read access to live media and write/read access to backup |
| `PM_BACKUP_R2_SECRET_ACCESS_KEY` | Secret for that restricted R2 token |
| `PM_MEDIA_R2_BUCKET` | Existing live private-media bucket |
| `PM_BACKUP_R2_BUCKET` | Separate private recovery bucket |
| `PM_BACKUP_ENCRYPTION_PASSPHRASE` | Random passphrase of at least 32 characters, also stored in the owner's password manager |

Do not reuse the app's broad R2 credentials. Create a backup-specific token with only the bucket permissions it needs.

## Required Vercel environment

Set `OPS_ALERT_EMAIL=support@simeonware.com` for Production. The health endpoint now treats a missing or invalid recipient as a blocking production configuration error.

## Emergency switches

Use Vercel project environment variables to pause a failing integration without taking the application offline. Set only the affected switch to `true`, redeploy, confirm the pause message, and record the incident time. Set it back to `false` and redeploy after the underlying provider or defect is resolved.

| Switch | Effect |
| --- | --- |
| `EMERGENCY_DISABLE_STRIPE_WRITES` | Stops checkout and subscription changes. Stripe webhooks continue so payment truth is preserved. |
| `EMERGENCY_DISABLE_QUICKBOOKS` | Stops connections, sync, retries, and reconciliation. Existing sync records remain queued. |
| `EMERGENCY_DISABLE_UPLOADS` | Rejects new photos and invoice attachments before storage. Existing media remains readable. |
| `EMERGENCY_DISABLE_OUTBOUND_NOTIFICATIONS` | Stops email and push delivery. User actions and stored records continue. |
| `EMERGENCY_DISABLE_TRANSLATION` | Uses the original text without calling Google Translation. |
| `EMERGENCY_DISABLE_AUTOMATION` | Stops the daily automation endpoint before any sweep runs. |

Never disable Stripe webhook intake during a billing incident. Webhook receipts are duplicate-proof and are required to keep subscription status accurate.

## Support and error loop

1. Ask the user for the `SW-...` support reference or the error reference shown on the crash page.
2. Search the `SupportRequest.referenceId` record and Sentry issue stream, then correlate the timestamp with Vercel logs.
3. Update the support record from `open` to `investigating`, then `resolved` after the user confirms recovery.
4. Preserve the reference in any refund, data correction, or incident note.

Support requests remain stored even when email delivery is paused. `SUPPORT_EMAIL` receives new-ticket alerts; `OPS_ALERT_EMAIL` remains the destination for automated operational failures.

After redeploying, send a delivery test without placing the secret directly in shell history:

```bash
read -s INTERNAL_AUTOMATION_SECRET
export INTERNAL_AUTOMATION_SECRET
curl --fail --request POST \
  --header "Authorization: Bearer $INTERNAL_AUTOMATION_SECRET" \
  https://simeonware.com/api/internal/operator-alert-test
unset INTERNAL_AUTOMATION_SECRET
```

The email must arrive. Confirm that it contains no customer email, password, OTP, token, cookie, database credentials, or stack trace.

## Automated checks

- `Property Manager Production Health` checks `/api/health` four times per hour from infrastructure outside Vercel. It retries transient network failures, fails on a non-200 response or unhealthy database, and emails the operator through Resend.
- `Property Manager Production Backup` runs nightly. It validates the PostgreSQL archive, encrypts it with AES-256, uploads it to the backup bucket, confirms the object exists, and preserves media copies.
- `Property Manager Restore Drill` is manual by design. It refuses a target with the same host, port, and database name as production, restores the newest archive, and queries core tables.
- Application errors continue to be written as structured JSON in Vercel and now trigger redacted email alerts. Repeated instances of the same event are limited to one alert per 15-minute window.

Enable GitHub email notifications for failed Actions as a second alert path. If Resend itself is unavailable, the red workflow must still be noticed.

## Monthly restore drill

Run this before launch and monthly afterward:

1. Create or reset a disposable Neon database named clearly, such as `simeonware_restore_drill`. The workflow requires `restore`, `drill`, or `test` in the database name and will refuse any other target. Never use production.
2. Put its direct connection string in `PM_RESTORE_TEST_DATABASE_URL`.
3. Run `Property Manager Production Backup` manually and require green.
4. Confirm a newly timestamped `.dump.gpg` object exists under `database/` in the backup bucket.
5. Run `Property Manager Restore Drill` manually and require green.
6. Sign in to the restored environment only if it is isolated from outbound email, Stripe, and automation. Spot-check properties, units, requests, invoices, and message counts.
7. Delete or lock the disposable database after verification.
8. Record the drill below. A failed drill makes launch or the next release a no-go until corrected.
9. Once each month, download the newest encrypted database archive to separate encrypted storage outside the Cloudflare account. This protects against loss of the whole Cloudflare account, which a second bucket in that same account cannot do.

## Incident decision tree

### App is down but data looks intact

1. Declare **SEV-1**, note the UTC start time, and stop production merges.
2. Check `/api/health`, the production health workflow, Vercel logs, and provider status pages.
3. If the failure began with a deployment, use Vercel Instant Rollback to the last known-good production deployment.
4. Verify `/api/health`, manager sign-in, one public page, and one authenticated request page.
5. Do not undo the rollback until the fix passes CI and hosted regression.

### Data is missing, damaged, or unexpectedly changed

1. Declare **SEV-1** and stop all writes: disable automation, pause deployments, and if necessary put the app into maintenance mode at Vercel.
2. Record the first known bad time and last known good time in UTC. Do not guess.
3. Preserve logs and take a new archive before changing the database if the database is still reachable.
4. Restore Neon to a new branch or recovery database at the last known good time. Inspect it before redirecting the app.
5. If Neon restore is unavailable, use the newest verified encrypted archive and the same guarded restore process as the drill.
6. Reconcile changes made after the restore point. Do not claim no data was lost until counts and representative records have been checked.
7. Point the app at the recovered database only after a second person or a written self-check confirms the target.
8. Verify manager, tenant, vendor, and staff access; requests; messages; billing records; and private media before reopening writes.

### Uploaded media is missing

1. Stop cleanup jobs and any action that deletes media.
2. Identify affected object keys from database records and logs.
3. Copy only the required objects from `media-preserved` back to the live private-media bucket.
4. Verify authenticated access through the app. Do not make the R2 bucket public.

## Severity and response

| Severity | Examples | Acknowledge | Customer update |
| --- | --- | --- | --- |
| SEV-1 | App unavailable, suspected data loss, security incident, widespread login failure | 15 minutes | Within 60 minutes, then at least every 2 hours |
| SEV-2 | Major workflow broken for multiple customers, billing sync blocked | 1 hour | Same business day |
| SEV-3 | Isolated defect or usability issue with a workaround | 1 business day | With resolution or next-step estimate |

For every SEV-1, keep one incident note containing timestamps, symptoms, affected customers, actions, commands, provider notices, decisions, and verification results. Never paste secrets, OTPs, payment details, or full database URLs into the note.

## Support procedure

1. Use `support@simeonware.com` as the single customer support entry point.
2. Ask for organization name, user role, approximate time, page or request title, device, and a screenshot if safe. Never ask for a password or OTP.
3. Confirm whether the problem affects one user, one account, or everyone.
4. Check health and recent deploys before changing customer data.
5. Use request IDs and hashed identifiers from logs. Avoid copying personal information into tickets.
6. Explain what is known, what is not known, the workaround, and the next update time in plain language.
7. Close only after the customer confirms recovery or the behavior is independently reproduced as fixed.

## Customer incident message

> We are investigating a Simeonware service problem that began at [time and timezone]. [Briefly describe what customers cannot do.] We have paused risky changes while we verify data and restore normal service. We will update you again by [time], even if the investigation is still underway. Please do not resend or recreate records unless support asks you to.

Do not promise that data is safe until the database and media checks are complete.

## Restore drill log

| Date (UTC) | Backup object | Restore target | Result | Duration | Performed by | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-14 | `database/2026-07-14T16-40-10Z.dump.gpg` | Neon `simeonware-restore-drill` branch | Passed: 5 users and 39 maintenance requests restored | 39 seconds | Codex for Simeon Berwick | AES-256 archive was 272.17 kB. Preserved request and upload media folders were present. Neon history was set to 7 days, and Vercel Instant Rollback was verified against the previous production deployment without changing production. |

## Provider references

- [Neon projects and restore-window settings](https://neon.com/docs/manage/projects)
- [Neon point-in-time restore](https://neon.com/blog/announcing-point-in-time-restore)
- [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Vercel production rollback guide](https://vercel.com/docs/deployments/rollback-production-deployment)
- [Cloudflare R2 durability](https://developers.cloudflare.com/r2/reference/durability/)
- [GitHub Actions workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
