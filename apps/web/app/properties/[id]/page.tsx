import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPropertyDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { StatusBadge } from '@/components/status-badge'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params
  const data = await getPropertyDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  const openCount = data.requests.filter((r) => r.status !== 'done').length
  const closedCount = data.requests.filter((r) => r.status === 'done').length

  return (
    <div className="stack">
      <section className="card">
        <div className="kicker">Property</div>
        <h2 style={{ margin: '4px 0' }}>{data.property.name}</h2>
        <div className="muted">{data.property.address}</div>
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
            <div className="muted">No units added yet.</div>
          )}
          {data.units.map((unit) => (
            <div key={unit.id} className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <Link href={`/units/${unit.id}`} style={{ fontWeight: 600 }}>{unit.label}</Link>
                <div className="muted">{unit.tenantName ?? 'Vacant'}</div>
              </div>
              <div className="muted">{unit.tenantEmail ?? 'No tenant email'}</div>
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
                <div className="muted">{request.unitLabel} · {request.category}</div>
              </div>
              <StatusBadge status={request.status} />
            </Link>
          )) : (
            <div className="muted">No maintenance requests for this property yet.</div>
          )}
        </div>
      </section>
    </div>
  )
}
