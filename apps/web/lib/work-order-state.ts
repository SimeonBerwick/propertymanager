import type { RequestStatus, ReviewStatus } from '@/lib/types'

export type WorkOrderAudience = 'manager' | 'tenant' | 'vendor'
export type WorkOrderTone = 'urgent' | 'review' | 'waiting' | 'success' | 'neutral'

export interface WorkOrderStateSummary {
  title: string
  detail: string
  waitingOn: string
  nextAction: string
  nextHref?: string
  tone: WorkOrderTone
  appointment?: string | null
  money?: string | null
  latest?: string | null
}

export interface WorkOrderStateInput {
  audience: WorkOrderAudience
  id: string
  status: RequestStatus
  reviewState?: ReviewStatus | null
  assignedVendorName?: string | null
  vendorScheduledStart?: string | Date | null
  pendingVendorApprovalCount?: number
  pendingBidCount?: number
  activeTenderInviteCount?: number
  billingOpenBalanceCents?: number
  vendorPayableBalanceCents?: number
  upfrontVendorPaymentDueCents?: number
  vendorBillPending?: boolean
  needsAppointmentTime?: boolean
  vendorNeedsAcceptance?: boolean
  vendorNeedsServiceCharge?: boolean
  canChooseVendor?: boolean
  hasTenantMessageReview?: boolean
  hasVendorUpdateReview?: boolean
  workMarkedComplete?: boolean
  activeFinalInvoiceStatus?: string | null
  hasPendingCostOrInvoice?: boolean
  isPendingBid?: boolean
  latestSignal?: string | null
  moneyLabel?: string | null
  appointmentLabel?: string | null
}

function managerHref(id: string) {
  return `/requests/${id}#actions`
}

function vendorActionHref(input: WorkOrderStateInput) {
  if (input.activeFinalInvoiceStatus || input.hasPendingCostOrInvoice) return undefined
  return input.needsAppointmentTime || input.isPendingBid ? '#vendor-next-action' : '#vendor-invoice-item'
}

export function deriveWorkOrderStateSummary(input: WorkOrderStateInput): WorkOrderStateSummary {
  const hasAppointment = Boolean(input.vendorScheduledStart || input.appointmentLabel)
  const appointment = input.appointmentLabel ?? (hasAppointment ? 'Appointment set' : null)
  const latest = input.latestSignal ?? null
  const money = input.moneyLabel ?? null
  const workIsComplete = input.workMarkedComplete || input.status === 'completed' || input.status === 'closed'

  if (input.status === 'canceled' || input.status === 'declined') {
    return {
      title: input.status === 'canceled' ? 'Request canceled' : 'Request declined',
      detail: 'This work order is not moving forward unless it is reopened.',
      waitingOn: 'Nobody',
      nextAction: 'Closed path',
      tone: 'neutral',
      appointment,
      money,
      latest,
    }
  }

  if (input.status === 'closed') {
    const hasOpenBalance = (input.billingOpenBalanceCents ?? 0) > 0
    return {
      title: hasOpenBalance ? 'Closed with payment still open' : 'Request closed',
      detail: hasOpenBalance ? 'The work order is closed, but a payment record still shows a balance.' : 'This repair is finished and closed.',
      waitingOn: hasOpenBalance ? 'Property manager' : 'Nobody',
      nextAction: hasOpenBalance ? 'Mark paid' : 'Done',
      nextHref: hasOpenBalance && input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: hasOpenBalance ? 'review' : 'success',
      appointment,
      money,
      latest,
    }
  }

  if (input.audience === 'vendor' && input.activeFinalInvoiceStatus) {
    const approved = input.activeFinalInvoiceStatus === 'approved'
    return {
      title: approved ? 'Final invoice approved' : 'Final invoice sent',
      detail: approved ? 'The property manager approved the invoice. Payment record cleanup is on their side now.' : 'Your invoice is with the property manager for review.',
      waitingOn: 'Property manager',
      nextAction: approved ? 'Wait for payment record' : 'Wait for review',
      tone: approved ? 'success' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if ((input.pendingVendorApprovalCount ?? 0) > 0 || input.hasPendingCostOrInvoice) {
    return {
      title: input.audience === 'manager' ? 'Vendor cost needs review' : 'Charge waiting for approval',
      detail: input.audience === 'manager'
        ? 'A vendor submitted a charge or invoice. Approve it, decline it, or ask the vendor for a different amount.'
        : 'You are selected for the service call. The amount you sent still needs manager approval before it becomes payable.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Review vendor cost' : 'Wait for review',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if ((input.pendingBidCount ?? 0) > 0) {
    return {
      title: 'Bid ready for decision',
      detail: 'A vendor has replied with pricing. Decide whether to accept it, negotiate, or choose a different path.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Review bid' : 'Wait for decision',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if (input.hasTenantMessageReview) {
    return {
      title: 'Tenant question needs reply',
      detail: 'The tenant sent a message. Reply before moving the workflow ahead.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Reply to tenant' : 'Wait for reply',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if (input.status === 'requested') {
    return {
      title: input.audience === 'tenant' ? 'Sent to property manager' : 'New request needs review',
      detail: input.audience === 'tenant' ? 'The property manager needs to review this request before a vendor is chosen.' : 'Review the request, set manager priority, and decide whether work should move forward.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Start review' : 'No action needed',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if (
    input.hasVendorUpdateReview
    && (input.billingOpenBalanceCents ?? 0) === 0
    && (input.vendorPayableBalanceCents ?? 0) === 0
    && (input.upfrontVendorPaymentDueCents ?? 0) === 0
  ) {
    return {
      title: 'Vendor update needs review',
      detail: 'The vendor sent an update. Check the update before changing the next step.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Review update' : 'Wait for review',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if (input.canChooseVendor) {
    return {
      title: 'Choose the vendor path',
      detail: 'Assign a trusted vendor for a service call, or request bids before choosing who does the repair.',
      waitingOn: 'Property manager',
      nextAction: 'Choose path',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: 'review',
      appointment,
      money,
      latest,
    }
  }

  if ((input.activeTenderInviteCount ?? 0) > 0 || input.isPendingBid) {
    return {
      title: input.audience === 'vendor' ? 'Bid invite needs response' : 'Waiting on vendor bids',
      detail: input.audience === 'vendor' ? 'Send your bid amount, timing, and availability so the property manager can decide.' : 'Bid invites are out. The next manager decision comes after vendors respond.',
      waitingOn: 'Vendor',
      nextAction: input.audience === 'vendor' ? 'Respond to invite' : 'Waiting on bids',
      nextHref: input.audience === 'vendor' ? '#vendor-next-action' : undefined,
      tone: input.audience === 'vendor' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if ((input.upfrontVendorPaymentDueCents ?? 0) > 0 && !workIsComplete) {
    return {
      title: input.audience === 'vendor' ? 'Waiting on upfront payment' : 'Upfront vendor payment needed',
      detail: input.audience === 'vendor'
        ? 'The manager approved the charge, but the payment terms require money before the work moves forward.'
        : 'The approved vendor terms require payment before scheduling, work start, or completion. Mark the payment record paid after the money is handled outside the app.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Record payment paid' : 'Wait for payment',
      nextHref: input.audience === 'manager' ? '#billing' : undefined,
      tone: input.audience === 'manager' ? 'review' : 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if (input.audience === 'vendor' && input.vendorNeedsAcceptance) {
    return {
      title: 'Service call needs your response',
      detail: 'Accept or decline this service call before scheduling it.',
      waitingOn: 'Vendor',
      nextAction: 'Accept or decline',
      nextHref: '#vendor-next-action',
      tone: 'review',
      appointment,
      money,
      latest,
    }
  }

  if (input.audience === 'vendor' && input.vendorNeedsServiceCharge) {
    return {
      title: 'Service charge needed',
      detail: 'Send the service call charge and payment timing before scheduling the appointment.',
      waitingOn: 'Vendor',
      nextAction: 'Send service charge',
      nextHref: '#vendor-invoice-item',
      tone: 'review',
      appointment,
      money,
      latest,
    }
  }

  if (input.needsAppointmentTime) {
    return {
      title: 'Appointment time needed',
      detail: input.audience === 'vendor' ? 'Add the confirmed appointment time so the tenant and property manager know when you are coming.' : 'The vendor is chosen, but the appointment time is not confirmed yet.',
      waitingOn: 'Vendor',
      nextAction: input.audience === 'tenant' ? 'No action needed' : 'Add appointment time',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : input.audience === 'vendor' ? '#vendor-next-action' : undefined,
      tone: input.audience === 'tenant' ? 'waiting' : 'review',
      appointment,
      money,
      latest,
    }
  }

  if (input.vendorBillPending) {
    return {
      title: 'Waiting on vendor invoice',
      detail: 'The work is marked complete, but there is no vendor charge or invoice on the request yet.',
      waitingOn: 'Vendor',
      nextAction: input.audience === 'vendor' ? 'Send invoice' : 'Waiting on invoice',
      nextHref: input.audience === 'vendor' ? vendorActionHref(input) : undefined,
      tone: 'waiting',
      appointment,
      money,
      latest,
    }
  }

  if ((input.billingOpenBalanceCents ?? 0) > 0 || (input.vendorPayableBalanceCents ?? 0) > 0) {
    if (!workIsComplete) {
      return {
        title: 'Approved charge recorded',
        detail: input.audience === 'vendor'
          ? 'The manager approved the amount. Finish the work, then send the final invoice or mark the call complete.'
          : 'The vendor charge is approved, but the work is not marked complete yet. Payment and closeout wait until the job is finished.',
        waitingOn: 'Vendor',
        nextAction: input.audience === 'vendor' ? 'Continue work' : 'Waiting on completion',
        nextHref: input.audience === 'vendor' ? '#vendor-next-action' : undefined,
        tone: 'waiting',
        appointment,
        money,
        latest,
      }
    }

    if ((input.billingOpenBalanceCents ?? 0) === 0 && (input.vendorPayableBalanceCents ?? 0) > 0) {
      return {
        title: 'Vendor payment record needed',
        detail: 'The vendor amount is approved, but no payment record exists yet. Create the vendor payment record in the billing panel.',
        waitingOn: 'Property manager',
        nextAction: input.audience === 'manager' ? 'Create payment record' : 'Wait for payment record',
        nextHref: input.audience === 'manager' ? '#billing' : undefined,
        tone: input.audience === 'manager' ? 'review' : 'waiting',
        appointment,
        money,
        latest,
      }
    }

    return {
      title: 'Payment record needs cleanup',
      detail: 'The job has an open balance. Mark payment records paid before closing out.',
      waitingOn: 'Property manager',
      nextAction: input.audience === 'manager' ? 'Mark paid' : 'Wait for payment record',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: 'review',
      appointment,
      money,
      latest,
    }
  }

  if (input.workMarkedComplete || input.status === 'completed') {
    return {
      title: input.audience === 'vendor' ? 'Work marked complete' : 'Work complete',
      detail: input.audience === 'manager' ? 'Check billing and closeout details before closing the request.' : 'The repair work has been marked complete.',
      waitingOn: input.audience === 'manager' ? 'Property manager' : 'Property manager',
      nextAction: input.audience === 'manager' ? 'Close out request' : 'Wait for closeout',
      nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
      tone: input.audience === 'manager' ? 'review' : 'success',
      appointment,
      money,
      latest,
    }
  }

  if (hasAppointment) {
    return {
      title: 'Appointment scheduled',
      detail: input.assignedVendorName ? `${input.assignedVendorName} is scheduled for this repair.` : 'The repair appointment is scheduled.',
      waitingOn: 'Vendor',
      nextAction: input.audience === 'tenant' ? 'Request a different time' : input.audience === 'vendor' ? 'Send update' : 'Watch appointment',
      nextHref: input.audience === 'tenant' ? '#message-manager-vendor' : input.audience === 'vendor' ? '#vendor-next-action' : undefined,
      tone: 'waiting',
      appointment,
      money,
      latest,
    }
  }

  return {
    title: input.assignedVendorName ? 'Vendor selected' : 'Request in progress',
    detail: input.assignedVendorName ? `${input.assignedVendorName} is attached to this work order.` : 'This work order is moving forward.',
    waitingOn: input.assignedVendorName ? 'Vendor' : 'Property manager',
    nextAction: input.audience === 'manager' ? 'Check next step' : 'No action needed',
    nextHref: input.audience === 'manager' ? managerHref(input.id) : undefined,
    tone: 'neutral',
    appointment,
    money,
    latest,
  }
}
