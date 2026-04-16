import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getReportData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { StatusBadge } from '@/components/status-badge'
import { TrendChart } from '@/components/trend-chart'
import { currencyLabel, languageLabel } from '@/lib/types'

function ageBadgeClass(days: number) {
  if (days < 7) return 'badge age-fresh'
  if (days < 14) return 'badge age-warn'
  return 'badge age-old'
}

export default async function ReportsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getReportData(session.userId)
  const totalRequests = data.propertyStats.reduce((sum, p) => sum + p.totalCount, 0)

  return (
    <div className="stack">
      <section className="card">
        <div className="kicker">Reporting</div>
        <h2 style={{ margin: '4px 0 0' }}>History &amp; reporting</h2>
      </section>

      {/* ── Summary stat row ── */}
      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Total requests</div>
          <h2>{totalRequests}</h2>
          <div className="muted">All time</div>
        </div>
        <div className="card">
          <div className="kicker">Open</div>
          <h2>{data.totalOpen}</h2>
          <div className="muted">Needs attention</div>
        </div>
        <div className="card">
          <div className="kicker">Closed</div>
          <h2>{data.totalClosed}</h2>
          <div className="muted">Completed</div>
        </div>
      </section>

      <section className="grid cols-4">
        <div className="card">
          <div className="kicker">Time to assign</div>
          <h2>{data.avgTimeToAssignHours ? `${data.avgTimeToAssignHours.toFixed(1)}h` : '—'}</h2>
          <div className="muted">Average from intake to assignment</div>
        </div>
        <div className="card">
          <div className="kicker">Time to first review</div>
          <h2>{data.avgTimeToFirstReviewHours ? `${data.avgTimeToFirstReviewHours.toFixed(1)}h` : '—'}</h2>
          <div className="muted">Average from intake to first operator review</div>
        </div>
        <div className="card">
          <div className="kicker">Time to schedule</div>
          <h2>{data.avgTimeToScheduleHours ? `${data.avgTimeToScheduleHours.toFixed(1)}h` : '—'}</h2>
          <div className="muted">Average from intake to visit window</div>
        </div>
        <div className="card">
          <div className="kicker">Time to complete</div>
          <h2>{data.avgTimeToCompleteDays ? `${data.avgTimeToCompleteDays.toFixed(1)}d` : '—'}</h2>
          <div className="muted">Average request cycle time</div>
        </div>
      </section>

      <section className="grid cols-3">
        <Link href="/dashboard?queue=unclaimed" className="card" style={{ textDecoration: 'none' }}>
          <div className="kicker">Unclaimed open</div>
          <h2>{data.unclaimedOpenCount}</h2>
          <div className="muted">Open requests still waiting for an owner</div>
        </Link>
        <Link href="/dashboard?queue=stale-claimed" className="card" style={{ textDecoration: 'none' }}>
          <div className="kicker">Stale claimed open</div>
          <h2>{data.staleClaimedOpenCount}</h2>
          <div className="muted">Claimed open requests drifting past 24 hours</div>
        </Link>
        <Link href="/dashboard?queue=follow-up" className="card" style={{ textDecoration: 'none' }}>
          <div className="kicker">Avg open claim age</div>
          <h2>{data.avgClaimAgeHoursOpen ? `${data.avgClaimAgeHoursOpen.toFixed(1)}h` : '—'}</h2>
          <div className="muted">Average age of currently claimed open requests</div>
        </Link>
      </section>

      <section className="grid cols-1">
        <Link href="/dashboard?queue=follow-up" className="card" style={{ textDecoration: 'none' }}>
          <div className="kicker">Reopened</div>
          <h2>{data.reopenCount}</h2>
          <div className="muted">Requests reopened after review</div>
        </Link>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Trends</div>
          <h3 style={{ marginTop: 4 }}>Daily workflow trend, last 14 days</h3>
        </div>
        {data.trends.length ? (
          <>
            <TrendChart points={data.trends} />
            <table className="table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Created</th>
                  <th>First reviewed</th>
                  <th>Claimed</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.map((point) => (
                  <tr key={point.day}>
                    <td>{point.day}</td>
                    <td>{point.created}</td>
                    <td>{point.firstReviewed}</td>
                    <td>{point.claimed}</td>
                    <td>{point.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="muted">No trend data yet.</div>
        )}
      </section>

      {/* ── Open vs closed by property ── */}
      <section className="card stack">
        <div>
          <div className="kicker">By property</div>
          <h3 style={{ marginTop: 4 }}>Open vs closed breakdown</h3>
        </div>
        {data.propertyStats.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Total</th>
                <th>Open</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {data.propertyStats.map((p) => (
                <tr key={p.propertyId}>
                  <td>
                    <Link href={`/properties/${p.propertyId}`}>
                      <div style={{ fontWeight: 600 }}>{p.propertyName}</div>
                      <div className="muted">{p.propertyAddress}</div>
                    </Link>
                  </td>
                  <td>{p.totalCount}</td>
                  <td>
                    {p.openCount > 0
                      ? <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.openCount}</span>
                      : <span className="muted">0</span>
                    }
                  </td>
                  <td>{p.closedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No properties found.</div>
        )}
      </section>

      {/* ── Aging view ── */}
      <section className="card stack">
        <div>
          <div className="kicker">Aging</div>
          <h3 style={{ marginTop: 4 }}>Open requests by age</h3>
        </div>
        {data.agingRequests.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Property · Unit</th>
                <th>Category</th>
                <th>Preferences</th>
                <th>Urgency</th>
                <th>Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.agingRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requests/${r.id}`} style={{ fontWeight: 600 }}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="muted">{r.propertyName} · {r.unitLabel}</td>
                  <td className="muted">{r.category}</td>
                  <td className="muted">{currencyLabel(r.preferredCurrency)} · {languageLabel(r.preferredLanguage)}</td>
                  <td className="muted">{r.urgency}</td>
                  <td>
                    <span className={ageBadgeClass(r.ageDays)}>
                      {r.ageDays}d
                    </span>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No open requests. All clear.</div>
        )}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Operator ownership</div>
          <h3 style={{ marginTop: 4 }}>Queue load by operator</h3>
        </div>
        {data.operatorMetrics.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Open claims</th>
                <th>Stale claims</th>
                <th>Avg claim age</th>
                <th>Completed claims</th>
              </tr>
            </thead>
            <tbody>
              {data.operatorMetrics.map((operator) => (
                <tr key={operator.operatorId}>
                  <td>
                    <Link href={`/dashboard?queue=my-claims&claimedBy=${operator.operatorId}`} style={{ fontWeight: 600 }}>
                      {operator.operatorName}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/dashboard?queue=my-claims&claimedBy=${operator.operatorId}`}>
                      {operator.openClaims}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/dashboard?queue=stale-claimed&claimedBy=${operator.operatorId}`}>
                      {operator.staleClaims}
                    </Link>
                  </td>
                  <td>{operator.avgClaimAgeHours ? `${operator.avgClaimAgeHours.toFixed(1)}h` : '—'}</td>
                  <td>{operator.completedClaims}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No operator claim data yet.</div>
        )}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Vendor scorecards</div>
          <h3 style={{ marginTop: 4 }}>Assignment and completion performance</h3>
        </div>
        {data.vendorScorecards.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Assignments</th>
                <th>Accepted</th>
                <th>Declined</th>
                <th>Completed</th>
                <th>Avg completion</th>
              </tr>
            </thead>
            <tbody>
              {data.vendorScorecards.map((vendor) => (
                <tr key={vendor.vendorId}>
                  <td>
                    <Link href={`/vendors/${vendor.vendorId}`} style={{ fontWeight: 600 }}>
                      {vendor.vendorName}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/vendors/${vendor.vendorId}`}>
                      {vendor.assignmentCount}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/vendors/${vendor.vendorId}`}>
                      {vendor.acceptedCount}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/vendors/${vendor.vendorId}`}>
                      {vendor.declinedCount}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/vendors/${vendor.vendorId}`}>
                      {vendor.completedCount}
                    </Link>
                  </td>
                  <td>{vendor.avgCompletionDays ? `${vendor.avgCompletionDays.toFixed(1)}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No vendor performance data yet.</div>
        )}
      </section>

      {/* ── Repeat issue flags ── */}
      <section className="card stack">
        <div>
          <div className="kicker">Repeat issues</div>
          <h3 style={{ marginTop: 4 }}>Units with recurring problems</h3>
        </div>
        {data.repeatIssues.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Property</th>
                <th>Category</th>
                <th>Occurrences</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {data.repeatIssues.map((issue) => (
                <tr key={`${issue.unitId}-${issue.category}`}>
                  <td>
                    <Link href={`/units/${issue.unitId}`} style={{ fontWeight: 600 }}>
                      {issue.unitLabel}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/properties/${issue.propertyId}`} className="muted">
                      {issue.propertyName}
                    </Link>
                  </td>
                  <td>{issue.category}</td>
                  <td>
                    <span className="badge age-old">{issue.count}×</span>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 4 }}>
                      {issue.requestIds.map((id, i) => (
                        <Link key={id} href={`/requests/${id}`} style={{ fontSize: 13 }}>
                          {issue.requestTitles[i] ?? `Request ${i + 1}`}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">No repeat issues detected. Good news.</div>
        )}
      </section>
    </div>
  )
}
