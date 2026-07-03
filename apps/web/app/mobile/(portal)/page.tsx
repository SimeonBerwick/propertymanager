import Link from 'next/link'
import type { Route } from 'next'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getTenantOwnedRequestsForDashboard } from '@/lib/tenant-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { tenantRequestCloseoutLabel, tenantRequestNextStep } from '@/lib/tenant-request-language'

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
  const filter = resolvedSearchParams?.filter === 'open' || resolvedSearchParams?.filter === 'charges' || resolvedSearchParams?.filter === 'all'
    ? resolvedSearchParams.filter
    : 'open'

  const openRequests = requests.filter((request) => !['completed', 'closed', 'declined', 'canceled'].includes(request.status))
  const requestsWithCharges = requests.filter((request) => request.billingDocuments.length > 0)
  const outstandingChargeCount = requests.reduce(
    (sum, request) => sum + request.billingDocuments.filter((document) => Math.max(0, document.totalCents - document.paidCents) > 0).length,
    0,
  )
  const nextAppointment = openRequests
    .filter((request) => request.vendorScheduledStart)
    .sort((a, b) => new Date(a.vendorScheduledStart!).getTime() - new Date(b.vendorScheduledStart!).getTime())[0]

  const filteredRequests = filter === 'open'
    ? openRequests
    : filter === 'charges'
      ? requestsWithCharges
      : requests
  const sectionTitle = filter === 'open'
    ? 'Repairs in progress'
    : filter === 'charges'
      ? 'Requests with tenant charges'
      : 'This unit'

  return (
    <div className="stack">
      {nextAppointment ? (
        <section className="card row tenantStatusSummary" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div className="kicker">Next appointment</div>
            <h2 style={{ margin: '4px 0' }}>{nextAppointment.title}</h2>
            <div>{new Date(nextAppointment.vendorScheduledStart!).toLocaleString()}{nextAppointment.vendorScheduledEnd ? ` to ${new Date(nextAppointment.vendorScheduledEnd).toLocaleString()}` : ''}</div>
          </div>
          <Link href={`/mobile/requests/${nextAppointment.id}#message-manager-vendor` as Route} className="button primary">Message about this appointment</Link>
        </section>
      ) : null}

      <section className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div className="kicker">Need a new repair?</div>
          <h2 style={{ margin: '4px 0' }}>Report a problem</h2>
          <div className="muted">Tell your property manager what happened and add photos in a few steps.</div>
        </div>
        <Link href={'/mobile/requests/new' as Route} className="button">Report a problem</Link>
      </section>

      {requests.length || openRequests.length ? (
      <section className="grid cols-2">
        <Link
          href={'/mobile?filter=open' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'open') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'open') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Repairs in progress</div>
          <h2>{openRequests.length}</h2>
          <div className="muted">See what is happening next</div>
        </Link>
        <Link
          href={'/mobile?filter=all' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'all') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'all') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Repair history</div>
          <h2>{requests.length}</h2>
          <div className="muted">Past and current repairs</div>
        </Link>
      </section>
      ) : null}

      {outstandingChargeCount ? (
        <Link href={'/mobile?filter=charges' as Route} className="notice tenantChargeNotice">
          <strong>{outstandingChargeCount} charge record{outstandingChargeCount === 1 ? ' needs' : 's need'} review</strong>
          <span>View maintenance charge records. Payments are handled outside the app.</span>
        </Link>
      ) : null}

      <section className="card stack">
        <div className="row">
          <div>
            <div className="kicker">Repair status</div>
            <h3 style={{ marginTop: 4 }}>{sectionTitle}</h3>
          </div>
        </div>
        {filteredRequests.length ? filteredRequests.map((request) => (
          <Link key={request.id} href={`/mobile/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {tenantRequestCloseoutLabel(request)}
                  {request.vendorScheduledStart ? ` · Appointment ${new Date(request.vendorScheduledStart).toLocaleString()}` : ''}
                </div>
                <div style={{ marginTop: 6 }}>{tenantRequestNextStep(request)}</div>
                {request.billingDocuments.length ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {request.billingDocuments.map((document) => {
                      const balanceCents = Math.max(0, document.totalCents - document.paidCents)
                      return `${billingStatusLabel(document.status)} charge: ${formatMoney(balanceCents, document.currency)} due`
                    }).join(' · ')}
                  </div>
                ) : null}
              </div>
              <span className="button compactToggle">View details</span>
            </div>
          </Link>
        )) : (
          <div className="emptyState">
            <strong>{filter === 'charges' ? 'No charges to review' : filter === 'open' ? 'No repairs in progress' : 'Nothing needs attention'}</strong>
            <span>
              {filter === 'charges'
                ? 'Tenant charges connected to maintenance requests will appear here.'
                : filter === 'open'
                  ? 'No repair needs action right now. Active repairs will show their next step and appointment details here.'
                  : 'Report a problem when something needs attention in your unit.'}
            </span>
            {filter === 'charges' ? <Link href={'/mobile' as Route} className="button">Back to repairs</Link> : <Link href={'/mobile/requests/new' as Route} className="button primary">Report a problem</Link>}
          </div>
        )}
      </section>
    </div>
  )
}
