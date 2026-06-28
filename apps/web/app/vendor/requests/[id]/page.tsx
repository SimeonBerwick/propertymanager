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
  const heroNotice = awardedInvite && viewState.isAwardedToViewer
    ? {
        title: 'You won this job',
        detail: awardedInvite.bidAmountCents != null ? `Awarded on your bid for USD ${(awardedInvite.bidAmountCents / 100).toFixed(2)}.` : viewState.heroNotice?.detail ?? 'The property manager awarded this request to you.',
        tone: 'success' as const,
      }
    : viewState.heroNotice
  const canSendUpdate = viewState.canControlDispatch || viewState.isPendingBid

  return (
    <div className="stack">
      <section className="row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <Link href={'/vendor' as Route} className="button">Back to Maintenance Ops</Link>
        <Link href={'/vendor/summary' as Route} className="button">Vendor summary</Link>
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
        {canSendUpdate ? <a href="#vendor-next-action" className="button primary" style={{ alignSelf: 'flex-start' }}>{viewState.isPendingBid ? 'Respond to invite' : 'Send the next update'}</a> : null}
      </section>

      {canSendUpdate ? <section className="card stack" id="vendor-next-action">
        <div>
          <div className="kicker">Next action</div>
          <h3 style={{ marginTop: 4 }}>{viewState.isPendingBid ? 'Respond to bid invite' : 'Send work update'}</h3>
        </div>
        <div className="muted">
          {viewState.isPendingBid
            ? 'Send your bid amount, timing, and availability for manager approval.'
            : 'Tell the property manager what happened, confirm timing, or mark the work complete.'}
        </div>
        <VendorRequestResponseForm requestId={request.id} />
      </section> : null}

      <section className="card stack">
        <div>
          <div className="kicker">Bid invitation</div>
          <h3 style={{ marginTop: 4 }}>Bid and approval status</h3>
        </div>
        {request.tenderInvites.length ? request.tenderInvites.map((invite) => (
          <div key={invite.id} className={`timelineRow${invite.status === 'awarded' || invite.awardedAt ? ' spotlightSuccess' : ''}`}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{tenderInviteLabel(invite.status)}</div>
                <div className="muted">
                  Invited {new Date(invite.invitedAt).toLocaleString()}
                  {invite.bidAmountCents != null ? ` - Bid USD ${(invite.bidAmountCents / 100).toFixed(2)}` : ''}
                </div>
              </div>
              {invite.status === 'awarded' || invite.awardedAt ? <span className="badge done">Awarded</span> : null}
            </div>
            {invite.availabilityNote ? <div>{invite.availabilityNote}</div> : null}
            {invite.awardedAt ? <div className="signalAccent">Awarded {new Date(invite.awardedAt).toLocaleString()}</div> : null}
          </div>
        )) : <div className="muted">This request is a direct assignment rather than a bid invitation.</div>}
      </section>

      <details className="advancedDisclosure">
        <summary>Submit a bid, fee, extra cost, or invoice</summary>
        <section className="card stack">
          <div>
            <div className="kicker">Invoices</div>
            <h3 style={{ marginTop: 4 }}>Send an invoice item</h3>
          </div>
          <VendorCommercialItemForm requestId={request.id} />
        </section>
      </details>

      <section className="card stack">
        <div>
          <div className="kicker">Current schedule</div>
          <h3 style={{ marginTop: 4 }}>Appointment and assignment</h3>
        </div>
        <div className="muted">
          Assigned vendor: {viewState.canControlDispatch ? (request.assignedVendorName ?? session.vendorName) : 'Another vendor or pending manager decision'}
        </div>
        <div className="muted">
          {viewState.canSeeSchedule && request.vendorScheduledStart
            ? `Visit window: ${new Date(request.vendorScheduledStart).toLocaleString()}${request.vendorScheduledEnd ? ` to ${new Date(request.vendorScheduledEnd).toLocaleString()}` : ''}`
            : 'No appointment window confirmed for your vendor account.'}
        </div>
      </section>

      {viewState.shouldShowOccupant && (request.submittedByName || request.submittedByEmail) ? (
        <section className="card stack">
          <div>
            <div className="kicker">Renter</div>
            <h3 style={{ marginTop: 4 }}>Occupant contact</h3>
          </div>
          <div className="muted">
            {request.submittedByName ?? 'Renter'}
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
                {new Date(entry.scheduledStart).toLocaleString()}
                {entry.scheduledEnd ? ` to ${new Date(entry.scheduledEnd).toLocaleString()}` : ''}
              </div>
            ) : null}
            <div className="muted">{new Date(entry.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No vendor updates yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Comments</div>
          <h3 style={{ marginTop: 4 }}>Visible notes</h3>
        </div>
        {request.comments.length ? request.comments.map((comment) => (
          <div key={comment.id}>
            <div>{comment.body}</div>
            <div className="muted">{new Date(comment.createdAt).toLocaleString()}</div>
          </div>
        )) : <div className="muted">No visible notes yet.</div>}
      </section>

      <section className="card stack">
        <div>
          <div className="kicker">Payments</div>
          <h3 style={{ marginTop: 4 }}>Payments</h3>
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
                {billingStatusLabel(document.status)} - {new Date(document.createdAt).toLocaleString()}
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
              {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {new Date(item.submittedAt).toLocaleString()}
            </div>
            {item.description ? <div>{item.description}</div> : null}
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
