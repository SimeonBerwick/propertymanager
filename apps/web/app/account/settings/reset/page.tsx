import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { WorkspaceResetForm } from './workspace-reset-form'

export default async function WorkspaceResetPage() {
  const session = await getLandlordSession({ allowWorkspaceResetPending: true })
  if (!session) redirect('/login?error=session-expired')

  const [pendingRequest, counts] = await Promise.all([
    prisma.workspaceResetRequest.findFirst({
      where: { userId: session.userId, status: 'pending' },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, scheduledFor: true },
    }),
    Promise.all([
      prisma.property.count({ where: { ownerId: session.userId } }),
      prisma.unit.count({ where: { property: { ownerId: session.userId } } }),
      prisma.maintenanceRequest.count({ where: { property: { ownerId: session.userId } } }),
    ]),
  ])

  if (!pendingRequest && session.workspaceResetPending) {
    redirect('/account/settings/reset/resume' as never)
  }

  return (
    <main className="stack" style={{ maxWidth: 780 }}>
      <section className="card stack">
        <div>
          <div className="kicker">Privacy and data</div>
          <h2 className="sectionTitle">Reset workspace data</h2>
          <div className="muted">Keep your account and subscription, but permanently clear the current portfolio.</div>
        </div>
        <div className="notice">
          This workspace currently contains {counts[0]} {counts[0] === 1 ? 'property' : 'properties'}, {counts[1]} {counts[1] === 1 ? 'unit' : 'units'}, and {counts[2]} maintenance {counts[2] === 1 ? 'request' : 'requests'}.
        </div>
        <p className="muted" style={{ margin: 0 }}>
          A reset removes properties, units, resident and vendor records, staff, work orders, inspections, messages, uploads, reports, schedules, portal access, and connected integrations. It does not cancel billing or change your plan.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Your login, company account, subscription, Stripe billing relationship, purchased unit allowance, language, and legal consent records remain. Subscription billing, security, fraud-prevention, and legally required records may also be retained in minimized form.
        </p>
        {!pendingRequest ? (
          <p className="muted" style={{ margin: 0 }}>
            Download any reports or CSV records you need from <Link href="/ops">Data and activity</Link> before submitting this request. The workspace becomes read-only immediately and the reset runs after a 24-hour cancellation period.
          </p>
        ) : null}
      </section>

      <section className="card stack">
        <WorkspaceResetForm pendingReset={pendingRequest ? { scheduledFor: pendingRequest.scheduledFor.toISOString() } : null} />
        {!pendingRequest ? <Link href="/account/settings" className="button" style={{ alignSelf: 'flex-start' }}>Back to settings</Link> : null}
      </section>
    </main>
  )
}
