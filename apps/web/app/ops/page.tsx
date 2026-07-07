import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity, hasOlderOpsActivity } from '@/lib/ops-activity'
import { OpsActivityFeed } from '@/components/ops-activity-feed'
import { OpsCsvPanel } from '@/components/ops-csv-panel'
import { OpsActionQueue } from '@/components/ops-action-queue'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/data'
import { groupRecommendedActions } from '@/lib/recommended-actions'

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; days?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const { entity, action, days: rawDays } = await searchParams
  const parsedDays = Number(rawDays)
  const days = Number.isInteger(parsedDays) && parsedDays > 0 ? Math.min(parsedDays, 365) : 1
  const createdAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const filters = {
    entityType: entity || undefined,
    actionPrefix: action || undefined,
  }
  const [activity, hasOlderActivity, csvPreference, dashboardData, assignedVendorRequests] = await Promise.all([
    getOpsActivity(session.userId, 5000, { ...filters, createdAfter }),
    hasOlderOpsActivity(session.userId, createdAfter, filters),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { dailyCsvExportEnabled: true, dailyCsvExportLastSentAt: true },
    }),
    getDashboardData(session.userId),
    prisma.maintenanceRequest.findMany({
      where: {
        property: { ownerId: session.userId },
        assignedVendorId: { not: null },
        status: { notIn: ['closed', 'declined', 'canceled'] },
      },
      select: { id: true, title: true, assignedVendorId: true, unit: { select: { label: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const opsActions = dashboardData.masterQueueActions
  const primaryAction = opsActions[0]
  const actionGroups = groupRecommendedActions(opsActions)
  const vendorRequests = assignedVendorRequests.reduce<Record<string, Array<{ id: string; title: string; unitLabel?: string }>>>((groups, request) => {
    if (!request.assignedVendorId) return groups
    const current = groups[request.assignedVendorId] ?? []
    current.push({ id: request.id, title: request.title, unitLabel: request.unit?.label })
    groups[request.assignedVendorId] = current
    return groups
  }, {})

  return (
    <div className="stack">
      <section className="card requestHero">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="kicker">Ops</div>
            <h1 className="pageTitle">{primaryAction ? primaryAction.primaryLabel : 'Ops queue clear'}</h1>
            <div className="muted">
              {primaryAction ? primaryAction.reason : 'No access, delivery, mailbox, or system health actions need attention right now.'}
            </div>
          </div>
          <div className="requestHeroMeta">
            {primaryAction ? (
              <Link href={(primaryAction.href ?? '/ops') as Route} className="button primary">Next step</Link>
            ) : null}
            <Link href="/dashboard" className="button">Dashboard</Link>
            <details className="actionMenu">
              <summary>Ops tools</summary>
              <div className="actionMenuPanel">
                <a href="#ops-tools">CSV and email tools</a>
                <a href="#ops-activity">Activity log</a>
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="todayMetricGrid" aria-label="Ops summary">
        <a href="#ops-actions" className={`card todayMetricCard${opsActions.length ? ' todayMetricUrgent' : ''}`}>
          <span className="kicker">Open actions</span>
          <strong>{opsActions.length}</strong>
          <span className="muted">Operational issues</span>
        </a>
        <a href="#ops-actions" className="card todayMetricCard">
          <span className="kicker">Access</span>
          <strong>{opsActions.filter((action) => action.group === 'Access help' || action.group === 'Access actions').length}</strong>
          <span className="muted">Tenant and vendor access</span>
        </a>
        <a href="#ops-actions" className="card todayMetricCard">
          <span className="kicker">Delivery</span>
          <strong>{opsActions.filter((action) => action.group === 'Email delivery failures' || action.group === 'CSV delivery failures').length}</strong>
          <span className="muted">Email and CSV sends</span>
        </a>
        <a href="#ops-actions" className="card todayMetricCard">
          <span className="kicker">Health</span>
          <strong>{opsActions.filter((action) => action.group === 'Mailbox reconnect issues' || action.group === 'System health').length}</strong>
          <span className="muted">Mailbox and runtime</span>
        </a>
      </section>

      <section id="ops-actions" className="card stack">
        <div>
          <div className="kicker">Next step</div>
          <h3 style={{ marginTop: 4 }}>Operational action queue</h3>
        </div>
        {opsActions.length ? (
          <div className="nextActionGroups">
            {actionGroups.map((group) => (
              <section className="nextActionGroup" key={group.label}>
                <div>
                  <div className="kicker">{group.items.length} action{group.items.length === 1 ? '' : 's'}</div>
                  <h3>{group.label}</h3>
                </div>
                <OpsActionQueue actions={group.items} vendorRequests={vendorRequests} />
              </section>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>Nothing to clear</strong><span>Operational checks are quiet.</span></div>
        )}
      </section>

      <details id="ops-tools" className="advancedDisclosure" open={!opsActions.length}>
        <summary>Open tools, settings, and audit trail</summary>
        <div className="stack" style={{ marginTop: 16 }}>
          <OpsCsvPanel
            dailyExportEnabled={csvPreference?.dailyCsvExportEnabled ?? false}
            dailyExportLastSentAt={csvPreference?.dailyCsvExportLastSentAt?.toISOString()}
          />

      <section id="ops-activity" className="card stack">
        <div>
          <div className="kicker">Audit trail</div>
          <h3 style={{ marginTop: 4 }}>Activity log</h3>
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
        </div>
      </details>
    </div>
  )
}
