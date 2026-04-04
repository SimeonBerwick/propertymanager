import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { getDashboardData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { currencyLabel, languageLabel } from '@/lib/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ currency?: string; language?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const data = await getDashboardData(session.userId)
  const params = searchParams ? await searchParams : undefined
  const selectedCurrency = params?.currency ?? 'all'
  const selectedLanguage = params?.language ?? 'all'

  const filteredRequests = data.requestRows.filter((request) => {
    const currencyMatch = selectedCurrency === 'all' || request.preferredCurrency === selectedCurrency
    const languageMatch = selectedLanguage === 'all' || request.preferredLanguage === selectedLanguage
    return currencyMatch && languageMatch
  })

  const nonEnglishOpen = data.requestRows.filter(
    (request) => request.status !== 'done' && request.preferredLanguage !== 'english',
  )

  const nonUsdOpen = data.requestRows.filter(
    (request) => request.status !== 'done' && request.preferredCurrency !== 'usd',
  )

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

      <section className="grid cols-2">
        <div className="card">
          <div className="kicker">Language queue</div>
          <h3 style={{ margin: '4px 0' }}>{nonEnglishOpen.length}</h3>
          <div className="muted">Open requests with non-English language preferences</div>
        </div>
        <div className="card">
          <div className="kicker">Currency queue</div>
          <h3 style={{ margin: '4px 0' }}>{nonUsdOpen.length}</h3>
          <div className="muted">Open requests using Peso, Pound, or Euro</div>
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

        <form method="get" className="row" style={{ gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Currency</span>
            <select className="input" name="currency" defaultValue={selectedCurrency}>
              <option value="all">All currencies</option>
              <option value="usd">US Dollar</option>
              <option value="peso">Peso</option>
              <option value="pound">Pound</option>
              <option value="euro">Euro</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Language</span>
            <select className="input" name="language" defaultValue={selectedLanguage}>
              <option value="all">All languages</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </label>
          <button type="submit" className="button">Apply filters</button>
          <Link href="/dashboard" className="button">Clear</Link>
        </form>

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
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  No maintenance requests match the current filters.
                </td>
              </tr>
            ) : filteredRequests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link href={`/requests/${request.id}`}>
                    <div style={{ fontWeight: 600 }}>{request.title}</div>
                    <div className="muted">
                      {request.unitLabel} · {request.urgency} urgency · {currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)}
                    </div>
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
