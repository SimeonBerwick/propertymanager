import Link from 'next/link'
import type { Route } from 'next'
import { requireVendorSession } from '@/lib/vendor-session'
import { getSiblingVendorAccountCount, getVendorCommercialSummary, getVendorRequestsForDashboard } from '@/lib/vendor-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { vendorSignoutAction } from './auth/signout/actions'
import { cleanVendorCommercialDescription, upfrontPaymentCents, vendorCommercialTypeLabel, vendorPaymentTimingRequiresUpfront } from '@/lib/vendor-commercial-types'
import { deriveVendorNextAction, deriveVendorRequestViewState } from '@/lib/vendor-request-state'
import { PushNotificationControl } from '@/components/push-notification-control'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { formatAppointmentWindow } from '@/lib/appointment-time'
import { markAllVendorOutstandingBillsPaidAction } from './actions'
import { formatDateTime } from '@/lib/ui-utils'

type VendorDashboardFilter = 'open' | 'recent' | 'bids' | 'billing' | 'commercial'

function isActiveFilter(current: VendorDashboardFilter, target: VendorDashboardFilter) {
  return current === target
}

export default async function VendorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const session = await requireVendorSession()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const [requests, commercialItems, siblingAccountCount] = await Promise.all([
    getVendorRequestsForDashboard(session),
    getVendorCommercialSummary(session),
    getSiblingVendorAccountCount(session),
  ])
  const filter = resolvedSearchParams?.filter === 'open'
    || resolvedSearchParams?.filter === 'recent'
    || resolvedSearchParams?.filter === 'bids'
    || resolvedSearchParams?.filter === 'billing'
    || resolvedSearchParams?.filter === 'commercial'
    ? resolvedSearchParams.filter
    : 'open'

  const requestViews = requests.map((request) => {
    const workMarkedComplete = request.status === 'completed'
      || request.dispatchStatus === 'completed'
      || request.reviewState === 'vendor_completed_pending_review'
    const viewState = deriveVendorRequestViewState({
      assignedVendorId: request.assignedVendorId,
      requestStatus: workMarkedComplete && !['closed', 'canceled'].includes(request.status) ? 'completed' : request.status,
      viewerVendorId: session.vendorId,
      latestInvite: request.tenderInvites[0],
      billingDocuments: request.billingDocuments,
    })
    const hasAppointmentTime = Boolean(request.vendorScheduledStart)
    const isPaidClosed = request.status === 'closed' && deriveRequestCloseoutLanguage({
      status: request.status,
      billingDocuments: request.billingDocuments,
    }).isPaid
    const hasPendingCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status === 'submitted')
    const hasApprovedCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status === 'approved')
    const hasActiveCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status !== 'declined')
    const activeFinalInvoice = request.vendorCommercialItems.find((item) => item.itemType === 'bill_to_property_manager' && item.status !== 'declined')
    const latestTenantMessage = request.comments.find((comment) => comment.body.startsWith('Tenant message:'))
    const vendorOpenBalanceCents = request.billingDocuments
      .filter((document) => document.status !== 'void')
      .reduce((sum, document) => sum + Math.max(document.totalCents - document.paidCents, 0), 0)
    const approvedUpfrontCents = request.vendorCommercialItems
      .filter((item) => item.itemType !== 'bid' && item.status === 'approved' && vendorPaymentTimingRequiresUpfront(item.paymentTiming))
      .reduce((sum, item) => sum + upfrontPaymentCents(item.amountCents, item.paymentTiming), 0)
    const vendorPaidCents = request.billingDocuments
      .filter((document) => document.status !== 'void')
      .reduce((sum, document) => sum + Math.min(document.totalCents, document.paidCents), 0)
    const upfrontVendorPaymentDueCents = Math.max(approvedUpfrontCents - vendorPaidCents, 0)
    const nextAction = deriveVendorNextAction({
      requestStatus: request.status,
      dispatchStatus: request.dispatchStatus,
      isPaidClosed,
      canControlDispatch: viewState.canControlDispatch,
      isPendingBid: viewState.isPendingBid,
      workMarkedComplete,
      hasAppointmentTime,
      needsAppointmentTime: !isPaidClosed && !workMarkedComplete && viewState.canControlDispatch && !hasAppointmentTime && ['vendor_selected', 'scheduled', 'in_progress'].includes(request.status),
      hasTenantAppointmentRequest: Boolean(latestTenantMessage && /appointment|different time|reschedule|schedule|time/i.test(latestTenantMessage.body)),
      hasPendingCostOrInvoice,
      hasApprovedCostOrInvoice,
      hasActiveCostOrInvoice,
      activeFinalInvoiceStatus: activeFinalInvoice?.status ?? null,
      vendorOpenBalanceCents,
      upfrontVendorPaymentDueCents,
      awardedFromBid: request.tenderInvites.some((invite) => invite.status === 'awarded' || invite.awardedAt),
    })

    return { request, viewState, nextAction, workMarkedComplete }
  })
  const openRequests = requestViews.filter(({ request, nextAction }) => !['closed', 'declined', 'canceled'].includes(request.status) && !['done', 'wait'].includes(nextAction.key))
  const recentRequests = requestViews.filter(({ request, nextAction }) => ['closed', 'completed', 'canceled'].includes(request.status) || ['done', 'wait'].includes(nextAction.key)).slice(0, 8)
  const pendingBids = requestViews.filter(({ nextAction }) => nextAction.key === 'respond_bid')
  const attentionItems = openRequests
    .filter(({ nextAction }) => Boolean(nextAction.href || nextAction.showResponseForm || nextAction.showCommercialForm))
    .slice(0, 5)
  const awardedRequests = attentionItems.filter(({ viewState }) => viewState.isAwardedToViewer)
  const billingRequests = requestViews.filter(({ request }) => request.billingDocuments.length > 0)
  const payableDocs = requests.reduce((sum, request) => sum + request.billingDocuments.length, 0)
  const outstandingPaymentDocumentCount = requests.reduce((sum, request) => (
    sum + request.billingDocuments.filter((document) => document.status !== 'void' && document.status !== 'paid' && document.totalCents > document.paidCents).length
  ), 0)
  const commercialCount = commercialItems.length
  const filteredRequests = filter === 'open'
    ? (openRequests.length ? openRequests : recentRequests)
    : filter === 'recent'
      ? recentRequests
      : filter === 'bids'
      ? pendingBids
      : filter === 'billing'
        ? billingRequests
        : []
  const sectionTitle = filter === 'open'
    ? (openRequests.length ? 'Open work' : 'Recent work')
    : filter === 'recent'
      ? 'Recent work'
      : filter === 'bids'
      ? 'Pending bids'
      : filter === 'billing'
        ? 'Requests with payments'
        : 'Submitted invoices'

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
          {siblingAccountCount > 1 ? <Link href={`/vendor/auth/accounts?identifier=${encodeURIComponent(session.email ?? session.phone ?? '')}` as Route} className="button">Switch account</Link> : null}
          <Link href={'/support' as Route} className="button">Support</Link>
          <a className="button" href="mailto:feedback@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Feedback</a>
          <form action={vendorSignoutAction}>
            <button type="submit" className="button">Sign out</button>
          </form>
        </div>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Next step</div>
          <h2 style={{ margin: '4px 0' }}>Work waiting on you</h2>
          <div className="muted">Bid invites, chosen work, scheduled appointments, and requested updates are shown first.</div>
        </div>
        {attentionItems.length ? attentionItems.map(({ request, viewState, nextAction }) => (
          <Link key={request.id} href={`/vendor/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="kicker">{nextAction.attentionLabel}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{request.title}</div>
                <div className="muted">{request.property.name} - {request.unit.label} - {viewState.statusLabel}</div>
                {viewState.canSeeSchedule && request.vendorScheduledStart ? <div className="signalAccent">Appointment {formatAppointmentWindow(request.vendorScheduledStart, request.vendorScheduledEnd)}</div> : null}
              </div>
              <span className="button primary">View details</span>
            </div>
          </Link>
        )) : (
          <div className="emptyState">
            <strong>No vendor action needed</strong>
            <span>Bid invites, awarded work, scheduled appointments, and update requests will appear here when the property manager needs something from you.</span>
          </div>
        )}
      </section>

      <section className="grid cols-4" aria-label="Vendor work summary">
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
          href={'/vendor?filter=recent' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'recent') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'recent') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Recent work</div>
          <h2>{recentRequests.length}</h2>
          <div className="muted">Completed or canceled requests you can still open</div>
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
          <div className="kicker">Payment records</div>
          <h2>{payableDocs}</h2>
          <div className="muted">Payment records posted by the property manager</div>
        </Link>
        <Link
          href={'/vendor?filter=commercial' as Route}
          className="card"
          style={{ textDecoration: 'none', borderColor: isActiveFilter(filter, 'commercial') ? 'var(--ink)' : undefined, boxShadow: isActiveFilter(filter, 'commercial') ? 'inset 0 0 0 1px var(--ink)' : undefined }}
        >
          <div className="kicker">Sent to manager</div>
          <h2>{commercialCount}</h2>
          <div className="muted">Bids, overages, and invoices</div>
        </Link>
      </section>

      {outstandingPaymentDocumentCount > 1 ? (
        <section className="notice stack" style={{ gap: 10 }}>
          <div>
            <strong>{outstandingPaymentDocumentCount} payment records still marked unpaid.</strong>
            <div className="muted">Use this after those payments have been received outside the app.</div>
          </div>
          <form action={markAllVendorOutstandingBillsPaidAction}>
            <button type="submit" className="button primary">Mark all outstanding bills paid</button>
          </form>
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">{filter === 'commercial' ? 'Sent items' : 'Work list'}</div>
          <h3 style={{ marginTop: 4 }}>{sectionTitle}</h3>
        </div>
        {awardedRequests.length ? (
          <div className="awardHero awardHero-success">
            <div className="kicker">Awarded work</div>
            <div className="signalTitle" style={{ fontSize: 22 }}>{awardedRequests.length} awarded request{awardedRequests.length === 1 ? '' : 's'} need attention</div>
            <div>Open the chosen request and send the next work update.</div>
          </div>
        ) : null}
        {filter === 'commercial' ? (
          commercialItems.length ? commercialItems.map((item) => (
            <Link key={item.id} href={`/vendor/requests/${item.requestId}` as Route} className="card" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div className="muted">
                {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {item.propertyName} - {item.unitLabel}
              </div>
              <div className="muted">Property manager: {item.propertyManagerName}</div>
              <div>{item.requestTitle}</div>
              {cleanVendorCommercialDescription(item.description) ? <div className="muted">{cleanVendorCommercialDescription(item.description)}</div> : null}
              <div className="muted">{formatDateTime(item.submittedAt)}</div>
            </Link>
          )) : (
            <div className="emptyState">
              <strong>No submitted items yet</strong>
              <span>Submitted bids, extra costs, and invoices will appear here after you send them from a request.</span>
            </div>
          )
        ) : filteredRequests.length ? filteredRequests.map(({ request, viewState, nextAction, workMarkedComplete }) => (
          <Link key={request.id} href={`/vendor/requests/${request.id}` as Route} className="card" style={{ textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{request.title}</div>
                <div className="muted">
                  {request.property.name} - {request.unit.label} - {viewState.statusLabel}
                </div>
                <div className="muted">
                  Property manager: {request.property.owner.businessName ?? request.property.owner.displayName ?? request.property.owner.email}
                </div>
                <div className="muted">
                  {nextAction.detail}
                </div>
                {request.billingDocuments.length ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {request.billingDocuments.map((document) => {
                      const balanceCents = Math.max(0, document.totalCents - document.paidCents)
                      return `${billingStatusLabel(document.status)} payment: ${formatMoney(balanceCents, document.currency)}`
                    }).join(' - ')}
                    {request.status === 'closed' ? <span> - {deriveRequestCloseoutLanguage({ status: request.status, billingDocuments: request.billingDocuments }).vendorLabel}</span> : null}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                {workMarkedComplete ? (
                  <span className="badge done">Work completed</span>
                ) : viewState.isAwardedToViewer && !['completed', 'closed', 'canceled'].includes(request.status) ? (
                  <span className="badge done">Vendor chosen for service call</span>
                ) : ['completed', 'closed', 'canceled'].includes(request.status) ? null : (
                  <div className="muted">{viewState.tenderLabel}</div>
                )}
              </div>
            </div>
          </Link>
        )) : (
          <div className="emptyState">
            <strong>{filter === 'bids' ? 'No bid invites waiting' : filter === 'billing' ? 'No payment records yet' : filter === 'recent' ? 'No recent work yet' : 'No active work chosen'}</strong>
            <span>
              {filter === 'bids'
                ? 'New bid invitations will appear here when a property manager asks for pricing.'
                : filter === 'billing'
                  ? 'Payment records and remittance details will appear here after the property manager posts them. Payments are handled outside the app.'
                  : filter === 'recent'
                    ? 'Completed, closed, and canceled requests will move here after work is finished.'
                    : 'When work is assigned or awarded to this vendor account, it will appear here.'}
            </span>
            {filter === 'open' ? null : <Link href={'/vendor' as Route} className="button">Back to open work</Link>}
          </div>
        )}
      </section>
    </div>
  )
}
