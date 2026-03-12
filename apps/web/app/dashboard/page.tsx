import { StatusBadge } from '@/components/status-badge'
import { getProperty, getStatusCount, getUnit, requests } from '@/lib/dashboard-data'

export default function DashboardPage() {
  return (
    <div className="stack">
      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">New</div>
          <h2>{getStatusCount('new')}</h2>
          <div className="muted">Needs triage</div>
        </div>
        <div className="card">
          <div className="kicker">Scheduled</div>
          <h2>{getStatusCount('scheduled')}</h2>
          <div className="muted">Vendor date set</div>
        </div>
        <div className="card">
          <div className="kicker">In Progress</div>
          <h2>{getStatusCount('in_progress')}</h2>
          <div className="muted">Active work in flight</div>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="kicker">Inbox</div>
            <h2 style={{ margin: '4px 0 0' }}>Maintenance requests</h2>
          </div>
          <button className="button primary">New request</button>
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
            {requests.map((request) => {
              const property = getProperty(request.propertyId)
              const unit = getUnit(request.unitId)
              return (
                <tr key={request.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{request.title}</div>
                    <div className="muted">{unit?.label} · {request.urgency} urgency</div>
                  </td>
                  <td>
                    <div>{property?.name}</div>
                    <div className="muted">{property?.address}</div>
                  </td>
                  <td>{request.category}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td>{request.assignedVendorName ?? 'Unassigned'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
