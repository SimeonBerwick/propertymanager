import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

type VendorInviteState = {
  status?: string
  awardedAt?: string | Date | null
}

type BillingDocumentLike = {
  status?: string | null
  totalCents: number
  paidCents: number
}

type VendorRequestStateInput = {
  assignedVendorId?: string | null
  requestStatus: string
  viewerVendorId: string
  latestInvite?: VendorInviteState | null
  billingDocuments?: BillingDocumentLike[]
}

export type VendorRequestViewState = {
  canControlDispatch: boolean
  canSeeSchedule: boolean
  shouldShowOccupant: boolean
  isAwardedToViewer: boolean
  isOpenWork: boolean
  isPendingBid: boolean
  statusLabel: string
  tenderLabel: string
  heroNotice:
    | {
        title: string
        detail: string
        tone: 'success' | 'info'
      }
    | null
}

export type VendorNextActionKey =
  | 'done'
  | 'review_tenant_message'
  | 'respond_bid'
  | 'accept_service_call'
  | 'add_appointment'
  | 'waiting_manager_cost'
  | 'send_service_charge'
  | 'mark_complete'
  | 'send_final_invoice'
  | 'waiting_final_invoice_review'
  | 'waiting_payment_record'
  | 'send_update'
  | 'wait'

export type VendorNextAction = {
  key: VendorNextActionKey
  label: string
  detail: string
  href?: string
  attentionLabel: string
  showResponseForm: boolean
  showCommercialForm: boolean
  initialResponse?: string
  defaultItemType?: 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'
  context?: 'general' | 'service_call'
}

export type VendorNextActionInput = {
  requestStatus: string
  dispatchStatus?: string | null
  isPaidClosed?: boolean
  canControlDispatch?: boolean
  isPendingBid?: boolean
  workMarkedComplete?: boolean
  hasAppointmentTime?: boolean
  needsAppointmentTime?: boolean
  hasTenantAppointmentRequest?: boolean
  hasPendingCostOrInvoice?: boolean
  hasApprovedCostOrInvoice?: boolean
  hasActiveCostOrInvoice?: boolean
  activeFinalInvoiceStatus?: string | null
  vendorOpenBalanceCents?: number
  upfrontVendorPaymentDueCents?: number
  awardedFromBid?: boolean
}

function vendorAction(input: Omit<VendorNextAction, 'attentionLabel'> & { attentionLabel?: string }): VendorNextAction {
  return {
    ...input,
    attentionLabel: input.attentionLabel ?? input.label,
  }
}

export function deriveVendorNextAction(input: VendorNextActionInput): VendorNextAction {
  if (input.isPaidClosed || ['closed', 'declined', 'canceled'].includes(input.requestStatus)) {
    return vendorAction({
      key: 'done',
      label: 'No action needed',
      detail: 'This request is no longer active for your vendor account.',
      attentionLabel: 'Done',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.hasTenantAppointmentRequest && input.canControlDispatch) {
    return vendorAction({
      key: 'review_tenant_message',
      label: 'Review tenant message',
      detail: 'The tenant asked about the appointment. Check the message before sending another update.',
      href: '#tenant-message',
      attentionLabel: 'Tenant message needs review',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.isPendingBid) {
    return vendorAction({
      key: 'respond_bid',
      label: 'Respond to bid invite',
      detail: 'Send your bid amount, timing, and availability for manager approval.',
      href: '#vendor-next-action',
      attentionLabel: 'Respond to bid invite',
      showResponseForm: true,
      showCommercialForm: false,
      initialResponse: 'accepted',
    })
  }

  if (
    input.canControlDispatch
    && input.needsAppointmentTime
    && !['accepted', 'scheduled', 'in_progress', 'completed'].includes(input.dispatchStatus ?? '')
  ) {
    return vendorAction({
      key: 'accept_service_call',
      label: 'Accept or decline service call',
      detail: 'Confirm whether you can take this service call before scheduling it.',
      href: '#vendor-next-action',
      showResponseForm: true,
      showCommercialForm: false,
      initialResponse: 'accepted',
    })
  }

  if (
    input.canControlDispatch
    && input.needsAppointmentTime
    && input.dispatchStatus === 'accepted'
    && !input.hasActiveCostOrInvoice
    && !input.workMarkedComplete
  ) {
    return vendorAction({
      key: 'send_service_charge',
      label: 'Send service charge to property manager',
      detail: 'Send the service call charge and payment timing before scheduling the appointment.',
      href: '#vendor-invoice-item',
      showResponseForm: false,
      showCommercialForm: true,
      defaultItemType: 'service_fee',
      context: 'service_call',
    })
  }

  if (input.needsAppointmentTime) {
    return vendorAction({
      key: 'add_appointment',
      label: 'Add appointment time',
      detail: 'Enter the confirmed appointment time. This appointment time will be sent to the tenant.',
      href: '#vendor-next-action',
      showResponseForm: true,
      showCommercialForm: false,
      initialResponse: 'scheduled',
    })
  }

  if (input.activeFinalInvoiceStatus === 'submitted') {
    return vendorAction({
      key: 'waiting_final_invoice_review',
      label: 'Wait for invoice review',
      detail: 'Your final invoice is with the property manager.',
      attentionLabel: 'Final invoice sent',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.activeFinalInvoiceStatus === 'approved') {
    return vendorAction({
      key: 'waiting_payment_record',
      label: 'Wait for payment record',
      detail: 'The property manager approved the final invoice and will handle the payment record.',
      attentionLabel: 'Final invoice approved',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.hasPendingCostOrInvoice) {
    return vendorAction({
      key: 'waiting_manager_cost',
      label: 'Wait for manager approval',
      detail: 'You are still selected for the service call. The amount you sent is waiting for manager approval.',
      attentionLabel: 'Waiting on manager approval',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if ((input.upfrontVendorPaymentDueCents ?? 0) > 0 && !input.workMarkedComplete) {
    return vendorAction({
      key: 'waiting_payment_record',
      label: 'Wait for upfront payment',
      detail: 'The manager approved the amount, but your payment terms require money before the work moves forward.',
      attentionLabel: 'Waiting on upfront payment',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.hasAppointmentTime && !input.hasActiveCostOrInvoice && input.canControlDispatch && !input.workMarkedComplete) {
    return vendorAction({
      key: 'send_service_charge',
      label: input.awardedFromBid ? 'Send invoice' : 'Send service charge to property manager',
      detail: input.awardedFromBid
        ? 'Send the final invoice for the approved bid. It only needs manager approval if it is higher than the approved amount.'
        : 'Send the service call charge, parts-only amount, or repair estimate for manager approval.',
      href: '#vendor-invoice-item',
      showResponseForm: false,
      showCommercialForm: true,
      defaultItemType: input.awardedFromBid ? 'bill_to_property_manager' : 'service_fee',
      context: input.awardedFromBid ? 'general' : 'service_call',
    })
  }

  if (input.hasApprovedCostOrInvoice && !input.workMarkedComplete && input.canControlDispatch) {
    return vendorAction({
      key: 'mark_complete',
      label: 'Mark work complete',
      detail: 'The cost or invoice has been approved. Mark the work complete when the service call is finished.',
      href: '#vendor-next-action',
      showResponseForm: true,
      showCommercialForm: false,
      initialResponse: 'completed',
    })
  }

  if (input.workMarkedComplete && !input.activeFinalInvoiceStatus && input.canControlDispatch) {
    return vendorAction({
      key: 'send_final_invoice',
      label: input.awardedFromBid || input.hasApprovedCostOrInvoice ? 'Send final invoice' : 'Send final bill or no-charge note',
      detail: input.awardedFromBid || input.hasApprovedCostOrInvoice
        ? 'Work is marked complete. Send the final invoice so the property manager can match it to the approved amount.'
        : 'Work is marked complete. Send the final bill, extra cost, or a no-charge note to the property manager.',
      href: '#vendor-invoice-item',
      showResponseForm: false,
      showCommercialForm: true,
      defaultItemType: input.awardedFromBid || input.hasApprovedCostOrInvoice ? 'bill_to_property_manager' : 'overcost',
      context: input.awardedFromBid || input.hasApprovedCostOrInvoice ? 'general' : 'service_call',
    })
  }

  if ((input.vendorOpenBalanceCents ?? 0) > 0) {
    return vendorAction({
      key: 'waiting_payment_record',
      label: 'Wait for payment record',
      detail: 'A payment record is open. Payments are handled outside the app.',
      attentionLabel: 'Payment record open',
      showResponseForm: false,
      showCommercialForm: false,
    })
  }

  if (input.canControlDispatch) {
    return vendorAction({
      key: 'send_update',
      label: 'Send work update',
      detail: 'Tell the property manager what happened or update work progress.',
      href: '#vendor-next-action',
      showResponseForm: true,
      showCommercialForm: false,
      initialResponse: input.hasAppointmentTime ? 'in_progress' : 'contacted',
    })
  }

  return vendorAction({
    key: 'wait',
    label: 'No action needed',
    detail: 'Waiting on the property manager.',
    showResponseForm: false,
    showCommercialForm: false,
  })
}

export function deriveVendorRequestViewState(input: VendorRequestStateInput): VendorRequestViewState {
  const inviteStatus = input.latestInvite?.status ?? null
  const inviteAwarded = inviteStatus === 'awarded' || !!input.latestInvite?.awardedAt
  const assignedToViewer = input.assignedVendorId === input.viewerVendorId
  const assignedToAnotherVendor = !!input.assignedVendorId && input.assignedVendorId !== input.viewerVendorId
  const canControlDispatch = assignedToViewer || inviteAwarded
  const isAwardedToViewer = inviteAwarded

  if (['closed', 'declined', 'canceled'].includes(input.requestStatus)) {
    const closeoutLanguage = deriveRequestCloseoutLanguage({
      status: input.requestStatus,
      billingDocuments: input.billingDocuments,
    })
    const statusLabel = closeoutLanguage.vendorLabel

    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel,
      tenderLabel: statusLabel,
      heroNotice: {
        title: statusLabel,
        detail: closeoutLanguage.detail,
        tone: input.requestStatus === 'closed' ? 'success' : 'info',
      },
    }
  }

  if (assignedToAnotherVendor) {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Scheduled with another vendor',
      tenderLabel: 'Another vendor won this job',
      heroNotice: {
        title: 'Another vendor won this job',
        detail: 'This request is no longer assigned to you, so your portal should not show its schedule as active work.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'not_awarded') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Awarded to another vendor',
      tenderLabel: 'Another vendor won this job',
      heroNotice: {
        title: 'Another vendor won this job',
        detail: 'Your bid is closed out. This request should not remain in your active scheduled queue.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'declined') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Declined by you',
      tenderLabel: 'You declined this job',
      heroNotice: {
        title: 'You declined this job',
        detail: 'This request is no longer active for your vendor account.',
        tone: 'info',
      },
    }
  }

  if (inviteAwarded) {
    const completed = input.requestStatus === 'completed'
    return {
      canControlDispatch: true,
      canSeeSchedule: true,
      shouldShowOccupant: true,
      isAwardedToViewer: true,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: completed ? 'Work completed' : input.requestStatus === 'scheduled' ? 'Scheduled with you' : 'Vendor chosen for service call',
      tenderLabel: completed ? 'Work completed' : 'Vendor chosen for service call',
      heroNotice: {
        title: completed ? 'Work completed' : 'Vendor chosen for service call',
        detail: completed ? 'The work is marked complete. Send any final charge or invoice if needed.' : 'The property manager chose your company for this service call.',
        tone: 'success',
      },
    }
  }

  if (assignedToViewer) {
    return {
      canControlDispatch: true,
      canSeeSchedule: true,
      shouldShowOccupant: true,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: input.requestStatus === 'completed' ? 'Work completed' : input.requestStatus === 'scheduled' ? 'Scheduled with you' : 'Vendor chosen for service call',
      tenderLabel: input.requestStatus === 'completed' ? 'Work completed' : 'Vendor chosen for service call',
      heroNotice: {
        title: input.requestStatus === 'completed' ? 'Work completed' : 'Vendor chosen for service call',
        detail: input.requestStatus === 'completed' ? 'The work is marked complete. Send any final charge or invoice if needed.' : 'The property manager chose your company for this service call.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'bid_submitted') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: 'Bid submitted',
      tenderLabel: 'Bid submitted',
      heroNotice: {
        title: 'Bid submitted',
        detail: 'Your bid is in. Waiting on the property manager decision.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'viewed') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: true,
      statusLabel: 'Bid invite opened',
      tenderLabel: 'Bid invite viewed',
      heroNotice: {
        title: 'Bid invite opened',
        detail: 'You have seen the invite, but the property manager has not awarded it yet.',
        tone: 'info',
      },
    }
  }

  return {
    canControlDispatch: false,
    canSeeSchedule: false,
    shouldShowOccupant: false,
    isAwardedToViewer: false,
    isOpenWork: true,
    isPendingBid: inviteStatus === 'invited',
    statusLabel: inviteStatus === 'invited' ? 'Invited to bid' : input.requestStatus.replaceAll('_', ' '),
    tenderLabel: inviteStatus === 'invited' ? 'Invited to bid' : 'Vendor chosen for service call',
    heroNotice: inviteStatus === 'invited'
      ? {
          title: 'Invited to bid',
          detail: 'Review the scope, price, and availability before the property manager approves a vendor.',
          tone: 'info',
        }
      : null,
  }
}
