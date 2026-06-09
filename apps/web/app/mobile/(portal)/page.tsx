import Link from 'next/link'
import type { Route } from 'next'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestsForDashboard } from '@/lib/tenant-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { languageLabel } from '@/lib/types'

type TenantDashboardFilter = 'open' | 'all' | 'charges'

function isActiveFilter(current: TenantDashboardFilter, target: TenantDashboardFilter) {
  return current === target
}

export default async function TenantMobileDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const session = await requireTenantMobileSession()
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const requests = await getTenantOwnedRequestsForDashboard(session)
  const filter = resolvedSearchParams?.filter === 'open' || resolvedSearchParams?.filter === 'charges'
    ? resolvedSearchParams.filter
    : 'all'

  const openRequests = requests.filter((request) => !['closed', 'declined', 'canceled'].includes(request.status))
  const requestsWithCharges = requests.filter((request) => request.billingDocuments.length > 0)
  const outstandingChargeCount = requests.reduce(
    (sum, request) => sum + request.billingDocuments.filter((document) => Math.max(0, document.totalCents - document.paidCents) > 0).length,
    0,
  )
  const filteredRequests = filter === 'open'
    ? openRequests
    : filter === 'charges'
      ? requestsWithCharges
      : requests
  const sectionTitle = filter === 'open'
    ? 'Open requests'
    : filter === 'charges'
      ? 'Requests with tenant charges'
      : 'This unit'

  return (
    <div className="stack">
      <section className="grid cols-3">
        <Link
          href={'/mobile?filter=open' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'open') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'open') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Open requests</div>
          <h2>{openRequests.length}</h2>
          <div className="muted">Active now</div>
        </Link>
        <Link
          href={'/mobile?filter=all' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'all') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'all') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">All requests</div>
          <h2>{requests.length}</h2>
          <div className="muted">Full history</div>
        </Link>
        <Link
          href={'/mobile?filter=charges' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'charges') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'charges') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Tenant charges</div>
          <h2>{outstandingChargeCount}</h2>
          <div className="muted">{requestsWithCharges.length} request{requestsWithCharges.length === 1 ? '' : 's'} with visible tenant invoices</div>
        </Link>
      </section>

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Requests</div>
            <h3 style={{ marginTop: 4 }}>{sectionTitle}</h3>
          </div>
        </div>
        {filteredRequests.length ? filteredRequests.map((request) => (
          <Link key={request.id} href={`/mobile/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.category} · {request.urgency} urgency · {languageLabel(request.preferredLanguage)}
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
          <div className="muted">
            {filter === 'open'
              ? 'No open requests right now.'
              : filter === 'charges'
                ? 'No requests with tenant charges right now.'
                : 'No requests yet.'}
          </div>
        )}
      </section>
    </div>
  )
}
