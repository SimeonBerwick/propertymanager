import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { languageLabel } from '@/lib/types'
import { formatDateTime } from '@/lib/ui-utils'
import { StatusBadge } from '@/components/status-badge'
import { RequestSignalStrip } from '@/components/request-signal-strip'
import { formatAppointmentWindow } from '@/lib/appointment-time'
import { SectionCard } from '@/components/section-card'
import { formatMoney } from '@/lib/billing-utils'
import { MediaPhotoCard } from '@/components/media-photo-card'
import { AddCommentForm } from './add-comment-form'
import { cleanVendorCommercialDescription, vendorCommercialStatusLabel, vendorCommercialTypeLabel, vendorPaymentTimingLabel } from '@/lib/vendor-commercial-types'
import { VendorCommercialApprovalForm } from './vendor-commercial-approval-form'
import { RequestControlPanel } from './request-control-panel'
import { InlineRequestEditor } from './inline-request-editor'
import { GuidedRequestWorkflow } from '@/components/guided-request-workflow'
import { WorkOrderStatusPanel } from '@/components/work-order-status-panel'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { deriveWorkOrderStateSummary } from '@/lib/work-order-state'
import { MoneyCloseoutPanel } from '@/components/money-closeout-panel'
import { SectionJumpLink } from '@/components/section-jump-link'

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

function WorkOrderContext({ request }: { request: { title: string; propertyName: string; unitLabel: string } }) {
  return (
    <div className="inlineNotice">
      <strong>{request.title}</strong>
      {' '}
      <span>{request.propertyName} - {request.unitLabel}</span>
    </div>
  )
}

function displayDispatchStatus(status: string) {
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
  const latestScheduledDispatch = [...data.dispatchHistory]
    .filter((entry) => entry.scheduledStart)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const latestVisibleReply = [...data.comments]
    .filter((comment) => comment.visibility === 'external')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const tenantTimelineMessages = [...data.comments]
    .filter((comment) => comment.visibility === 'external' && comment.body.startsWith('Tenant message:'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const latestTenantMessage = tenantTimelineMessages[0]
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
  const hasActiveBidInvitations = (data.request.activeTenderInviteCount ?? 0) > 0
  const hasVendorChosen = !hasActiveBidInvitations && Boolean(payableVendorId || data.request.assignedVendorName || data.request.assignedVendorEmail)
  const approvedBidCents = awardedTenderBid?.bidAmountCents ?? acceptedVendorBid?.amountCents ?? 0
  const approvedFinalInvoice = data.vendorCommercialItems
    .filter((item) => item.status === 'approved' && item.itemType === 'bill_to_property_manager' && (!payableVendorId || item.vendorId === payableVendorId))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
  const pendingFinalInvoice = data.vendorCommercialItems
    .filter((item) => item.status === 'submitted' && item.itemType === 'bill_to_property_manager' && (!payableVendorId || item.vendorId === payableVendorId))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
  const approvedVendorExtrasCents = approvedFinalInvoice ? 0 : data.vendorCommercialItems
    .filter((item) => item.status === 'approved' && item.itemType !== 'bid' && item.itemType !== 'bill_to_property_manager' && (!payableVendorId || item.vendorId === payableVendorId))
    .reduce((sum, item) => sum + item.amountCents, 0)
  const vendorCommercialChargeRecords = data.vendorCommercialItems
    .filter((item) => ['approved', 'submitted'].includes(item.status) && item.itemType !== 'bid' && (!payableVendorId || item.vendorId === payableVendorId))
  const pendingVendorExtrasCents = pendingFinalInvoice ? Math.max(pendingFinalInvoice.amountCents - (approvedFinalInvoice?.amountCents ?? 0), 0) : data.vendorCommercialItems
    .filter((item) => item.status === 'submitted' && item.itemType !== 'bid' && item.itemType !== 'bill_to_property_manager' && (!payableVendorId || item.vendorId === payableVendorId))
    .reduce((sum, item) => sum + item.amountCents, 0)
  const approvedVendorCeilingCents = approvedBidCents + approvedVendorExtrasCents
  const vendorAmountOwedCents = approvedFinalInvoice?.amountCents ?? approvedVendorExtrasCents
  const approvedOverageCents = approvedFinalInvoice ? Math.max(approvedFinalInvoice.amountCents - approvedBidCents, 0) : approvedVendorExtrasCents
  const vendorAmountIfPendingApprovedCents = pendingFinalInvoice ? pendingFinalInvoice.amountCents : vendorAmountOwedCents + pendingVendorExtrasCents
  const postedVendorPayments = data.billingDocuments.filter((doc) => doc.recipientType === 'vendor' && doc.status !== 'void')
  const postedVendorPaymentCents = postedVendorPayments.reduce((sum, doc) => sum + doc.totalCents, 0)
  const postedVendorPaymentBalanceCents = postedVendorPayments.reduce((sum, doc) => sum + Math.max(doc.totalCents - doc.paidCents, 0), 0)
  const unpostedVendorOwedCents = Math.max(vendorAmountOwedCents - postedVendorPaymentCents, 0)
  const vendorOutstandingCents = postedVendorPaymentBalanceCents + unpostedVendorOwedCents
  const hasVendorBillOrChargeOnRecord = vendorCommercialChargeRecords.length > 0
    || postedVendorPayments.length > 0
  const vendorBillPending = data.request.status === 'completed'
    && hasVendorChosen
    && !hasVendorBillOrChargeOnRecord
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
  const pendingVendorCommercialItems = data.vendorCommercialItems.filter((item) => (
    item.status === 'submitted'
    && !(item.itemType === 'bill_to_property_manager' && item.amountCents <= approvedVendorCeilingCents)
  ))
  const resolvedVendorCommercialItems = data.vendorCommercialItems.filter((item) => item.status !== 'submitted')
  const canChooseVendor = !hasVendorChosen && ['approved', 'reopened'].includes(data.request.status) && !data.tenders.some((tender) => tender.status !== 'canceled')
  const reviewNoteLower = (data.request.reviewNote ?? '').toLowerCase()
  const hasTenantQuestionReviewNote = reviewNoteLower.includes('tenant asked') || reviewNoteLower.includes('tenant requested')
  const hasTenantMessageReview = data.request.reviewState === 'needs_follow_up'
    && data.request.status !== 'requested'
    && hasTenantQuestionReviewNote
    && Boolean(latestTenantMessage)
  const paymentActionIsNext = billingOpenBalanceCents > 0 || vendorOutstandingCents > 0 || (data.request.upfrontVendorPaymentDueCents ?? 0) > 0
  const hasVendorUpdateReview = data.request.status !== 'requested'
    && !hasTenantQuestionReviewNote
    && !paymentActionIsNext
    && (
      data.request.reviewState === 'needs_follow_up'
      || data.request.reviewState === 'vendor_update_pending_review'
      || data.request.reviewState === 'vendor_completed_pending_review'
    )
  const effectiveVendorScheduledStart = data.request.vendorScheduledStart ?? latestScheduledDispatch?.scheduledStart
  const effectiveVendorScheduledEnd = data.request.vendorScheduledEnd ?? latestScheduledDispatch?.scheduledEnd
  const isEffectivelyCompleted = data.request.status === 'completed'
    || data.request.dispatchStatus === 'completed'
    || data.request.reviewState === 'vendor_completed_pending_review'
  const effectiveRequestStatus = isEffectivelyCompleted && data.request.status !== 'closed' ? 'completed' : data.request.status
  const requestWithEffectiveAppointment = {
    ...data.request,
    status: effectiveRequestStatus,
    vendorScheduledStart: effectiveVendorScheduledStart,
    vendorScheduledEnd: effectiveVendorScheduledEnd,
  }
  const needsAppointmentTime = !isEffectivelyCompleted && hasVendorChosen && !hasActiveBidInvitations && !effectiveVendorScheduledStart && ['approved', 'vendor_selected', 'scheduled', 'reopened'].includes(data.request.status)
  const upfrontVendorPaymentDueCents = data.request.upfrontVendorPaymentDueCents ?? 0
  const tenantChargebackCents = data.request.tenantBillbackDecision === 'bill_tenant' ? data.request.tenantBillbackAmountCents ?? 0 : 0
  const hasTenantChargeDocument = data.billingDocuments.some((doc) => doc.recipientType === 'tenant' && doc.documentType === 'tenant_invoice' && doc.status !== 'void')
  const needsTenantChargeDocument = tenantChargebackCents > 0 && !hasTenantChargeDocument
  const needsVendorPaymentDocument = unpostedVendorOwedCents > 0
  const needsBillingDocument = needsTenantChargeDocument || needsVendorPaymentDocument
  const billingIsSettled = billingOpenBalanceCents === 0 && !needsBillingDocument && !vendorBillPending
  const moneyAction = pendingVendorCommercialItems.length
    ? null
    : upfrontVendorPaymentDueCents > 0 && !isEffectivelyCompleted
      ? {
          title: 'Record upfront vendor payment',
          subtitle: 'The approved vendor terms require money before the work moves forward.',
          detail: 'Mark the vendor payment record paid after money is handled outside the app.',
          button: 'Go to payment record',
        }
    : billingOpenBalanceCents > 0
      ? {
          title: 'Record vendor payment',
          subtitle: 'A vendor payment record is open.',
          detail: 'Mark the payment record paid after money is handled outside the app.',
          button: 'Go to payment record',
        }
    : vendorOutstandingCents > 0
      ? {
          title: 'Create vendor payment record',
          subtitle: 'The vendor amount is approved, but no payment record exists yet.',
          detail: 'Create the vendor payment record in the billing panel.',
          button: 'Create payment record',
        }
    : null
  const actionSectionTitle = pendingVendorCommercialItems.length
    ? 'Approve vendor cost'
    : data.request.status === 'requested'
      ? 'Review request'
    : hasTenantMessageReview
      ? 'Review tenant question'
    : hasVendorUpdateReview
      ? 'Review vendor update'
    : moneyAction
      ? moneyAction.title
    : needsAppointmentTime
    ? 'Add appointment time'
    : hasSubmittedBid
      ? 'Approve vendor bid'
      : canChooseVendor
        ? 'Choose service-call or bid path'
        : ['completed', 'closed'].includes(effectiveRequestStatus)
          ? 'Close request actions'
          : 'Request actions'
  const actionSectionSubtitle = pendingVendorCommercialItems.length
    ? 'Review the vendor charge before billing, payment, or closeout.'
    : data.request.status === 'requested'
      ? 'Decide whether this work order should move forward before vendor scheduling or costs.'
    : hasTenantMessageReview
      ? 'The tenant sent a question on this work order. Reply or decide whether the request needs a status change.'
    : hasVendorUpdateReview
      ? 'The latest vendor update is shown here so you can decide what to do next.'
    : moneyAction
      ? moneyAction.subtitle
    : needsAppointmentTime
    ? 'Enter the confirmed appointment time here. After saving, send the tenant update.'
    : hasSubmittedBid
      ? 'Review returned pricing and choose the vendor.'
      : canChooseVendor
        ? 'Assign a trusted vendor for the service call, or ask vendors for repair bids before choosing.'
        : ['completed', 'closed'].includes(effectiveRequestStatus)
          ? 'Reopen only if more work is needed.'
          : 'Choose the next clear step for this request.'
  const managerAppointmentLabel = effectiveVendorScheduledStart ? formatAppointmentWindow(effectiveVendorScheduledStart, effectiveVendorScheduledEnd) : null
  const managerMoneyLabel = billingOpenBalanceCents > 0
    ? `Open balance ${formatMoney(billingOpenBalanceCents, data.request.preferredCurrency)}`
    : vendorOutstandingCents > 0
      ? `Vendor balance ${formatMoney(vendorOutstandingCents, data.request.preferredCurrency)}`
      : pendingVendorExtrasCents > 0
        ? `Pending vendor amount ${formatMoney(pendingVendorExtrasCents, data.request.preferredCurrency)}`
        : null
  const managerLatestSignal = latestTenantMessage
    ? `Tenant: ${latestTenantMessage.body.replace(/^Tenant message:\s*/i, '')}`
    : latestCommercialReply
      ? `Vendor: ${vendorCommercialTypeLabel(latestCommercialReply.itemType)} ${formatMoney(latestCommercialReply.amountCents, latestCommercialReply.currency)}`
      : latestVendorDispatch
        ? `Vendor: ${displayDispatchStatus(latestVendorDispatch.status)}`
        : latestVisibleReply
          ? `Note: ${latestVisibleReply.body}`
          : null
  const managerWorkOrderSummary = deriveWorkOrderStateSummary({
    audience: 'manager',
    id: data.request.id,
    status: effectiveRequestStatus,
    reviewState: data.request.reviewState,
    assignedVendorName: data.request.assignedVendorName,
    vendorScheduledStart: effectiveVendorScheduledStart,
    pendingVendorApprovalCount: pendingVendorCommercialItems.length,
    pendingBidCount: data.request.pendingBidCount,
    activeTenderInviteCount: data.request.activeTenderInviteCount,
    billingOpenBalanceCents,
    vendorPayableBalanceCents: vendorOutstandingCents,
    upfrontVendorPaymentDueCents,
    vendorBillPending,
    needsAppointmentTime,
    canChooseVendor,
    hasTenantMessageReview,
    hasVendorUpdateReview,
    workMarkedComplete: isEffectivelyCompleted,
    latestSignal: managerLatestSignal,
    moneyLabel: managerMoneyLabel,
    appointmentLabel: managerAppointmentLabel,
  })

  return (
    <div className="stack requestDetailPage">
      <div className="requestMobileContext">
        <strong>{data.request.title}</strong>
        <span>{data.request.propertyName} - {data.request.unitLabel}</span>
      </div>
      <WorkOrderStatusPanel summary={managerWorkOrderSummary} />

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
            {isCompleteButUnpaid ? <span className="badge billing-partial">{closeoutLanguage.managerLabel}</span> : <StatusBadge status={effectiveRequestStatus} />}
            {isCompleteButUnpaid ? <span className="badge billing-partial">Vendor unpaid</span> : null}
            <span className="muted">{data.request.category}</span>
            <span className="muted">Submitted {formatDateTime(data.request.createdAt)}</span>
          </div>
          <RequestSignalStrip request={data.request} showReviewState={false} />
          <InlineRequestEditor request={data.request} />
        </div>
      </section>

      <GuidedRequestWorkflow request={requestWithEffectiveAppointment} />

      <div id="actions">
      <SectionCard kicker="Actions" title={actionSectionTitle} subtitle={actionSectionSubtitle}>
        <WorkOrderContext request={data.request} />
        {hasTenantMessageReview ? (
          <div id="tenant-message-review" className="timelineRow spotlightSuccess stack tenantReplyAction" style={{ gap: 12 }}>
            <div className="stack" style={{ gap: 8 }}>
              <div>
                <div className="kicker">Tenant message to review</div>
                <h3 style={{ margin: '4px 0 0' }}>Tenant question</h3>
              </div>
              <div>{latestTenantMessage?.body.replace(/^Tenant message:\s*/i, '')}</div>
              <div className="muted">
                Sent by {latestTenantMessage?.authorName ?? data.request.submittedByName ?? 'Tenant'}{latestTenantMessage ? ` - ${formatDateTime(latestTenantMessage.createdAt)}` : ''}
              </div>
              {effectiveVendorScheduledStart ? (
                <div className="inlineNotice">
                  <strong>Current appointment</strong>
                  <span>{formatAppointmentWindow(effectiveVendorScheduledStart, effectiveVendorScheduledEnd)}</span>
                </div>
              ) : null}
            </div>
            <AddCommentForm requestId={data.request.id} defaultVisibility="external" />
          </div>
        ) : hasVendorUpdateReview ? (
          <div id="vendor-update-review" className="timelineRow spotlightSuccess">
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 8 }}>
                <div>
                  <div className="kicker">Vendor update to review</div>
                  <h3 style={{ margin: '4px 0 0' }}>{latestVendorDispatch?.vendorName ?? data.request.assignedVendorName ?? 'Vendor update'}</h3>
                </div>
                {latestVendorDispatch ? (
                  <>
                    <div><strong>Status:</strong> {displayDispatchStatus(latestVendorDispatch.status)}</div>
                    {latestVendorDispatch.note ? <div>{latestVendorDispatch.note}</div> : <div className="muted">No note attached.</div>}
                    {(latestVendorDispatch.scheduledStart || latestVendorDispatch.scheduledEnd) ? (
                      <div className="muted">
                        Appointment: {latestVendorDispatch.scheduledStart ? formatAppointmentWindow(latestVendorDispatch.scheduledStart, latestVendorDispatch.scheduledEnd) : '-'}
                      </div>
                    ) : null}
                    <div className="muted">Sent {formatDateTime(latestVendorDispatch.createdAt)}</div>
                  </>
                ) : (
                  <div className="muted">No vendor work update was found in the timeline.</div>
                )}
                {latestCommercialReply ? (
                  <div className="inlineNotice">
                    <strong>Latest vendor charge</strong>
                    <span>
                      {latestCommercialReply.title} - {vendorCommercialTypeLabel(latestCommercialReply.itemType)} - {formatMoney(latestCommercialReply.amountCents, latestCommercialReply.currency)} - {vendorCommercialStatusLabel(latestCommercialReply.status)}
                    </span>
                  </div>
                ) : null}
              </div>
              {pendingVendorCommercialItems.length ? <SectionJumpLink href="#vendor-approvals" className="button primary">Review vendor charge</SectionJumpLink> : <SectionJumpLink href="#timeline" className="button">View timeline</SectionJumpLink>}
            </div>
          </div>
        ) : null}
        {hasTenantMessageReview ? null : moneyAction ? (
          <div className="notice stack" style={{ gap: 10 }}>
            <div>
              <strong>{moneyAction.title}</strong>
              <div className="muted">{moneyAction.detail}</div>
            </div>
            <SectionJumpLink href="#billing" className="button primary" style={{ alignSelf: 'flex-start' }}>{moneyAction.button}</SectionJumpLink>
          </div>
        ) : (
          <RequestControlPanel
            request={requestWithEffectiveAppointment}
            vendors={data.availableVendors}
            tenders={data.tenders}
            statusControlPriority={canChooseVendor || hasSubmittedBid || pendingVendorCommercialItems.length > 0 || hasTenantMessageReview || hasVendorUpdateReview ? 'secondary' : 'primary'}
            canCloseRequest={billingIsSettled}
            upfrontVendorPaymentDueCents={upfrontVendorPaymentDueCents}
          />
        )}
      </SectionCard>
      </div>


      {pendingVendorCommercialItems.length ? (
        <div id="vendor-approvals">
        <SectionCard
          kicker="Money decision needed"
          title={data.request.status === 'completed' ? 'Approve vendor cost before billing' : 'Review vendor cost submission'}
          subtitle={data.request.status === 'completed' ? 'This must be approved before vendor payment, tenant chargeback, or closeout.' : 'Approving records the vendor amount. Closeout still waits until the work is marked complete.'}
        >
          <WorkOrderContext request={data.request} />
          <div className="stack" style={{ gap: 12 }}>
            {pendingVendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow spotlightSuccess">
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div className="muted">
                      {(item.vendorName ?? 'Vendor')} - {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {formatDateTime(item.submittedAt)}
                    </div>
                    <div className="muted">Payment timing: {vendorPaymentTimingLabel(item.paymentTiming)}</div>
                    {cleanVendorCommercialDescription(item.description) ? <div>{cleanVendorCommercialDescription(item.description)}</div> : null}
                    {item.attachmentUrl ? <a href={`/api/vendor-commercial-items/${item.id}/attachment`} target="_blank" rel="noreferrer" className="button">Open bill attachment</a> : null}
                  </div>
                  <span className="badge billing-partial">{data.request.status === 'completed' ? 'Approve before billing' : 'Review submission'}</span>
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
        <SectionJumpLink href="#summary">Summary</SectionJumpLink>
        <SectionJumpLink href="#actions">Next step</SectionJumpLink>
        <SectionJumpLink href="#timeline">Timeline</SectionJumpLink>
        {pendingVendorCommercialItems.length ? <SectionJumpLink href="#vendor-approvals">Approvals</SectionJumpLink> : null}
        {hasVendorChosen || data.billingDocuments.length ? <SectionJumpLink href="#billing">Billing records</SectionJumpLink> : null}
        {hasBidDetails ? <SectionJumpLink href="#advanced">More details</SectionJumpLink> : null}
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
                    <div className="muted">{formatDateTime(latestTenderReply.activityAt)}</div>
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
                    <div className="muted">{formatDateTime(latestVendorDispatch.createdAt)}</div>
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
                    <div className="muted">{formatDateTime(latestVisibleReply.createdAt)}</div>
                  </>
                ) : latestCommercialReply ? (
                  <>
                    <div className="signalTitle" style={{ fontSize: 18 }}>{latestCommercialReply.title}</div>
                    <div className="signalAccent">{vendorCommercialTypeLabel(latestCommercialReply.itemType)}</div>
                    <div className="muted">{formatDateTime(latestCommercialReply.submittedAt)}</div>
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
                      {tender.sentAt ? ` - Sent ${formatDateTime(tender.sentAt)}` : ''}
                      {tender.awardedAt ? ` - Awarded ${formatDateTime(tender.awardedAt)}` : ''}
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
                          {invite.proposedStart ? formatAppointmentWindow(invite.proposedStart, invite.proposedEnd) : '-'}
                        </div>
                      ) : null}
                      <div className="muted">
                        Invited {formatDateTime(invite.invitedAt)}
                        {invite.respondedAt ? ` - Replied ${formatDateTime(invite.respondedAt)}` : ''}
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
                <div><strong>First reviewed</strong><div className="muted">{data.request.firstReviewedAt ? formatDateTime(data.request.firstReviewedAt) : data.request.status === 'requested' ? 'Not yet reviewed' : 'Reviewed'}</div></div>
              </div>
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
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{formatDateTime(comment.createdAt)}</div>
              </div>
            )) : <div className="muted">No messages yet.</div>}
            <div style={{ borderTop: data.comments.length ? undefined : '1px solid var(--border)', paddingTop: 12 }}>
              <AddCommentForm requestId={data.request.id} defaultVisibility={hasTenantMessageReview ? 'internal' : defaultCommentVisibility} />
            </div>
          </SectionCard>
          </div>

          <div id="timeline">
          <SectionCard kicker="Timeline" title="Work history" subtitle="Appointments, status changes, and supporting records.">
            {tenantTimelineMessages.length ? tenantTimelineMessages.map((comment) => (
              <div key={comment.id} className="timelineRow spotlightSuccess">
                <div style={{ fontWeight: 600 }}>Tenant question</div>
                <div>{comment.body.replace(/^Tenant message:\s*/i, '')}</div>
                <div className="muted">{comment.authorName} - {formatDateTime(comment.createdAt)}</div>
              </div>
            )) : null}
            {data.dispatchHistory.length ? data.dispatchHistory.map((entry) => (
              <div key={entry.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>
                  {entry.vendorName ? `${entry.vendorName} - ` : ''}{entry.status}
                </div>
                {entry.note ? <div>{entry.note}</div> : null}
                {(entry.scheduledStart || entry.scheduledEnd) ? (
                  <div className="muted">
                    {entry.scheduledStart ? formatAppointmentWindow(entry.scheduledStart, entry.scheduledEnd) : '-'}
                  </div>
                ) : null}
                <div className="muted">{entry.actorName} - {formatDateTime(entry.createdAt)}</div>
              </div>
            )) : tenantTimelineMessages.length ? null : <div className="muted">No work activity yet.</div>}
          </SectionCard>
          </div>

          {resolvedVendorCommercialItems.length ? (
          <SectionCard kicker="Invoices" title="Resolved vendor costs" subtitle="Approved or declined bids, fees, extra costs, and invoices sent from the vendor portal.">
            {resolvedVendorCommercialItems.map((item) => (
              <div key={item.id} className="timelineRow">
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted">
                  {(item.vendorName ?? 'Vendor')} - {vendorCommercialTypeLabel(item.itemType)} - {formatMoney(item.amountCents, item.currency)} - {formatDateTime(item.submittedAt)}
                </div>
                <div className="muted">Status: {vendorCommercialStatusLabel(item.status)}</div>
                <div className="muted">Payment timing: {vendorPaymentTimingLabel(item.paymentTiming)}</div>
                {cleanVendorCommercialDescription(item.description) ? <div>{cleanVendorCommercialDescription(item.description)}</div> : null}
                {item.attachmentUrl ? <a href={`/api/vendor-commercial-items/${item.id}/attachment`} target="_blank" rel="noreferrer" className="button">Open bill attachment</a> : null}
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
        <MoneyCloseoutPanel
          request={data.request}
          billingDocuments={data.billingDocuments}
          vendorBillPending={vendorBillPending}
          vendorAmountOwedCents={vendorAmountOwedCents}
          approvedBidCents={approvedBidCents}
          approvedOverageCents={approvedOverageCents}
          pendingVendorExtrasCents={pendingVendorExtrasCents}
          vendorOutstandingCents={vendorOutstandingCents}
          postedVendorPaymentCents={postedVendorPaymentCents}
          postedVendorPaymentBalanceCents={postedVendorPaymentBalanceCents}
          billingOpenBalanceCents={billingOpenBalanceCents}
          needsTenantChargeDocument={needsTenantChargeDocument}
          needsVendorPaymentDocument={needsVendorPaymentDocument}
          billingIsSettled={billingIsSettled}
          hasVendorChosen={hasVendorChosen}
          approvedFinalInvoice={approvedFinalInvoice}
          pendingFinalInvoice={pendingFinalInvoice}
          approvedVendorExtrasCents={approvedVendorExtrasCents}
          vendorAmountIfPendingApprovedCents={vendorAmountIfPendingApprovedCents}
        />
      ) : null}
    </div>
  )
}
