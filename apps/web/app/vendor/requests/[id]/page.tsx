import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { requireVendorSession } from '@/lib/vendor-session'
import { getVendorRequestById } from '@/lib/vendor-portal-data'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import { VendorRequestResponseForm } from '@/app/vendor/request-response-form'
import { VendorCommercialItemForm } from '@/app/vendor/commercial-item-form'
import { vendorCommercialTypeLabel } from '@/lib/vendor-commercial-types'
import { vendorSignoutAction } from '@/app/vendor/auth/signout/actions'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { deriveVendorRequestViewState } from '@/lib/vendor-request-state'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { formatAppointmentWindow } from '@/lib/appointment-time'
import { formatDateTime } from '@/lib/ui-utils'

function tenderInviteLabel(status: string) {
  if (status === 'bid_submitted') return 'Bid submitted'
  if (status === 'viewed') return 'Invite viewed'
  if (status === 'invited') return 'Invited to bid'
  if (status === 'awarded') return 'Bid approved'
  if (status === 'not_awarded') return 'Not selected'
  return status.replaceAll('_', ' ')
}

export default async function VendorRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const session = await requireVendorSession()
  const { id } = await params
  const { submitted } = await searchParams
  const request = await getVendorRequestById(id, session)

  if (!request) notFound()

  const awardedInvite = request.tenderInvites.find((invite) => invite.status === 'awarded' || !!invite.awardedAt)
  const latestInvite = request.tenderInvites[0]
  const viewState = deriveVendorRequestViewState({
    assignedVendorId: request.assignedVendorId,
    requestStatus: request.status,
    viewerVendorId: session.vendorId,
    latestInvite,
    billingDocuments: request.billingDocuments,
  })
  const closeoutLanguage = deriveRequestCloseoutLanguage({
    status: request.status,
    billingDocuments: request.billingDocuments,
  })
  const isPaidClosed = request.status === 'closed' && closeoutLanguage.isPaid
  const workMarkedComplete = request.status === 'completed'
    || request.dispatchStatus === 'completed'
    || request.reviewState === 'vendor_completed_pending_review'
  const heroNotice = !isPaidClosed && !workMarkedComplete && awardedInvite && viewState.isAwardedToViewer
    ? {
        title: 'Vendor chosen for service call',
        detail: awardedInvite.bidAmountCents != null ? `Awarded on your bid for USD ${(awardedInvite.bidAmountCents / 100).toFixed(2)}.` : viewState.heroNotice?.detail ?? 'The property manager chose your company for this service call.',
        tone: 'success' as const,
      }
    : viewState.heroNotice
  const latestScheduledEvent = [...request.dispatchHistory]
    .reverse()
    .find((entry) => entry.scheduledStart)
  const effectiveScheduledStart = request.vendorScheduledStart ?? latestScheduledEvent?.scheduledStart ?? null
  const effectiveScheduledEnd = request.vendorScheduledEnd ?? latestScheduledEvent?.scheduledEnd ?? null
  const needsAppointmentTime = !isPaidClosed
    && !workMarkedComplete
    && viewState.canControlDispatch
    && !effectiveScheduledStart
    && ['vendor_selected', 'scheduled', 'in_progress'].includes(request.status)
  const hasAppointmentTime = Boolean(effectiveScheduledStart)
  const hasPendingCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status === 'submitted')
  const hasApprovedCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status === 'approved')
  const hasActiveCostOrInvoice = request.vendorCommercialItems.some((item) => item.itemType !== 'bid' && item.status !== 'declined')
  const awardedFromBid = Boolean(awardedInvite)
  const latestTenantMessage = [...request.comments]
    .reverse()
    .find((comment) => comment.body.startsWith('Tenant message:'))
  const shouldPrioritizeInvoiceItem = !isPaidClosed && viewState.canControlDispatch && workMarkedComplete
  const shouldShowServiceCostForm = !isPaidClosed && !shouldPrioritizeInvoiceItem && viewState.canControlDispatch && hasAppointmentTime && !hasActiveCostOrInvoice
  const canSendUpdate = !isPaidClosed && !shouldPrioritizeInvoiceItem && !shouldShowServiceCostForm && !hasPendingCostOrInvoice && (viewState.canControlDispatch || viewState.isPendingBid)

  return (
    <div className="stack">
      <section className="row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <Link href={'/vendor' as Route} className="button">Back to Maintenance Ops</Link>
        <form action={vendorSignoutAction}>
          <button type="submit" className="button">Sign out</button>
        </form>
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Vendor request</div>
          <h2 style={{ marginTop: 4 }}>{request.title}</h2>
        </div>
        {submitted ? <div className="notice success">Update saved. The property manager can now see your vendor update.</div> : null}
        {heroNotice ? (
          <div className={`awardHero awardHero-${heroNotice.tone}`}>
            <div className="kicker">Decision</div>
            <div className="signalTitle" style={{ fontSize: 24 }}>{heroNotice.title}</div>
            <div>{heroNotice.detail}</div>
          </div>
        ) : null}
        <div className="muted">
          {request.property.name} - {request.unit.label} - {request.category} - {request.urgency} urgency - {viewState.statusLabel}
        </div>
        <div className="muted">
          Property manager: {request.property.owner.businessName ?? request.property.owner.displayName ?? request.property.owner.email}
        </div>
        <div>{request.description}</div>
        {latestTenantMessage ? (
          <div className="notice">
            <strong>Tenant message</strong>
            <span>{latestTenantMessage.body.replace(/^Tenant message:\s*/i, '')}</span>
            <span className="muted">{formatDateTime(latestTenantMessage.createdAt)}</span>
          </div>
        ) : null}
        {shouldPrioritizeInvoiceItem ? (
          <a href="#vendor-invoice-item" className="button primary" style={{ alignSelf: 'flex-start' }}>Submit extra cost or invoice</a>
        ) : shouldShowServiceCostForm ? (
          <a href="#vendor-invoice-item" className="button primary" style={{ alignSelf: 'flex-start' }}>{awardedFromBid ? 'Send invoice' : 'Send service charge or invoice'}</a>
        ) : canSendUpdate ? (
          <a href="#vendor-next-action" className="button primary" style={{ alignSelf: 'flex-start' }}>{viewState.isPendingBid ? 'Respond to invite' : needsAppointmentTime ? 'Add appointment time' : hasApprovedCostOrInvoice ? 'Mark work complete' : 'Send the next update'}</a>
        ) : hasPendingCostOrInvoice ? (
          <div className="notice" style={{ alignSelf: 'flex-start' }}>Waiting for the property manager to approve the submitted charge.</div>
        ) : null}
      </section>

      {canSendUpdate ? <section className="card stack" id="vendor-next-action">
        <div>
          <div className="kicker">Next action</div>
          <h3 style={{ marginTop: 4 }}>{viewState.isPendingBid ? 'Respond to bid invite' : needsAppointmentTime ? 'Add appointment time' : hasApprovedCostOrInvoice ? 'Mark work complete' : 'Send work update'}</h3>
        </div>
        <div className="muted">
          {viewState.isPendingBid
            ? 'Send your bid amount, timing, and availability for manager approval.'
            : needsAppointmentTime
              ? 'Enter the confirmed appointment time. This appointment time will be sent to the tenant.'
              : hasAppointmentTime
                ? hasApprovedCostOrInvoice
                  ? 'The cost or invoice has been approved. Mark the work complete when the service call is finished.'
                  : 'Update work progress only. Use the cost form below for service charges, parts, estimates, or invoices.'
                : 'Tell the property manager what happened, confirm timing, or mark the work complete.'}
        </div>
        <VendorRequestResponseForm
          requestId={request.id}
          initialResponse={viewState.isPendingBid ? 'accepted' : needsAppointmentTime ? 'scheduled' : hasApprovedCostOrInvoice ? 'completed' : hasAppointmentTime ? 'in_progress' : 'contacted'}
          hasAppointment={hasAppointmentTime}
          pendingBid={viewState.isPendingBid}
        />
      </section> : null}

      {request.tenderInvites.length && !isPaidClosed ? <section className="card stack">
        <div>
          <div className="kicker">Bid status</div>
          <h3 style={{ marginTop: 4 }}>Bid and approval status</h3>
        </div>
        {request.tenderInvites.map((invite) => (
          <div key={invite.id} className={`timelineRow${invite.status === 'awarded' || invite.awardedAt ? ' spotlightSuccess' : ''}`}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{tenderInviteLabel(invite.status)}</div>
                <div className="muted">
                  Invited {formatDateTime(invite.invitedAt)}
                  {invite.bidAmountCents != null ? ` - Bid USD ${(invite.bidAmountCents / 100).toFixed(2)}` : ''}
                </div>
              </div>
              {invite.status === 'awarded' || invite.awardedAt ? <span className="badge done">Awarded</span> : null}
            </div>
            {invite.availabilityNote ? <div>{invite.availabilityNote}</div> : null}
            {invite.awardedAt ? <div className="signalAccent">Awarded {formatDateTime(invite.awardedAt)}</div> : null}
          </div>
        ))}
      </section> : null}

      {shouldPrioritizeInvoiceItem ? (
        <section className="card stack" id="vendor-invoice-item">
          <div>
            <div className="kicker">Next action</div>
            <h3 style={{ marginTop: 4 }}>Submit extra cost or invoice</h3>
          </div>
          <div className="muted">
            Work is marked complete. Send any extra cost, service fee, or final invoice item to the property manager for approval.
          </div>
          <VendorCommercialItemForm requestId={request.id} defaultItemType="overcost" context="service_call" />
        </section>
      ) : shouldShowServiceCostForm ? (
        <section className="card stack" id="vendor-invoice-item">
          <div>
            <div className="kicker">Next action</div>
            <h3 style={{ marginTop: 4 }}>{awardedFromBid ? 'Send invoice' : 'Send service charge, parts, estimate, or invoice'}</h3>
          </div>
          <div className="muted">
            {awardedFromBid
              ? 'Send the final invoice for the approved bid. It only needs manager approval if it is higher than the already approved amount.'
              : 'Use this for the service call charge, parts only, an estimated repair cost, or a final invoice. The property manager must approve it before it becomes payable.'}
          </div>
          <VendorCommercialItemForm requestId={request.id} defaultItemType={awardedFromBid ? 'bill_to_property_manager' : 'service_fee'} context={awardedFromBid ? 'general' : 'service_call'} />
        </section>
      ) : !isPaidClosed ? <details className="advancedDisclosure">
        <summary>Submit a bid, fee, extra cost, or invoice</summary>
        <section className="card stack">
          <div>
            <div className="kicker">Invoices</div>
            <h3 style={{ marginTop: 4 }}>Submit extra cost or invoice</h3>
          </div>
          <VendorCommercialItemForm requestId={request.id} defaultItemType={viewState.isPendingBid ? 'bid' : 'overcost'} />
        </section>
      </details> : null}

      <section className="card stack">
        <div>
          <div className="kicker">Current schedule</div>
          <h3 style={{ marginTop: 4 }}>Appointment and assignment</h3>
        </div>
        <div className="muted">
          Assigned vendor: {viewState.canControlDispatch ? (request.assignedVendorName ?? session.vendorName) : 'This work is not assigned to your vendor account yet.'}
        </div>
        <div className="muted">
          {viewState.canSeeSchedule && effectiveScheduledStart
            ? `Appointment: ${formatAppointmentWindow(effectiveScheduledStart, effectiveScheduledEnd)}`
            : 'No appointment time confirmed for your vendor account.'}
        </div>
      </section>

      {viewState.shouldShowOccupant && (request.submittedByName || request.submittedByEmail) ? (
        <section className="card stack">
          <div>
            <div className="kicker">Tenant</div>
            <h3 style={{ marginTop: 4 }}>Occupant contact</h3>
          </div>
          <div className="muted">
            {request.submittedByName ?? 'Tenant'}
            {request.submittedByEmail ? ` - ${request.submittedByEmail}` : ''}
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <div className="kicker">Timeline</div>
          <h3 style={{ marginTop: 4 }}>Work history</h3>
        </div>
        {request.dispatchHistory.length ? request.dispatchHistory.map((entry) => (
          <div key={entry.id}>
            <div style={{ fontWeight: 600 }}>
              {(entry.vendor?.name ?? session.vendorName)} - {entry.status.replaceAll('_', ' ')}
            </div>
            {entry.note ? <div>{entry.note}</div> : null}
            {entry.scheduledStart ? (
              <div className="muted">
                {formatAppointmentWindow(entry.scheduledStart, entry.scheduledEnd)}
              </div>
            ) : null}
            <div className="muted">{formatDateTime(entry.createdAt)}</div>
          </div>
        )) : <div className="muted">No vendor updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Comments</div>
          <h3 style={{ marginTop: 4 }}>Messages about this request</h3>
        </div>
        {request.comments.length ? request.comments.map((comment) => (
          <div key={comment.id}>
            <div>{comment.body}</div>
            <div className="muted">{formatDateTime(comment.createdAt)}</div>
          </div>
        )) : <div className="muted">No visible notes yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Payment records</div>
          <h3 style={{ marginTop: 4 }}>Payment records</h3>
        </div>
        {request.status === 'closed' && closeoutLanguage.paymentState !== 'none' ? (
          <div className={`notice ${closeoutLanguage.isPaid ? 'success' : ''}`}><strong>{closeoutLanguage.vendorLabel}</strong><span>{closeoutLanguage.detail}</span></div>
        ) : null}
        {request.billingDocuments.length ? request.billingDocuments.map((document) => {
          const balanceCents = document.totalCents - document.paidCents

          return (
            <div key={document.id} className="timelineRow">
              <div style={{ fontWeight: 600 }}>{document.title}</div>
              {document.description ? <div>{document.description}</div> : null}
              <div className="muted">
                {billingStatusLabel(document.status)} - {formatDateTime(document.createdAt)}
              </div>
              <div className="muted">
                Total: {formatMoney(document.totalCents, document.currency)} - Paid: {formatMoney(document.paidCents, document.currency)} - Balance: {formatMoney(balanceCents, document.currency)}
              </div>
              {document.pdfUrl ? (
                <div>
                  <a href={`/api/billing/${document.id}`} target="_blank" rel="noreferrer">Open payment</a>
                </div>
              ) : null}
            </div>
          )
        }) : <div className="muted">No vendor payments posted yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Invoice summary</div>
          <h3 style={{ marginTop: 4 }}>Items sent to the property manager</h3>
        </div>
        {request.vendorCommercialItems?.length ? request.vendorCommercialItems.map((item: any) => (
          <div key={item.id} className="timelineRow">
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            <div className="muted">
              {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {formatDateTime(item.submittedAt)}
            </div>
            {item.description ? <div>{item.description}</div> : null}
            {item.attachmentUrl ? <a href={`/api/vendor-commercial-items/${item.id}/attachment`} target="_blank" rel="noreferrer">Open bill attachment</a> : null}
          </div>
        )) : <div className="muted">No invoice items submitted yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Photos</div>
          <h3 style={{ marginTop: 4 }}>Images</h3>
        </div>
        {request.photos.length ? (
          <div className="photo-grid">
            {request.photos.map((photo) => (
              <MediaPhotoCard
                key={photo.id}
                href={`/api/vendor/media/${photo.id}`}
                src={`/api/vendor/media/${photo.id}`}
                alt="Maintenance issue photo"
              />
            ))}
          </div>
        ) : <div className="muted">No photos uploaded.</div>}
      </section>
    </div>
  )
}
