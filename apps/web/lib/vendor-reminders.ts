import { deriveVendorNextAction, deriveVendorRequestViewState, type VendorNextAction } from '@/lib/vendor-request-state'
import { upfrontPaymentCents, vendorPaymentTimingRequiresUpfront } from '@/lib/vendor-commercial-types'

const REMINDABLE_ACTIONS = new Set([
  'respond_bid',
  'accept_service_call',
  'add_appointment',
  'send_service_charge',
  'mark_complete',
  'send_final_invoice',
  'send_update',
])

type ReminderInvite = { vendorId: string; status: string; awardedAt?: Date | null; createdAt: Date }
type ReminderCommercialItem = { vendorId: string; itemType: string; status: string; amountCents: number; paymentTiming?: string | null }
type ReminderBillingDocument = { recipientType: string; status: string; totalCents: number; paidCents: number }

export function remindersEnabledForRequest(globalEnabled: boolean, requestOverride?: boolean | null) {
  return requestOverride ?? globalEnabled
}

export function isVendorActionRemindable(action: VendorNextAction) {
  return REMINDABLE_ACTIONS.has(action.key)
    && Boolean(action.href || action.showResponseForm || action.showCommercialForm)
}

// The automation query and vendor portal load the same request shape from Prisma.
// Keeping this calculation here ensures reminder emails follow the portal's next action.
export function deriveAssignedVendorReminderAction(request: any, vendorId: string): VendorNextAction | null {
  const workMarkedComplete = request.status === 'completed'
    || request.dispatchStatus === 'completed'
    || request.reviewState === 'vendor_completed_pending_review'
  const invites = (request.tenderInvites ?? []) as ReminderInvite[]
  const latestInvite = [...invites]
    .filter((invite) => invite.vendorId === vendorId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const viewState = deriveVendorRequestViewState({
    assignedVendorId: request.assignedVendorId,
    requestStatus: workMarkedComplete && !['closed', 'canceled'].includes(request.status) ? 'completed' : request.status,
    viewerVendorId: vendorId,
    latestInvite,
    billingDocuments: request.billingDocuments ?? [],
  })
  const vendorItems = ((request.vendorCommercialItems ?? []) as ReminderCommercialItem[]).filter((item) => item.vendorId === vendorId)
  const hasPendingCostOrInvoice = vendorItems.some((item) => item.itemType !== 'bid' && item.status === 'submitted')
  const hasApprovedCostOrInvoice = vendorItems.some((item) => item.itemType !== 'bid' && item.status === 'approved')
  const hasActiveCostOrInvoice = vendorItems.some((item) => item.itemType !== 'bid' && item.status !== 'declined')
  const activeFinalInvoice = vendorItems.find((item) => item.itemType === 'bill_to_property_manager' && item.status !== 'declined')
  const vendorDocuments = ((request.billingDocuments ?? []) as ReminderBillingDocument[]).filter((document) => document.recipientType === 'vendor' && document.status !== 'void')
  const vendorOpenBalanceCents = vendorDocuments.reduce((sum, document) => sum + Math.max(document.totalCents - document.paidCents, 0), 0)
  const approvedUpfrontCents = vendorItems
    .filter((item) => item.itemType !== 'bid' && item.status === 'approved' && vendorPaymentTimingRequiresUpfront(item.paymentTiming))
    .reduce((sum, item) => sum + upfrontPaymentCents(item.amountCents, item.paymentTiming), 0)
  const vendorPaidCents = vendorDocuments.reduce((sum, document) => sum + Math.min(document.totalCents, document.paidCents), 0)
  const hasAppointmentTime = Boolean(request.vendorScheduledStart)

  const action = deriveVendorNextAction({
    requestStatus: request.status,
    dispatchStatus: request.dispatchStatus,
    canControlDispatch: viewState.canControlDispatch,
    isPendingBid: viewState.isPendingBid,
    workMarkedComplete,
    hasAppointmentTime,
    needsAppointmentTime: !workMarkedComplete && viewState.canControlDispatch && !hasAppointmentTime
      && ['vendor_selected', 'scheduled', 'in_progress'].includes(request.status),
    hasPendingCostOrInvoice,
    hasApprovedCostOrInvoice,
    hasActiveCostOrInvoice,
    activeFinalInvoiceStatus: activeFinalInvoice?.status ?? null,
    vendorOpenBalanceCents,
    upfrontVendorPaymentDueCents: Math.max(approvedUpfrontCents - vendorPaidCents, 0),
    awardedFromBid: invites.some((invite) => invite.vendorId === vendorId && (invite.status === 'awarded' || invite.awardedAt)),
  })

  return isVendorActionRemindable(action) ? action : null
}

export function vendorReminderIsDue(lastSentAt: Date | null | undefined, actionableSince: Date, now = new Date()) {
  const reference = lastSentAt ?? actionableSince
  return now.getTime() - reference.getTime() >= 24 * 60 * 60 * 1000
}
