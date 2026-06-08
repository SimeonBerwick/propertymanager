import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity, hasOlderOpsActivity } from '@/lib/ops-activity'
import { getRuntimeChecks, isHostedRuntimeEnforced } from '@/lib/runtime-env'
import { OpsActivityFeed } from '@/components/ops-activity-feed'
import { OpsCsvPanel } from '@/components/ops-csv-panel'

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; days?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const { entity, action, days: rawDays } = await searchParams
  const parsedDays = Number(rawDays)
  const days = Number.isInteger(parsedDays) && parsedDays > 0 ? Math.min(parsedDays, 365) : 1
  const createdAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const filters = {
    entityType: entity || undefined,
    actionPrefix: action || undefined,
  }
  const [activity, hasOlderActivity] = await Promise.all([
    getOpsActivity(session.userId, 5000, { ...filters, createdAfter }),
    hasOlderOpsActivity(session.userId, createdAfter, filters),
  ])

  const checks = getRuntimeChecks()
  const blockingFailures = checks.filter((check) => check.blocking && !check.ok)

  return (
    <div className="stack">
      <OpsCsvPanel />

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
          <div className="muted">Showing the last {days === 1 ? 'day' : `${days} days`}.</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Link href={`/ops?days=${days}`} className="button">All</Link>
          <Link href={`/ops?entity=request&days=${days}`} className="button">Requests</Link>
          <Link href={`/ops?entity=tenantIdentity&days=${days}`} className="button">Access</Link>
          <Link href={`/ops?entity=billingDocument&days=${days}`} className="button">Billing</Link>
          <Link href={`/ops?entity=vendor&days=${days}`} className="button">Vendors</Link>
          <Link href={`/ops?action=property.&days=${days}`} className="button">Lifecycle</Link>
        </div>
        <OpsActivityFeed items={activity} />
        {hasOlderActivity ? (
          <Link
            href={`/ops?${new URLSearchParams({
              ...(entity ? { entity } : {}),
              ...(action ? { action } : {}),
              days: String(Math.min(days + 7, 365)),
            }).toString()}`}
            className="button"
            style={{ alignSelf: 'flex-start' }}
          >
            Show previous week
          </Link>
        ) : null}
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
