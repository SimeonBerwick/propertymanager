import Link from 'next/link'
import type { Route } from 'next'
import { requireVendorSession } from '@/lib/vendor-session'
import { getVendorCommercialSummary, getVendorRequestsForDashboard } from '@/lib/vendor-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { vendorSignoutAction } from './auth/signout/actions'
import { vendorCommercialTypeLabel } from '@/lib/vendor-commercial-types'
import { deriveVendorRequestViewState } from '@/lib/vendor-request-state'
import { PushNotificationControl } from '@/components/push-notification-control'

type VendorDashboardFilter = 'open' | 'bids' | 'billing' | 'commercial'

function isActiveFilter(current: VendorDashboardFilter, target: VendorDashboardFilter) {
  return current === target
}

function isVendorRemittancePaidInFull(request: { billingDocuments: Array<{ status: string, totalCents: number, paidCents: number }> }) {
  const remittances = request.billingDocuments
  return remittances.length > 0 && remittances.every((document) => document.status === 'paid' || Math.max(0, document.totalCents - document.paidCents) === 0)
}

export default async function VendorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const session = await requireVendorSession()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const [requests, commercialItems] = await Promise.all([
    getVendorRequestsForDashboard(session),
    getVendorCommercialSummary(session),
  ])
  const filter = resolvedSearchParams?.filter === 'open'
    || resolvedSearchParams?.filter === 'bids'
    || resolvedSearchParams?.filter === 'billing'
    || resolvedSearchParams?.filter === 'commercial'
    ? resolvedSearchParams.filter
    : 'open'

  const requestViews = requests.map((request) => ({
    request,
    viewState: deriveVendorRequestViewState({
      assignedVendorId: request.assignedVendorId,
      requestStatus: request.status,
      viewerVendorId: session.vendorId,
      latestInvite: request.tenderInvites[0],
      vendorPaidInFull: isVendorRemittancePaidInFull(request),
    }),
  }))
  const openRequests = requestViews.filter(({ request, viewState }) => viewState.isOpenWork && !['closed', 'declined', 'canceled', 'completed'].includes(request.status))
  const pendingBids = requestViews.filter(({ viewState }) => viewState.isPendingBid)
  const awardedRequests = openRequests.filter(({ viewState }) => viewState.isAwardedToViewer)
  const scheduledVisits = openRequests.filter(({ request, viewState }) => viewState.canSeeSchedule && request.vendorScheduledStart)
  const requiredUpdates = openRequests.filter(({ viewState }) => viewState.canControlDispatch)
  const attentionItems = [
    ...pendingBids.map((item) => ({ ...item, attentionLabel: 'Respond to bid invite' })),
    ...awardedRequests.map((item) => ({ ...item, attentionLabel: 'Send an update on awarded work' })),
    ...scheduledVisits.map((item) => ({ ...item, attentionLabel: 'Prepare for scheduled visit' })),
    ...requiredUpdates.map((item) => ({ ...item, attentionLabel: 'Update work status' })),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.request.id === item.request.id) === index).slice(0, 5)
  const billingRequests = requests.filter((request) => request.billingDocuments.length > 0)
  const payableDocs = requests.reduce((sum, request) => sum + request.billingDocuments.length, 0)
  const commercialCount = commercialItems.length
  const filteredRequests = filter === 'open'
    ? openRequests
    : filter === 'bids'
      ? pendingBids
      : filter === 'billing'
        ? billingRequests.map((request) => ({
            request,
            viewState: deriveVendorRequestViewState({
              assignedVendorId: request.assignedVendorId,
              requestStatus: request.status,
              viewerVendorId: session.vendorId,
              latestInvite: request.tenderInvites[0],
              vendorPaidInFull: isVendorRemittancePaidInFull(request),
            }),
          }))
        : []
  const sectionTitle = filter === 'open'
    ? 'Open work'
    : filter === 'bids'
      ? 'Pending bids'
      : filter === 'billing'
        ? 'Requests with billing docs'
        : 'Submitted commercial items'

  return (
    <div className="stack">
      <section className="card row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="kicker">Vendor portal</div>
          <h2 style={{ marginTop: 4 }}>{session.vendorName}</h2>
          <div className="muted">{session.email ?? 'No email on file'}</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <PushNotificationControl />
          <Link href={'/support' as Route} className="button">Support</Link>
          <form action={vendorSignoutAction}>
            <button type="submit" className="button">Sign out</button>
          </form>
        </div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Next actions</div>
          <h2 style={{ margin: '4px 0' }}>What needs your attention today</h2>
          <div className="muted">Pending bids, awarded work, scheduled visits, and work updates are shown first.</div>
        </div>
        {attentionItems.length ? attentionItems.map(({ request, viewState, attentionLabel }) => (
          <Link key={request.id} href={`/vendor/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="kicker">{attentionLabel}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{request.title}</div>
                <div className="muted">{request.property.name} · {request.unit.label} · {viewState.statusLabel}</div>
                {viewState.canSeeSchedule && request.vendorScheduledStart ? <div className="signalAccent">Visit {new Date(request.vendorScheduledStart).toLocaleString()}</div> : null}
              </div>
              <span className="button primary">Open</span>
            </div>
          </Link>
        )) : <div className="muted">Nothing needs action right now.</div>}
      </section>

      <section className="grid cols-4">
        <Link
          href={'/vendor?filter=open' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'open') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'open') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Open work</div>
          <h2>{openRequests.length}</h2>
          <div className="muted">Requests still in motion</div>
        </Link>
        <Link
          href={'/vendor?filter=bids' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'bids') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'bids') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Pending bids</div>
          <h2>{pendingBids.length}</h2>
          <div className="muted">Invites that still need a response</div>
        </Link>
        <Link
          href={'/vendor?filter=billing' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'billing') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'billing') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Billing docs</div>
          <h2>{payableDocs}</h2>
          <div className="muted">Visible vendor remittance records</div>
        </Link>
        <Link
          href={'/vendor?filter=commercial' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'commercial') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'commercial') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Submitted items</div>
          <h2>{commercialCount}</h2>
          <div className="muted">Commercial submissions sent to property manager</div>
        </Link>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">{filter === 'commercial' ? 'Commercial' : 'Requests'}</div>
          <h3 style={{ marginTop: 4 }}>{sectionTitle}</h3>
        </div>
        {awardedRequests.length ? (
          <div className="awardHero awardHero-success">
            <div className="kicker">Awarded work</div>
            <div className="signalTitle" style={{ fontSize: 22 }}>{awardedRequests.length} awarded request{awardedRequests.length === 1 ? '' : 's'} need attention</div>
            <div>Open the awarded request and send the first vendor update fast.</div>
          </div>
        ) : null}
        {filter === 'commercial' ? (
          commercialItems.length ? commercialItems.map((item) => (
            <Link key={item.id} href={`/vendor/requests/${item.requestId}` as Route} className="card" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div className="muted">
                {vendorCommercialTypeLabel(item.itemType)} · {formatMoney(item.amountCents, item.currency)} · {item.propertyName} · {item.unitLabel}
              </div>
              <div className="muted">Property manager: {item.propertyManagerName}</div>
              <div>{item.requestTitle}</div>
              {item.description ? <div className="muted">{item.description}</div> : null}
              <div className="muted">{new Date(item.submittedAt).toLocaleString()}</div>
            </Link>
          )) : <div className="muted">No vendor commercial submissions yet.</div>
        ) : filteredRequests.length ? filteredRequests.map(({ request, viewState }) => (
          <Link key={request.id} href={`/vendor/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.property.name} · {request.unit.label} · {request.category} · {request.urgency} urgency · {viewState.statusLabel}
                </div>
                <div className="muted">
                  Property manager: {request.property.owner.businessName ?? request.property.owner.displayName ?? request.property.owner.email}
                </div>
                <div className="muted">
                  {viewState.canSeeSchedule && request.vendorScheduledStart ? `Visit ${new Date(request.vendorScheduledStart).toLocaleString()}` : 'No visit window confirmed for you'}
                </div>
                {request.billingDocuments.length ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {request.billingDocuments.map((document) => {
                      const balanceCents = Math.max(0, document.totalCents - document.paidCents)
                      return `${billingStatusLabel(document.status)} remittance: ${formatMoney(balanceCents, document.currency)}`
                    }).join(' · ')}
                    {request.status === 'closed' && isVendorRemittancePaidInFull(request) ? <span> &middot; Paid and closed</span> : null}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                {viewState.isAwardedToViewer ? (
                  <span className="badge done">Awarded to you</span>
                ) : (
                  <div className="muted">{viewState.tenderLabel}</div>
                )}
              </div>
            </div>
          </Link>
        )) : (
          <div className="muted">
            {filter === 'bids'
              ? 'No pending bids right now.'
              : filter === 'billing'
                ? 'No requests with visible vendor remittance records right now.'
                : 'No requests are assigned to this vendor account right now.'}
          </div>
        )}
      </section>
    </div>
  )
}
