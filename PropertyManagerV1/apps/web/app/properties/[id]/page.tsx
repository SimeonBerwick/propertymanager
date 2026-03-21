import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPropertyDetailData } from '@/lib/data'
import { StatusBadge } from '@/components/status-badge'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPropertyDetailData(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="kicker">Property</div>
        <h2 style={{ margin: '4px 0' }}>{data.property.name}</h2>
        <div className="muted">{data.property.address}</div>
      </section>

      <section className="grid cols-2">
        <div className="card stack">
          <div>
            <div className="kicker">Units</div>
            <h3 style={{ marginTop: 4 }}>Occupancy and contact</h3>
          </div>
          {data.units.map((unit) => (
            <div key={unit.id} className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{unit.label}</div>
                <div className="muted">{unit.tenantName ?? 'Vacant'}</div>
              </div>
              <div className="muted">{unit.tenantEmail ?? 'No tenant email'}</div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">History</div>
            <h3 style={{ marginTop: 4 }}>Recent maintenance requests</h3>
          </div>
          {data.requests.map((request) => (
            <Link key={request.id} href={`/requests/${request.id}`} className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">{request.unitLabel} · {request.category}</div>
              </div>
              <StatusBadge status={request.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
