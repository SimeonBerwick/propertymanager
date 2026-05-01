import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity } from '@/lib/ops-activity'
import { getRuntimeChecks, isHostedRuntimeEnforced } from '@/lib/runtime-env'
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

  const checks = getRuntimeChecks()
  const blockingFailures = checks.filter((check) => check.blocking && !check.ok)

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Operations</div>
          <h2 style={{ margin: '4px 0 0' }}>Runtime health</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This page shows whether hosted runtime is actually ready.
        </p>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Readiness</div>
          <h3 style={{ marginTop: 4 }}>Runtime checks</h3>
        </div>
        <div className="muted">
          Mode: {isHostedRuntimeEnforced() ? 'hosted production enforcement' : 'local/dev advisory only'}
        </div>
        {blockingFailures.length ? (
          <div className="badge overdue" style={{ width: 'fit-content' }}>
            Blocking hosted failures: {blockingFailures.length}
          </div>
        ) : (
          <div className="badge done" style={{ width: 'fit-content' }}>
            No blocking hosted failures detected
          </div>
        )}
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
                <td>{check.ok ? 'OK' : check.blocking ? 'BLOCKED' : 'Advisory'}</td>
                <td className="muted">{check.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Activity</div>
          <h3 style={{ marginTop: 4 }}>Ops feed</h3>
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
          <h3 style={{ marginTop: 4 }}>Actions</h3>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <Link href="/exceptions" className="button primary">Exceptions</Link>
          <Link href="/reports" className="button">Reports</Link>
        </div>
      </section>
    </div>
  )
}
