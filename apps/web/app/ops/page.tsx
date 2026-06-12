import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { getOpsActivity, hasOlderOpsActivity } from '@/lib/ops-activity'
import { OpsActivityFeed } from '@/components/ops-activity-feed'
import { OpsCsvPanel } from '@/components/ops-csv-panel'
import { prisma } from '@/lib/prisma'

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
  const [activity, hasOlderActivity, csvPreference] = await Promise.all([
    getOpsActivity(session.userId, 5000, { ...filters, createdAfter }),
    hasOlderOpsActivity(session.userId, createdAfter, filters),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { dailyCsvExportEnabled: true, dailyCsvExportLastSentAt: true },
    }),
  ])

  return (
    <div className="stack">
      <OpsCsvPanel
        dailyExportEnabled={csvPreference?.dailyCsvExportEnabled ?? false}
        dailyExportLastSentAt={csvPreference?.dailyCsvExportLastSentAt?.toISOString()}
      />

      <section className="card stack">
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
  )
}
