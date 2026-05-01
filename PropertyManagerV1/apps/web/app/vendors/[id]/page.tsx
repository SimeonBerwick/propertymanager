import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { VendorForm } from '@/components/vendor-form'
import { getLandlordSession } from '@/lib/landlord-session'
import { getVendorDetailData } from '@/lib/data'
import { StatusBadge } from '@/components/status-badge'
import { AuditLogList } from '@/components/audit-log-list'
import { getAuditLogs } from '@/lib/audit-log'

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params

  const data = await getVendorDetailData(id, session.userId)

  if (!data) notFound()

  const vendor = data.vendor
  const scorecard = data.scorecard
  const auditLogs = await getAuditLogs('vendor', vendor.id)

  return (
    <div className="stack">
      <div className="card stack" style={{ maxWidth: 760 }}>
        <div>
          <div className="kicker">Vendors</div>
          <h2 style={{ margin: '4px 0 0' }}>Edit vendor</h2>
        </div>
        {scorecard ? (
          <div className="grid cols-4">
            <div>
              <div className="kicker">Assignments</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.assignmentCount}</div>
            </div>
            <div>
              <div className="kicker">Avg response</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.avgResponseHours != null ? `${scorecard.avgResponseHours.toFixed(1)}h` : '—'}</div>
            </div>
            <div>
              <div className="kicker">Completion rate</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.completionRate != null ? `${(scorecard.completionRate * 100).toFixed(0)}%` : '—'}</div>
            </div>
            <div>
              <div className="kicker">On-time rate</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.onTimeCompletionRate != null ? `${(scorecard.onTimeCompletionRate * 100).toFixed(0)}%` : '—'}</div>
            </div>
          </div>
        ) : null}
        <VendorForm vendor={vendor} />
      </div>

      <AuditLogList
        title="Vendor changes"
        items={auditLogs.map((item) => ({
          id: item.id,
          action: item.action,
          summary: item.summary,
          createdAt: item.createdAt.toISOString(),
          actorName: item.actorUser?.email ?? undefined,
        }))}
      />

      <section className="card stack">
        <div>
          <div className="kicker">Vendor workload</div>
          <h3 style={{ marginTop: 4 }}>Assigned request history</h3>
        </div>
        {data.requests.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Property</th>
                <th>Status</th>
                <th>Dispatch</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link href={`/requests/${request.id}`} style={{ fontWeight: 600 }}>
                      {request.title}
                    </Link>
                    <div className="muted">{request.unitLabel} · {request.category}</div>
                  </td>
                  <td>
                    <Link href={`/properties/${request.propertyId}`} className="muted">
                      {request.propertyName}
                    </Link>
                  </td>
                  <td><StatusBadge status={request.status} /></td>
                  <td className="muted">{request.dispatchStatus ?? '—'}</td>
                  <td className="muted">{request.reviewState ?? 'none'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No request history for this vendor yet.</div>
        )}
      </section>
    </div>
  )
}
