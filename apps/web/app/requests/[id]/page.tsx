import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { languageLabel } from '@/lib/types'
import { reviewStateLabel, formatDateTime } from '@/lib/ui-utils'
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

function bidRoundTitle(title?: string) {
  return title?.replace(/^Tender round/i, 'Bid round') ?? 'Bid round'
}

function tenderInviteLabel(status: string) {
  if (status === 'bid_submitted') return 'Bid submitted'
  if (status === 'viewed') return 'Invite viewed'
  if (status === 'invited') return 'Invited to bid'
  if (status === 'awarded') return 'Bid approved'
  if (status === 'not_awarded') return 'Not selected'
  return status.replaceAll('_', ' ')
}

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ comment?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const data = await getRequestDetailData(id, session.userId)

  if (!data) {
    notFound()
  }
  const defaultCommentVisibility = query.comment === 'tenant' || data.tenantStatusUpdatePending ? 'external' : 'internal'

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
  const hasVendorChosen = Boolean(payableVendorId || data.request.assignedVendorName || data.request.assignedVendorEmail)
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
  const billingOpenBalanceCents = data.billingDocuments
    .filter((doc) => doc.status !== 'void')
    .reduce((sum, doc) => sum + Math.max(doc.totalCents - doc.paidCents, 0), 0)
  const closeoutLanguage = deriveRequestCloseoutLanguage({
    status: data.request.status,
    outstandingCents: ['completed', 'closed'].includes(data.request.status) ? vendorOutstandingCents : null,
  })
  const isCompleteButUnpaid = ['completed', 'closed'].includes(data.request.status) && closeoutLanguage.isUnpaid
  const hasBidDetails = data.tenders.length > 0 || Boolean(latestTenderReply) || Boolean(latestCommercialReply)
  const hasSubmittedBid = data.tenders.some((tender) => tender.invites.some((invite) => invite.status === 'bid_submitted'))
    || data.vendorCommercialItems.some((item) => item.itemType === 'bid' && item.status === 'submitted')
  const canChooseVendor = !hasVendorChosen && ['approved', 'reopened'].includes(data.request.status) && !data.tenders.some((tender) => tender.status !== 'canceled')
  const needsAppointmentTime = hasVendorChosen && !data.request.vendorScheduledStart && ['approved', 'vendor_selected', 'scheduled', 'reopened'].includes(data.request.status)
  const actionSectionTitle = needsAppointmentTime
    ? 'Add appointment time'
    : hasSubmittedBid
      ? 'Approve vendor bid'
      : canChooseVendor
        ? 'Choose vendor path'
        : ['completed', 'closed'].includes(data.request.status)
          ? 'Close request actions'
          : 'Request actions'
  const actionSectionSubtitle = needsAppointmentTime
    ? 'Enter the confirmed vendor visit time here.'
    : hasSubmittedBid
      ? 'Review returned pricing and choose the vendor.'
      : canChooseVendor
        ? 'Assign one vendor directly or ask multiple vendors for bids.'
        : ['completed', 'closed'].includes(data.request.status)
          ? 'Reopen only if more work is needed.'
          : 'Move this request forward when a manager decision is needed.'
  const pendingVendorCommercialItems = data.vendorCommercialItems.filter((item) => item.status === 'submitted')
  const resolvedVendorCommercialItems = data.vendorCommercialItems.filter((item) => item.status !== 'submitted')

  return (
    <div className="stack requestDetailPage">
      <RecommendedNextStepPanel request={{
        ...data.request,
        tenantAccessFailureCount: data.tenantAccessFailureCount,
        tenantStatusUpdatePending: data.tenantStatusUpdatePending,
        pendingVendorApprovalCount: pendingVendorCommercialItems.length,
        pendingBidCount: data.request.pendingBidCount,
        billingOpenBalanceCents,
      }} />

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
            <span className="muted">Submitted {formatDateTime(data.request.createdAt)}</span>
          </div>
          <RequestSignalStrip request={data.request} />
          <InlineRequestEditor request={data.request} />
        </div>
      </section>

      <GuidedRequestWorkflow request={data.request} />

      <div id="actions">
      <SectionCard kicker="Actions" title={actionSectionTitle} subtitle={actionSectionSubtitle}>
        <RequestControlPanel
          request={data.request}
          vendors={data.availableVendors}
          tenders={data.tenders}
          statusControlPriority={canChooseVendor || hasSubmittedBid ? 'secondary' : 'primary'}
        />
      </SectionCard>
      </div>


      {pendingVendorCommercialItems.length ? (
        <div id="vendor-approvals">
        <SectionCard
          kicker="Money decision needed"
          title="Approve vendor cost before billing"
          subtitle="This must be approved before vendor payment, tenant chargeback, or closeout."
        >
          <div className="stack" style={{ gap: 12 }}>
            {pendingVendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow spotlightSuccess">
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div className="muted">
                      {(item.vendorName ?? 'Vendor')} - {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {new Date(item.submittedAt).toLocaleString()}
                    </div>
                    {item.description ? <div>{item.description}</div> : null}
                  </div>
                  <span className="badge billing-partial">Approve before billing</span>
                </div>
                <VendorCommercialApprovalForm
                  requestId={data.request.id}
                  itemId={item.id}
                  label={item.itemType === 'bid' ? 'Approve bid' : 'Approve cost'}
                />
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      ) : null}

      <nav className="requestSectionNav" aria-label="Request sections">
        <a href="#summary">Summary</a>
        <a href="#actions">Next step</a>
        <a href="#timeline">Timeline</a>
        {pendingVendorCommercialItems.length ? <a href="#vendor-approvals">Approvals</a> : null}
        {hasVendorChosen || data.billingDocuments.length ? <a href="#billing">Billing records</a> : null}
        {hasBidDetails ? <a href="#advanced">More details</a> : null}
      </nav>

      {hasBidDetails ? (
        <details className="advancedDisclosure" id="advanced">
          <summary>Vendor bids and updates</summary>
          <SectionCard
            kicker="Bid request"
            title="Bid and update signal"
            subtitle="Vendor decisions, bids, and incoming replies."
          >
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid cols-3">
              <div className="signalSpotlightCard">
                <div className="kicker">Latest bid reply</div>
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
                  <div className="muted">No bid reply yet.</div>
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
                    <div className="kicker">Bid round</div>
                    <h3 style={{ marginTop: 4 }}>{bidRoundTitle(tender.title)}</h3>
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
            )) : <div className="muted">No bid requests yet.</div>}
          </div>
          </SectionCard>
        </details>
      ) : null}

      <div className="requestDetailGrid">
        <div className="stack">
          <div id="summary">
          <SectionCard kicker="Summary" title="Request summary" subtitle="Who reported it, where it is, and the details needed to decide.">
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
                <div><strong>First reviewed</strong><div className="muted">{data.request.firstReviewedAt ? formatDateTime(data.request.firstReviewedAt) : 'Not yet reviewed'}</div></div>
              </div>
              <RequestSignalStrip request={data.request} />
              {data.request.reviewState && !['none', 'approved'].includes(data.request.reviewState) ? (
                <div className="notice error">Review: {reviewStateLabel(data.request.reviewState)}{data.request.reviewNote ? ` - ${data.request.reviewNote}` : ''}</div>
              ) : null}
            </div>
          </SectionCard>
          </div>

          <div id="communication">
          <SectionCard kicker="Messages" title="Tenant and internal notes">
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
            )) : <div className="muted">No messages yet.</div>}
            <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
              <AddCommentForm requestId={data.request.id} defaultVisibility={defaultCommentVisibility} />
            </div>
          </SectionCard>
          </div>

          <div id="timeline">
          <SectionCard kicker="Timeline" title="Work history" subtitle="Vendor visits, status changes, and supporting records.">
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

          {resolvedVendorCommercialItems.length ? (
          <SectionCard kicker="Invoices" title="Resolved vendor costs" subtitle="Approved or declined bids, fees, extra costs, and invoices sent from the vendor portal.">
            {resolvedVendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted">
                  {(item.vendorName ?? 'Vendor')} - {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {new Date(item.submittedAt).toLocaleString()}
                </div>
                <div className="muted">Status: {vendorCommercialStatusLabel(item.status)}</div>
                {item.description ? <div>{item.description}</div> : null}
              </div>
            ))}
          </SectionCard>
          ) : null}

        </div>
      </div>

      <div className="grid cols-3 requestEvidenceGrid">
        <SectionCard kicker="Photos" title="Tenant photos">
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

        <SectionCard kicker="Photos" title="Vendor photos">
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

      </div>

      {hasVendorChosen || data.billingDocuments.length ? (
      <div id="billing">
      <SectionCard kicker="Billing records" title="Billing records, chargebacks, and closeout" subtitle="Follow this order: approve vendor costs, decide tenant chargeback, create/send documents, mark paid, then close.">
        <div className="stack billingCompact" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 14, background: 'var(--table-row)' }}>
            <div className="kicker">Step 1: Tenant chargeback decision</div>
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
            <div className="kicker">Step 2: Vendor payment amount</div>
            <div className="detailFactsGrid" style={{ marginTop: 10 }}>
              <div><strong>Approved total</strong><div className="muted">{formatMoney(vendorAmountOwedCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Paid</strong><div className="muted">{formatMoney(postedVendorPaymentCents, data.request.preferredCurrency)}</div></div>
              <div><strong>Still owed</strong><div className="muted">{formatMoney(vendorOutstandingCents, data.request.preferredCurrency)}</div></div>
            </div>
            {(pendingVendorExtrasCents > 0 || approvedVendorExtrasCents > 0 || postedVendorPaymentBalanceCents > 0) ? (
              <details className="advancedDisclosure" style={{ marginTop: 10 }}>
                <summary>Show the math</summary>
                <div className="detailFactsGrid" style={{ marginTop: 10 }}>
                  <div><strong>Approved bid</strong><div className="muted">{formatMoney(approvedBidCents, data.request.preferredCurrency)}</div></div>
                  <div><strong>Approved extras</strong><div className="muted">{formatMoney(approvedVendorExtrasCents, data.request.preferredCurrency)}</div></div>
                  <div><strong>Pending extras</strong><div className="muted">{formatMoney(pendingVendorExtrasCents, data.request.preferredCurrency)}</div></div>
                  <div><strong>If pending approved</strong><div className="muted">{formatMoney(vendorAmountIfPendingApprovedCents, data.request.preferredCurrency)}</div></div>
                  <div><strong>Payment balance</strong><div className="muted">{formatMoney(postedVendorPaymentBalanceCents, data.request.preferredCurrency)}</div></div>
                </div>
              </details>
            ) : null}
            {isCompleteButUnpaid ? (
              <div className="inlineNotice" style={{ marginTop: 10 }}>
                {closeoutLanguage.detail}
              </div>
            ) : null}
            <div className="muted" style={{ marginTop: 10 }}>
              Approved vendor bids and overages create the vendor amount owed. Track payment records here, but handle money movement outside the app. Do not close the request until vendor payment and any tenant chargeback are settled.
            </div>
          </div>
          {billingOpenBalanceCents === 0 && data.billingDocuments.length ? (
            <div className="notice success">
              <strong>Billing settled.</strong> No open tenant charges or vendor balances remain.
            </div>
          ) : (
            <div className="notice">
              <strong>Closeout checklist:</strong> approve vendor costs, decide whether the tenant is charged, create/send the tenant charge or vendor payment record, mark every open balance paid, then close the request.
            </div>
          )}
          <BillingSummaryCards documents={data.billingDocuments} />
          {hasVendorChosen ? (
            <BillingDocumentForm
              requestId={data.request.id}
              tenantEmail={data.request.submittedByEmail}
              vendorEmail={data.request.assignedVendorEmail}
              tenantBillbackDecision={data.request.tenantBillbackDecision}
              tenantBillbackAmountCents={data.request.tenantBillbackAmountCents}
              tenantBillbackReason={data.request.tenantBillbackReason}
            />
          ) : (
            <div className="notice">Choose a vendor before creating invoices or payments for this request.</div>
          )}
          <BillingDocumentList documents={data.billingDocuments} requestId={data.request.id} />
          <BillingEventList documents={data.billingDocuments} />
        </div>
      </SectionCard>
      </div>
      ) : null}
    </div>
  )
}
