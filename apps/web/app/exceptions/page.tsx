import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { SendSummaryForm } from './send-summary-form'

export default async function ExceptionsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getDashboardData(session.userId)

  const exceptionRequests = data.requestRows.filter((request) =>
    request.autoFlag || (request.reviewState && request.reviewState !== 'none'),
  )

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Mission Control</div>
          <h2 style={{ margin: '4px 0 0' }}>Exceptions</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This is the operator queue for auto-flagged and review-blocked requests.
        </p>
        <SendSummaryForm />
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Exception queue</div>
          <h3 style={{ marginTop: 4 }}>Requests needing active operator attention</h3>
        </div>
        {exceptionRequests.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Property</th>
                <th>Auto flag</th>
                <th>Review state</th>
              </tr>
            </thead>
            <tbody>
              {exceptionRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link href={`/requests/${request.id}`} style={{ fontWeight: 600 }}>
                      {request.title}
                    </Link>
                    <div className="muted">{request.unitLabel}</div>
                  </td>
                  <td>
                    <Link href={`/properties/${request.propertyId}`} className="muted">
                      {request.propertyName}
                    </Link>
                  </td>
                  <td>{request.autoFlag ?? '—'}</td>
                  <td>{request.reviewState ?? 'none'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No active exceptions right now.</div>
        )}
      </section>
    </div>
  )
}
