import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPropertyDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { languageLabel, unitInfoChips } from '@/lib/types'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StatusBadge } from '@/components/status-badge'
import { AuditLogList } from '@/components/audit-log-list'
import { getAuditLogs } from '@/lib/audit-log'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const { id } = await params
  const data = await getPropertyDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  const openCount = data.requests.filter((r) => !['closed', 'declined', 'canceled'].includes(r.status)).length
  const closedCount = data.requests.filter((r) => ['closed', 'declined', 'canceled'].includes(r.status)).length
  const auditLogs = await getAuditLogs('property', data.property.id)

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Properties', href: '/properties' }, { label: data.property.name }]} />

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Property</div>
            <h2 style={{ margin: '4px 0' }}>{data.property.name}</h2>
            <div className="muted">{data.property.address}</div>
            {!data.property.isActive && (
              <div className="archiveBadge" style={{ marginTop: 8 }}>Archived</div>
            )}
          </div>
          <Link href={`/properties/${data.property.id}/edit`} className="button">Edit property</Link>
        </div>
      </section>

      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Total requests</div>
          <h2>{data.requests.length}</h2>
          <div className="muted">All time</div>
        </div>
        <div className="card">
          <div className="kicker">Open</div>
          <h2>{openCount}</h2>
          <div className="muted">Needs attention</div>
        </div>
        <div className="card">
          <div className="kicker">Closed</div>
          <h2>{closedCount}</h2>
          <div className="muted">Completed</div>
        </div>
      </section>

      <AuditLogList
        title="Lifecycle changes"
        items={auditLogs.map((item) => ({
          id: item.id,
          action: item.action,
          summary: item.summary,
          createdAt: item.createdAt.toISOString(),
          actorName: item.actorUser?.email ?? undefined,
        }))}
      />

      <section className="grid cols-2">
        <div className="card stack">
          <div className="row">
            <div>
              <div className="kicker">Units</div>
              <h3 style={{ marginTop: 4 }}>Occupancy and contact</h3>
            </div>
            <Link href={`/properties/${data.property.id}/units/new`} className="button">Add unit</Link>
          </div>
          {data.units.length === 0 && (
            <div className="emptyState">
              <strong>No units set up</strong>
              <span>Add the first unit so tenant requests and access can be connected to this property.</span>
              <Link href={`/properties/${data.property.id}/units/new`} className="button primary">Add unit</Link>
            </div>
          )}
          {data.units.map((unit) => (
            <div key={unit.id} className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Link href={`/units/${unit.id}`} style={{ fontWeight: 600 }}>{unit.label}</Link>
                  {!unit.isActive && <span className="archiveBadge">Archived</span>}
                </div>
                <div className="muted">{unit.tenantName ?? 'Vacant'}</div>
                {unitInfoChips(unit).length ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                    {unitInfoChips(unit).join(' - ')}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="muted">{unit.tenantEmail ?? 'No tenant email'}</div>
                <Link href={`/units/${unit.id}`} className="button">Access</Link>
                <Link href={`/units/${unit.id}/edit`} className="button">Edit</Link>
              </div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">History</div>
            <h3 style={{ marginTop: 4 }}>Maintenance requests</h3>
          </div>
          {data.requests.length ? data.requests.map((request) => (
            <Link key={request.id} href={`/requests/${request.id}`} className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.unitLabel} - {request.category} - {languageLabel(request.preferredLanguage)}
                </div>
              </div>
              <StatusBadge status={request.status} />
            </Link>
          )) : (
            <div className="emptyState">
              <strong>No requests for this property</strong>
              <span>Once tenants submit maintenance issues for this property, they will appear here.</span>
              <Link href="/submit" className="button">Open request form</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
