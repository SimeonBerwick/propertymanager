import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity } from '@/lib/ops-activity'
import { OpsActivityFeed } from '@/components/ops-activity-feed'
import { getTenantIdentityHealthSummary } from '@/lib/tenant-identity-health'

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const { entity, action } = await searchParams
  const [activity, identityHealth] = await Promise.all([
    getOpsActivity(session.userId, 50, {
      entityType: entity || undefined,
      actionPrefix: action || undefined,
    }),
    getTenantIdentityHealthSummary(session.userId),
  ])

  const appUrl = process.env.APP_URL?.replace(/\/$/, '') || null
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || null
  const smsTransport = process.env.SMS_TRANSPORT || 'log'
  const smsReady = smsTransport !== 'twilio'
    ? false
    : !!process.env.TWILIO_ACCOUNT_SID
      && !!process.env.TWILIO_AUTH_TOKEN
      && (!!process.env.TWILIO_FROM_NUMBER || !!process.env.TWILIO_MESSAGING_SERVICE_SID)

  const checks = [
    {
      label: 'Internal automation secret configured',
      ok: !!process.env.INTERNAL_AUTOMATION_SECRET,
      detail: process.env.INTERNAL_AUTOMATION_SECRET ? 'Configured in runtime environment.' : 'Missing INTERNAL_AUTOMATION_SECRET.',
    },
    {
      label: 'App URL consistency',
      ok: !!appUrl && !!publicAppUrl && appUrl === publicAppUrl,
      detail: !appUrl || !publicAppUrl
        ? `APP_URL=${appUrl ?? 'missing'} · NEXT_PUBLIC_APP_URL=${publicAppUrl ?? 'missing'}`
        : appUrl === publicAppUrl
          ? appUrl
          : `Mismatch: APP_URL=${appUrl} · NEXT_PUBLIC_APP_URL=${publicAppUrl}`,
    },
    {
      label: 'Shared rate limit store',
      ok: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
      detail: process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? 'Upstash Redis env vars are configured.'
        : 'Missing Upstash Redis env vars. Rate limiting may fall back to in-memory.',
    },
    {
      label: 'SMS transport readiness',
      ok: smsReady,
      detail: smsTransport !== 'twilio'
        ? `SMS_TRANSPORT=${smsTransport}. OTP SMS delivery is not production-ready.`
        : smsReady
          ? 'Twilio transport is configured.'
          : 'SMS_TRANSPORT=twilio but Twilio credentials/sender are incomplete.',
    },
    {
      label: 'Mobile identity health',
      ok: identityHealth.malformedPhone === 0 && identityHealth.inactive === 0,
      detail: `${identityHealth.total} identities · ${identityHealth.malformedPhone} malformed phones · ${identityHealth.missingEmail} missing emails · ${identityHealth.inactive} inactive`,
    },
    {
      label: 'Notification transport',
      ok: true,
      detail: process.env.NOTIFY_TRANSPORT ? `Using ${process.env.NOTIFY_TRANSPORT}.` : 'Using log transport (dev/default).',
    },
  ]

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Operations</div>
          <h2 style={{ margin: '4px 0 0' }}>Automation health</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This page shows whether the automation path is configured well enough to behave like production.
        </p>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Readiness</div>
          <h3 style={{ marginTop: 4 }}>Runtime checks</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.label}>
                <td>{check.label}</td>
                <td>{check.ok ? 'OK' : 'Missing'}</td>
                <td className="muted">{check.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Activity</div>
          <h3 style={{ marginTop: 4 }}>Cross-entity ops feed</h3>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Link href="/ops" className="button">All</Link>
          <Link href="/ops?entity=request" className="button">Requests</Link>
          <Link href="/ops?entity=tenantIdentity" className="button">Access</Link>
          <Link href="/ops?entity=billingDocument" className="button">Billing</Link>
          <Link href="/ops?entity=vendor" className="button">Vendors</Link>
          <Link href="/ops?action=property." className="button">Lifecycle</Link>
        </div>
        <OpsActivityFeed items={activity} />
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Controls</div>
          <h3 style={{ marginTop: 4 }}>Operator actions</h3>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <Link href="/exceptions" className="button primary">Open exceptions queue</Link>
          <Link href="/reports" className="button">Open reports</Link>
        </div>
      </section>
    </div>
  )
}
