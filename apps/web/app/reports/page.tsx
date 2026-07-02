import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getReportData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'

function ageBadgeClass(days: number) {
  if (days < 7) return 'badge age-fresh'
  if (days < 14) return 'badge age-warn'
  return 'badge age-old'
}

function percent(value: number | null) {
  return value != null ? (value * 100).toFixed(0) + '%' : 'Not enough data'
}

export default async function ReportsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const data = await getReportData(session.userId)
  const propertiesWithOpenWork = data.propertyStats.filter((property) => property.openCount > 0)
  const agingRequests = data.agingRequests.slice(0, 8)
  const vendorScorecards = data.vendorScorecards.slice(0, 8)
  const repeatIssues = data.repeatIssues.slice(0, 8)

  return (
    <div className="stack reportsPage">
      <section className="card reportsHero">
        <div className="kicker">Reports</div>
        <h2 style={{ margin: '4px 0 0' }}>Where work needs attention</h2>
        <div className="muted">Use reports to find aging requests, busy properties, vendor performance issues, and repeat problems.</div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Open work by property</div>
          <h3 style={{ marginTop: 4 }}>Properties with active maintenance</h3>
        </div>
        {propertiesWithOpenWork.length ? (
          <div className="grid cols-3">
            {propertiesWithOpenWork.map((property) => (
              <Link href={('/properties/' + property.propertyId) as Route} key={property.propertyId} className="card" style={{ textDecoration: 'none' }}>
                <div className="kicker">{property.openCount} open</div>
                <h3 style={{ margin: '4px 0' }}>{property.propertyName}</h3>
                <div className="muted">{property.propertyAddress}</div>
                <div className="muted">{property.closedCount} closed / {property.totalCount} total</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>No open property workload</strong><span>Properties with active maintenance will appear here.</span></div>
        )}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Aging work</div>
          <h3 style={{ marginTop: 4 }}>Oldest open requests</h3>
        </div>
        {agingRequests.length ? (
          <div className="todayCompactList">
            {agingRequests.map((request) => (
              <Link href={('/requests/' + request.id) as Route} key={request.id} className="todayCompactRow">
                <div>
                  <strong>{request.title}</strong>
                  <div className="muted">{request.propertyName} / {request.unitLabel}</div>
                  <div className="muted">{request.category} / {request.urgency} urgency / {request.status.replaceAll('_', ' ')}</div>
                </div>
                <span className={ageBadgeClass(request.ageDays)}>{request.ageDays}d</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>No aging open work</strong><span>All open requests are currently clear.</span></div>
        )}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Vendor performance</div>
          <h3 style={{ marginTop: 4 }}>Response and completion signals</h3>
        </div>
        {vendorScorecards.length ? (
          <div className="grid cols-3">
            {vendorScorecards.map((vendor) => (
              <Link href={('/vendors/' + vendor.vendorId) as Route} key={vendor.vendorId} className="card" style={{ textDecoration: 'none' }}>
                <div className="kicker">{vendor.assignmentCount} assignment{vendor.assignmentCount === 1 ? '' : 's'}</div>
                <h3 style={{ margin: '4px 0' }}>{vendor.vendorName}</h3>
                <div className="muted">Avg response: {vendor.avgResponseHours != null ? vendor.avgResponseHours.toFixed(1) + 'h' : 'Not enough data'}</div>
                <div className="muted">Completion: {percent(vendor.completionRate)}</div>
                <div className="muted">On time: {percent(vendor.onTimeCompletionRate)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>No vendor performance yet</strong><span>Vendor response and completion signals appear after work is assigned and completed.</span></div>
        )}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Repeat issues</div>
          <h3 style={{ marginTop: 4 }}>Units with recurring problems</h3>
        </div>
        {repeatIssues.length ? (
          <div className="todayCompactList">
            {repeatIssues.map((issue) => (
              <div key={issue.unitId + '-' + issue.category} className="todayCompactRow">
                <div>
                  <strong>{issue.unitLabel}</strong>
                  <div className="muted">{issue.propertyName} / {issue.category}</div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {issue.requestIds.slice(0, 3).map((id, index) => (
                      <Link key={id} href={('/requests/' + id) as Route} className="filterChip">
                        {issue.requestTitles[index] ?? 'Request ' + (index + 1)}
                      </Link>
                    ))}
                  </div>
                </div>
                <span className="badge age-old">{issue.count}x</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState"><strong>No repeat issues detected</strong><span>Recurring unit/category problems will appear here when patterns emerge.</span></div>
        )}
      </section>
    </div>
  )
}
