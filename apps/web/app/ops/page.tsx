import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity } from '@/lib/ops-activity'
import { OpsActivityFeed } from '@/components/ops-activity-feed'

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const { entity, action } = await searchParams
  const activity = await getOpsActivity(session.userId, 50, {
    entityType: entity || undefined,
    actionPrefix: action || undefined,
  })

  const checks = [
    {
      label: 'Internal automation secret configured',
      ok: !!process.env.INTERNAL_AUTOMATION_SECRET,
      detail: process.env.INTERNAL_AUTOMATION_SECRET ? 'Configured in runtime environment.' : 'Missing INTERNAL_AUTOMATION_SECRET.',
    },
    {
      label: 'App URL configured',
      ok: !!process.env.APP_URL,
      detail: process.env.APP_URL ? process.env.APP_URL : 'APP_URL not set; local fallback URLs may be used in messages.',
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
