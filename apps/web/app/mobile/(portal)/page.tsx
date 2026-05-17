import Link from 'next/link'
import type { Route } from 'next'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestsForDashboard } from '@/lib/tenant-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { currencyLabel, languageLabel } from '@/lib/types'

export default async function TenantMobileDashboardPage() {
  const session = await requireTenantMobileSession()

  const requests = await getTenantOwnedRequestsForDashboard(session)

  const openRequests = requests.filter((request) => !['closed', 'declined', 'canceled'].includes(request.status))
  const requestsWithCharges = requests.filter((request) => request.billingDocuments.length > 0)
  const outstandingChargeCount = requests.reduce(
    (sum, request) => sum + request.billingDocuments.filter((document) => Math.max(0, document.totalCents - document.paidCents) > 0).length,
    0,
  )

  return (
    <div className="stack">
      <section className="grid cols-3">
        <div className="card">
          <div className="kicker">Open requests</div>
          <h2>{openRequests.length}</h2>
          <div className="muted">Active now</div>
        </div>
        <div className="card">
          <div className="kicker">All requests</div>
          <h2>{requests.length}</h2>
          <div className="muted">Full history</div>
        </div>
        <div className="card">
          <div className="kicker">Tenant charges</div>
          <h2>{outstandingChargeCount}</h2>
          <div className="muted">{requestsWithCharges.length} request{requestsWithCharges.length === 1 ? '' : 's'} with visible tenant invoices</div>
        </div>
      </section>

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Requests</div>
            <h3 style={{ marginTop: 4 }}>This unit</h3>
          </div>
        </div>
        {requests.length ? requests.map((request) => (
          <Link key={request.id} href={`/mobile/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.category} · {request.urgency} urgency · {currencyLabel(request.preferredCurrency)} · {languageLabel(request.preferredLanguage)}
                  {request.vendorScheduledStart ? ` · Visit ${new Date(request.vendorScheduledStart).toLocaleString()}` : ''}
                </div>
                {request.billingDocuments.length ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {request.billingDocuments.map((document) => {
                      const balanceCents = Math.max(0, document.totalCents - document.paidCents)
                      return `${billingStatusLabel(document.status)} charge: ${formatMoney(balanceCents, document.currency)} due`
                    }).join(' · ')}
                  </div>
                ) : null}
              </div>
              <div className="muted">{request.status.replace('_', ' ')}</div>
            </div>
          </Link>
        )) : (
          <div className="muted">No requests yet.</div>
        )}
      </section>
    </div>
  )
}
