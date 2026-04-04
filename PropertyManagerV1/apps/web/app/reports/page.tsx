import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getReportData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { StatusBadge } from '@/components/status-badge'
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
