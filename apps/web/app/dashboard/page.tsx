import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { getDashboardData } from '@/lib/data'

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="stack">
      <section className="grid cols-4">
        <div className="card">
          <div className="kicker">New</div>
          <h2>{data.statusCounts.new}</h2>
          <div className="muted">Needs triage</div>
        </div>
        <div className="card">
          <div className="kicker">Scheduled</div>
          <h2>{data.statusCounts.scheduled}</h2>
          <div className="muted">Vendor date set</div>
        </div>
        <div className="card">
          <div className="kicker">In Progress</div>
          <h2>{data.statusCounts.in_progress}</h2>
          <div className="muted">Active work in flight</div>
        </div>
        <div className="card">
          <div className="kicker">Done</div>
          <h2>{data.statusCounts.done}</h2>
          <div className="muted">Closed out</div>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="kicker">Inbox</div>
            <h2 style={{ margin: '4px 0 0' }}>Maintenance requests</h2>
          </div>
          <Link href="/submit" className="button primary">
            Tenant issue form
          </Link>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Property</th>
              <th>Category</th>
              <th>Status</th>
              <th>Vendor</th>
            </tr>
          </thead>
          <tbody>
            {data.requestRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  No maintenance requests yet. Use the tenant issue form to submit the first one.
                </td>
              </tr>
            ) : data.requestRows.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link href={`/requests/${request.id}`}>
                    <div style={{ fontWeight: 600 }}>{request.title}</div>
                    <div className="muted">{request.unitLabel} · {request.urgency} urgency</div>
                  </Link>
                </td>
                <td>
                  <Link href={`/properties/${request.propertyId}`}>
                    <div>{request.propertyName}</div>
                    <div className="muted">{request.propertyAddress}</div>
                  </Link>
                </td>
                <td>{request.category}</td>
                <td><StatusBadge status={request.status} /></td>
                <td>{request.assignedVendorName ?? 'Unassigned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
