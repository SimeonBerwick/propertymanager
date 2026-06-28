import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { languageLabel } from '@/lib/types'
import { reviewStateLabel, formatClaimStatus, formatDateTime, isStaleClaim } from '@/lib/ui-utils'
import { StatusBadge } from '@/components/status-badge'
import { RequestFlowBadge } from '@/components/request-flow-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { SectionCard } from '@/components/section-card'
import { BillingDocumentForm } from '@/components/billing-document-form'
import { BillingDocumentList } from '@/components/billing-document-list'
import { BillingEventList } from '@/components/billing-event-list'
import { BillingSummaryCards } from '@/components/billing-summary-cards'
import { formatMoney } from '@/lib/billing-utils'
import { RequestBillbackForm } from '@/components/request-billback-form'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { AddCommentForm } from './add-comment-form'
import { vendorCommercialStatusLabel, vendorCommercialTypeLabel } from '@/lib/vendor-commercial-types'
import { VendorCommercialApprovalForm } from './vendor-commercial-approval-form'
import { RequestControlPanel } from './request-control-panel'
import { InlineRequestEditor } from './inline-request-editor'
import { GuidedRequestWorkflow } from '@/components/guided-request-workflow'
import { RecommendedNextStepPanel } from '@/components/recommended-next-step-panel'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

const VISIBILITY_LABELS: Record<string, string> = {
  internal: 'Internal note',
  external: 'Tenant-facing',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s
}

function tenderInviteLabel(status: string) {
  if (status === 'bid_submitted') return 'Bid submitted'
  if (status === 'viewed') return 'Invite viewed'
  if (status === 'invited') return 'Invited to bid'
  if (status === 'awarded') return 'Bid approved'
  if (status === 'not_awarded') return 'Not selected'
  return status.replaceAll('_', ' ')
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params
  const data = await getRequestDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  const issuePhotos = data.photos.filter((photo) => photo.source !== 'vendor')
  const vendorPhotos = data.photos.filter((photo) => photo.source === 'vendor')
  const latestTenderReply = data.tenders
    .flatMap((tender) => tender.invites.map((invite) => ({
      tender,
      invite,
      activityAt: invite.respondedAt ?? invite.invitedAt,
    })))
    .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())[0]
  const latestVendorDispatch = [...data.dispatchHistory]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const latestVisibleReply = [...data.comments]
    .filter((comment) => comment.visibility === 'external')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const latestCommercialReply = [...data.vendorCommercialItems]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
  const awardedTenderBid = data.tenders
    .flatMap((tender) => tender.invites)
    .filter((invite) => invite.status === 'awarded' && invite.bidAmountCents != null)
    .sort((a, b) => new Date(b.awardedAt ?? b.respondedAt ?? b.invitedAt).getTime() - new Date(a.awardedAt ?? a.respondedAt ?? a.invitedAt).getTime())[0]
  const acceptedVendorBid = data.vendorCommercialItems
    .filter((item) => (
      item.itemType === 'bid'
      && (item.status === 'approved' || (item.status === 'submitted' && item.vendorId === data.request.assignedVendorId))
    ))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
  const payableVendorId = awardedTenderBid?.vendorId ?? acceptedVendorBid?.vendorId ?? data.request.assignedVendorId
  const approvedBidCents = awardedTenderBid?.bidAmountCents ?? acceptedVendorBid?.amountCents ?? 0
  const approvedVendorExtrasCents = data.vendorCommercialItems
    .filter((item) => item.status === 'approved' && item.itemType !== 'bid' && (!payableVendorId || item.vendorId === payableVendorId))
    .reduce((sum, item) => sum + item.amountCents, 0)
  const pendingVendorExtrasCents = data.vendorCommercialItems
    .filter((item) => item.status === 'submitted' && item.itemType !== 'bid' && (!payableVendorId || item.vendorId === payableVendorId))
    .reduce((sum, item) => sum + item.amountCents, 0)
  const vendorAmountOwedCents = approvedBidCents + approvedVendorExtrasCents
  const vendorAmountIfPendingApprovedCents = vendorAmountOwedCents + pendingVendorExtrasCents
  const postedVendorPayments = data.billingDocuments.filter((doc) => doc.recipientType === 'vendor' && doc.status !== 'void')
  const postedVendorPaymentCents = postedVendorPayments.reduce((sum, doc) => sum + doc.totalCents, 0)
  const postedVendorPaymentBalanceCents = postedVendorPayments.reduce((sum, doc) => sum + Math.max(doc.totalCents - doc.paidCents, 0), 0)
  const unpostedVendorOwedCents = Math.max(vendorAmountOwedCents - postedVendorPaymentCents, 0)
  const vendorOutstandingCents = postedVendorPaymentBalanceCents + unpostedVendorOwedCents
  const closeoutLanguage = deriveRequestCloseoutLanguage({
    status: data.request.status,
    outstandingCents: ['completed', 'closed'].includes(data.request.status) ? vendorOutstandingCents : null,
  })
  const isCompleteButUnpaid = ['completed', 'closed'].includes(data.request.status) && closeoutLanguage.isUnpaid

  return (
    <div className="stack requestDetailPage">
      <section className="card requestHero">
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="kicker">Request</div>
            <h1 className="pageTitle">{data.request.title}</h1>
            <div className="muted">
              <Link href={`/properties/${data.request.propertyId}`}>{data.request.propertyName}</Link>
              {' - '}
              <Link href={`/units/${data.request.unitId}`}>{data.request.unitLabel}</Link>
            </div>
          </div>
          <div className="requestHeroMeta">
            {isCompleteButUnpaid ? <span className="badge billing-partial">{closeoutLanguage.managerLabel}</span> : <StatusBadge status={data.request.status} />}
            {isCompleteButUnpaid ? <span className="badge billing-partial">Vendor unpaid</span> : <RequestFlowBadge request={data.request} />}
            <span className="muted">{data.request.category}</span>
            <span className="muted">Submitted {new Date(data.request.createdAt).toLocaleString()}</span>
          </div>
          <RequestSignalStrip request={data.request} />
          <InlineRequestEditor request={data.request} />
        </div>
      </section>

      <RecommendedNextStepPanel request={{
        ...data.request,
        tenantAccessFailureCount: data.tenantAccessFailureCount,
        tenantStatusUpdatePending: data.tenantStatusUpdatePending,
      }} />

      <GuidedRequestWorkflow request={data.request} />

      <nav className="requestSectionNav" aria-label="Request sections">
        <a href="#summary">Summary</a>
        <a href="#actions">Actions</a>
        <a href="#timeline">Timeline</a>
        <a href="#billing">Invoices and payments</a>
        <a href="#advanced">More details</a>
      </nav>

      <details className="advancedDisclosure" id="advanced">
        <summary>Vendor bids and replies</summary>
        <SectionCard
          kicker="Tender"
          title="Bid and reply signal"
          subtitle="Vendor decisions, bids, and incoming replies."
        >
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid cols-3">
            <div className="signalSpotlightCard">
              <div className="kicker">Latest tender reply</div>
              {latestTenderReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestTenderReply.invite.vendorName}</div>
                  <div className="signalAccent">{tenderInviteLabel(latestTenderReply.invite.status)}</div>
                  <div className="muted">
                    {latestTenderReply.invite.bidAmountCents != null
                      ? `Bid USD ${(latestTenderReply.invite.bidAmountCents / 100).toFixed(2)}`
                      : 'No bid amount yet'}
                  </div>
                  <div className="muted">{new Date(latestTenderReply.activityAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No tender reply yet.</div>
              )}
            </div>

            <div className="signalSpotlightCard">
              <div className="kicker">Latest vendor update</div>
              {latestVendorDispatch ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestVendorDispatch.vendorName ?? 'Vendor update'}</div>
                  <div className="signalAccent">{statusLabel(latestVendorDispatch.status)}</div>
                  <div className="muted">{latestVendorDispatch.note ?? 'No note attached.'}</div>
                  <div className="muted">{new Date(latestVendorDispatch.createdAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No work update yet.</div>
              )}
            </div>

            <div className="signalSpotlightCard">
              <div className="kicker">Latest visible note</div>
              {latestVisibleReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestVisibleReply.authorName}</div>
                  <div className="muted">{latestVisibleReply.body}</div>
                  <div className="muted">{new Date(latestVisibleReply.createdAt).toLocaleString()}</div>
                </>
              ) : latestCommercialReply ? (
                <>
                  <div className="signalTitle" style={{ fontSize: 18 }}>{latestCommercialReply.title}</div>
                  <div className="signalAccent">{vendorCommercialTypeLabel(latestCommercialReply.itemType)}</div>
                  <div className="muted">{new Date(latestCommercialReply.submittedAt).toLocaleString()}</div>
                </>
              ) : (
                <div className="muted">No recent reply signal yet.</div>
              )}
            </div>
          </div>

          {data.tenders.length ? data.tenders.map((tender) => (
            <div key={tender.id} className="tenderFocusCard">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="kicker">Tender round</div>
                  <h3 style={{ marginTop: 4 }}>{tender.title ?? 'Tender round'}</h3>
                  <div className="muted">
                    {tender.status.replaceAll('_', ' ')}
                    {tender.sentAt ? ` - Sent ${new Date(tender.sentAt).toLocaleString()}` : ''}
                    {tender.awardedAt ? ` - Awarded ${new Date(tender.awardedAt).toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
              {tender.note ? <div className="muted">{tender.note}</div> : null}
              <div className="stack" style={{ gap: 10 }}>
                {tender.invites.map((invite) => (
                  <div key={invite.id} className={`timelineRow${invite.awardedAt ? ' spotlightSuccess' : ''}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{invite.vendorName}</div>
                        <div className="signalAccent">{tenderInviteLabel(invite.status)}</div>
                      </div>
                      {invite.awardedAt ? <span className="badge done">Awarded</span> : null}
                    </div>
                    <div className="muted">
                      {invite.bidAmountCents != null ? `Bid USD ${(invite.bidAmountCents / 100).toFixed(2)}` : 'No bid amount yet'}
                      {invite.availabilityNote ? ` - ${invite.availabilityNote}` : ''}
                    </div>
                    {(invite.proposedStart || invite.proposedEnd) ? (
                      <div className="muted">
                        {invite.proposedStart ? new Date(invite.proposedStart).toLocaleString() : '-'}
                        {invite.proposedEnd ? ` to ${new Date(invite.proposedEnd).toLocaleString()}` : ''}
                      </div>
                    ) : null}
                    <div className="muted">
                      Invited {new Date(invite.invitedAt).toLocaleString()}
                      {invite.respondedAt ? ` - Replied ${new Date(invite.respondedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : <div className="muted">No tenders yet.</div>}
        </div>
        </SectionCard>
      </details>

      <div className="requestDetailGrid">
        <div className="stack">
          <div id="summary">
          <SectionCard kicker="Summary" title="Request summary" subtitle="The essential context for this request.">
            <div className="stack" style={{ gap: 14 }}>
              <div>
                <strong>Description</strong>
                <p className="muted" style={{ marginBottom: 0 }}>{data.request.description}</p>
              </div>
              <div className="detailFactsGrid">
                <div><strong>Submitted by</strong><div className="muted">{data.request.submittedByName ?? 'Unknown tenant'}{data.request.submittedByEmail ? ` - ${data.request.submittedByEmail}` : ''}</div></div>
                <div><strong>Preferred language</strong><div className="muted">{languageLabel(data.request.preferredLanguage)}</div></div>
                <div><strong>SLA / tags</strong><div className="muted">{data.request.slaBucket ?? 'standard'}{data.request.triageTags.length ? ` - ${data.request.triageTags.join(', ')}` : ''}</div></div>
                <div><strong>Vendor</strong><div className="muted">{data.request.assignedVendorName ?? 'Unassigned'}</div></div>
                <div><strong>Queue claim</strong><div className="muted">{formatClaimStatus(data.request)}</div></div>
                <div><strong>Claim owner</strong><div className="muted">{data.request.claimedByUserName ?? 'Unassigned'}</div></div>
                <div><strong>First reviewed</strong><div className="muted">{data.request.firstReviewedAt ? formatDateTime(data.request.firstReviewedAt) : 'Not yet reviewed'}</div></div>
              </div>
              <RequestSignalStrip request={data.request} />
              {data.request.reviewState && !['none', 'approved'].includes(data.request.reviewState) ? (
                <div className="notice error">Review: {reviewStateLabel(data.request.reviewState)}{data.request.reviewNote ? ` - ${data.request.reviewNote}` : ''}</div>
              ) : null}
              {isStaleClaim(data.request) ? (
                <div className="notice">This request was claimed more than 24 hours ago and still has not been fully advanced.</div>
              ) : null}
            </div>
          </SectionCard>
          </div>

          <div id="timeline">
          <SectionCard kicker="Timeline" title="Vendor activity" subtitle="Field activity and progress so far.">
            {data.dispatchHistory.length ? data.dispatchHistory.map((entry) => (
              <div key={entry.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>
                  {entry.vendorName ? `${entry.vendorName} - ` : ''}{entry.status}
                </div>
                {entry.note ? <div>{entry.note}</div> : null}
                {(entry.scheduledStart || entry.scheduledEnd) ? (
                  <div className="muted">
                    {entry.scheduledStart ? new Date(entry.scheduledStart).toLocaleString() : '-'}
                    {entry.scheduledEnd ? ` to ${new Date(entry.scheduledEnd).toLocaleString()}` : ''}
                  </div>
                ) : null}
                <div className="muted">{entry.actorName} - {new Date(entry.createdAt).toLocaleString()}</div>
              </div>
            )) : <div className="muted">No work activity yet.</div>}
          </SectionCard>
          </div>

          <SectionCard kicker="Invoices" title="Vendor invoices" subtitle="Bids, fees, extra costs, and manager-billed items sent from the vendor portal.">
            {data.vendorCommercialItems.length ? data.vendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted">
                  {(item.vendorName ?? 'Vendor')} - {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {new Date(item.submittedAt).toLocaleString()}
                </div>
                <div className="muted">Status: {vendorCommercialStatusLabel(item.status)}</div>
                {item.description ? <div>{item.description}</div> : null}
                {item.status === 'submitted' ? (
                  <VendorCommercialApprovalForm
                    requestId={data.request.id}
                    itemId={item.id}
                    label={item.itemType === 'bid' ? 'Approve bid' : 'Approve submission'}
                  />
                ) : null}
              </div>
            )) : <div className="muted">No vendor invoices submitted yet.</div>}
          </SectionCard>

        </div>

        <div className="stack">
          <div id="actions">
          <SectionCard kicker="Actions" title="Approval and vendor bids" subtitle="Approve the request, invite bids, select a vendor, and close out the work here.">
            <RequestControlPanel
              request={data.request}
              vendors={data.availableVendors}
              tenders={data.tenders}
            />
          </SectionCard>
          </div>

        </div>
      </div>

      <div className="grid cols-3 requestEvidenceGrid">
        <SectionCard kicker="Photos" title="Issue intake photos">
          {issuePhotos.length ? (
            <div className="photo-grid">
              {issuePhotos.map((photo) => (
                <MediaPhotoCard
                  key={photo.id}
                  href={`/api/landlord/media/${photo.id}`}
                  src={`/api/landlord/media/${photo.id}`}
                  alt="Maintenance issue photo"
                />
              ))}
            </div>
          ) : <div className="muted">No issue intake photos uploaded.</div>}
        </SectionCard>

        <SectionCard kicker="Vendor evidence" title="Field photos">
          {vendorPhotos.length ? (
            <div className="photo-grid">
              {vendorPhotos.map((photo) => (
                <MediaPhotoCard
                  key={photo.id}
                  href={`/api/landlord/media/${photo.id}`}
                  src={`/api/landlord/media/${photo.id}`}
                  alt="Vendor work photo"
                />
              ))}
            </div>
          ) : <div className="muted">No vendor photos yet.</div>}
        </SectionCard>

        <div id="communication">
        <SectionCard kicker="Communication" title="Comments">
          {data.comments.length ? data.comments.map((comment) => (
            <div key={comment.id} className="commentRow">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>{comment.authorName}</strong>
                <span className="badge" style={{ fontSize: 11, background: comment.visibility === 'internal' ? '#f0f4ff' : '#f0fff4', color: comment.visibility === 'internal' ? '#3b5bdb' : '#2b7a47' }}>
                  {VISIBILITY_LABELS[comment.visibility] ?? comment.visibility}
                </span>
              </div>
              <div>{comment.body}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{new Date(comment.createdAt).toLocaleString()}</div>
            </div>
          )) : <div className="muted">No comments.</div>}
          <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
            <AddCommentForm requestId={data.request.id} />
          </div>
        </SectionCard>
        </div>
      </div>

      <div id="billing">
      <SectionCard kicker="Invoices and payments" title="Invoices and payments" subtitle="Create, send, and track request-related charges when money movement is needed.">
        <div className="stack billingCompact" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 14, background: 'var(--table-row)' }}>
            <div className="kicker">Tenant responsibility</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Current: {data.request.tenantBillbackDecision ?? 'none'}
              {data.request.tenantBillbackDecision === 'bill_tenant' && typeof data.request.tenantBillbackAmountCents === 'number'
                ? ` - $${(data.request.tenantBillbackAmountCents / 100).toFixed(2)}`
                : ''}
              {data.request.tenantBillbackReason ? ` - ${data.request.tenantBillbackReason}` : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              <RequestBillbackForm
                requestId={data.request.id}
                decision={data.request.tenantBillbackDecision}
                amountCents={data.request.tenantBillbackAmountCents}
                reason={data.request.tenantBillbackReason}
              />
            </div>
          </div>
          <div className="card" style={{ padding: 14, background: 'var(--table-row)' }}>
            <div className="kicker">Vendor amount owed</div>
            <div className="detailFactsGrid" style={{ marginTop: 10 }}>
              <div><strong>Approved bid</strong><div className="muted">{formatMoney(approvedBidCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Approved extras</strong><div className="muted">{formatMoney(approvedVendorExtrasCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Owed now</strong><div className="muted">{formatMoney(vendorAmountOwedCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Outstanding</strong><div className="muted">{formatMoney(vendorOutstandingCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Pending extras</strong><div className="muted">{formatMoney(pendingVendorExtrasCents, data.request.preferredCurrency)}</div></div>
              <div><strong>If pending approved</strong><div className="muted">{formatMoney(vendorAmountIfPendingApprovedCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Payments posted</strong><div className="muted">{formatMoney(postedVendorPaymentCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Payment balance</strong><div className="muted">{formatMoney(postedVendorPaymentBalanceCents, data.request.preferredCurrency)}</div></div>
            </div>
            {isCompleteButUnpaid ? (
              <div className="inlineNotice" style={{ marginTop: 10 }}>
                {closeoutLanguage.detail}
              </div>
            ) : null}
            <div className="muted" style={{ marginTop: 10 }}>
              Approving a vendor bid, fee, or extra cost posts or updates a draft vendor payment. Use the invoice and payment actions below to open, send, or mark payment.
            </div>
          </div>
          <BillingSummaryCards documents={data.billingDocuments} />
          <BillingDocumentForm
            requestId={data.request.id}
            tenantEmail={data.request.submittedByEmail}
            vendorEmail={data.request.assignedVendorEmail}
            tenantBillbackDecision={data.request.tenantBillbackDecision}
            tenantBillbackAmountCents={data.request.tenantBillbackAmountCents}
            tenantBillbackReason={data.request.tenantBillbackReason}
          />
          <BillingDocumentList documents={data.billingDocuments} requestId={data.request.id} />
          <BillingEventList documents={data.billingDocuments} />
        </div>
      </SectionCard>
      </div>
    </div>
  )
}
