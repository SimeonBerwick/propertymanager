import type { DashboardRequestRow } from '@/lib/data'
import type { MaintenanceRequest } from '@/lib/types'

export type NextAction = {
  priority: 'urgent' | 'high' | 'normal' | 'low'
  title: string
  reason: string
  primaryLabel: string
  href?: string
  actionType?: string
  requestId?: string
}

export type RequestNextAction = NextAction & {
  id: string
  group: string
  score: number
  propertyName?: string
  unitLabel?: string
}

type NextActionRequest = Pick<MaintenanceRequest,
  'id' | 'status' | 'urgency' | 'reviewState' | 'reviewNote' | 'assignedVendorId' | 'assignedVendorName' | 'assignedVendorEmail' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'
> & {
  unitId?: string
  title?: string
  propertyName?: string
  unitLabel?: string
  vendorPayableBalanceCents?: number
  billingOpenBalanceCents?: number
  vendorBillPending?: boolean
  vendorPayableTo?: string
  pendingVendorApprovalCount?: number
  pendingBidCount?: number
  activeTenderInviteCount?: number
  tenantAccessFailureCount?: number
  tenantStatusUpdatePending?: boolean
}

const CLOSED_STATUSES = ['closed', 'declined', 'canceled'] as const
const SCORE = {
  urgentReview: 100,
  accessBlocked: 90,
  newUnclaimed: 80,
  newReview: 78,
  vendorAssignment: 70,
  bidDecision: 60,
  vendorCostApproval: 58,
  bidWaiting: 0,
  overdueUpdate: 50,
  scheduleNeeded: 48,
  tenantUpdate: 40,
  paymentIssue: 30,
  closeoutReady: 20,
  routine: 0,
} as const

function isOpen(request: NextActionRequest) {
  return !CLOSED_STATUSES.includes(request.status as typeof CLOSED_STATUSES[number])
}

function hasVendorChosen(request: NextActionRequest) {
  return Boolean(request.assignedVendorId || request.assignedVendorName || request.assignedVendorEmail)
    || ['vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed'].includes(request.status)
}

function canReviewVendorCosts(request: NextActionRequest) {
  return hasVendorChosen(request)
    || ['scheduled', 'in_progress', 'completed'].includes(request.status)
    || request.reviewState === 'vendor_completed_pending_review'
}

function isOverdue(request: NextActionRequest, now: Date) {
  return Boolean(request.vendorScheduledEnd)
    && new Date(request.vendorScheduledEnd!).getTime() < now.getTime()
    && isOpen(request)
    && request.status !== 'completed'
}

function actionBase(request: NextActionRequest) {
  return {
    requestId: request.id,
    title: request.title ?? 'Request',
    href: `/requests/${request.id}#actions`,
    propertyName: request.propertyName,
    unitLabel: request.unitLabel,
  }
}

function isTenantQuestionFollowUp(request: NextActionRequest) {
  const reviewNote = (request.reviewNote ?? '').toLowerCase()
  return request.reviewState === 'needs_follow_up'
    && (reviewNote.includes('tenant asked') || reviewNote.includes('tenant requested'))
}

export function getRequestNextAction(request: NextActionRequest, now = new Date()): RequestNextAction {
  const base = actionBase(request)

  if (request.urgency === 'urgent' && request.status === 'requested') {
    return { ...base, id: `${request.id}:urgent-review`, primaryLabel: 'Review urgent request', reason: 'A tenant marked this as urgent and it has not been reviewed.', group: 'Urgent requests', priority: 'urgent', actionType: 'review_urgent_request', score: SCORE.urgentReview }
  }

  if ((request.tenantAccessFailureCount ?? 0) >= 3) {
    return { ...base, id: `${request.id}:tenant-access`, href: request.unitId ? `/units/${request.unitId}/edit` : base.href, primaryLabel: 'Help tenant sign in', reason: `The tenant has failed to open their tenant view ${request.tenantAccessFailureCount} times recently.`, group: 'Access help', priority: 'urgent', actionType: 'help_tenant_access_portal', score: SCORE.accessBlocked }
  }

  if (request.status === 'requested' && !request.claimedAt) {
    return { ...base, id: `${request.id}:claim-new`, primaryLabel: 'Start review', reason: 'This new request is ready for review.', group: 'New requests', priority: request.urgency === 'high' ? 'high' : 'normal', actionType: 'claim_request', score: SCORE.newUnclaimed }
  }

  if (request.status === 'requested') {
    return { ...base, id: `${request.id}:new-review`, primaryLabel: 'Review request', reason: 'This new request is waiting for a manager decision.', group: 'New requests', priority: request.urgency === 'high' ? 'high' : 'normal', actionType: 'review_request', score: SCORE.newReview }
  }

  if (!isOpen(request)) {
    if ((request.vendorPayableBalanceCents ?? 0) > 0) {
      return { ...base, id: `${request.id}:payment`, href: `/requests/${request.id}#billing`, primaryLabel: 'Collect payment before closeout', reason: `Vendor payment is still open${request.vendorPayableTo ? ` for ${request.vendorPayableTo}` : ''}.`, group: 'Payments to finish', priority: 'normal', actionType: 'collect_payment_before_closeout', score: SCORE.paymentIssue }
    }
    return { ...base, id: `${request.id}:monitor`, primaryLabel: 'View details', reason: 'No immediate manager action is required.', group: 'Monitoring', priority: 'low', actionType: 'review_history', score: SCORE.routine }
  }

  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') {
    return { ...base, id: `${request.id}:reassign`, primaryLabel: 'Assign replacement', reason: 'The current vendor cannot complete the work.', group: 'Vendor assignment', priority: 'high', actionType: 'assign_replacement_vendor', score: SCORE.vendorAssignment }
  }

  if ((request.pendingBidCount ?? 0) > 0) {
    return { ...base, id: `${request.id}:award-bid`, primaryLabel: 'Approve bid', reason: `${request.pendingBidCount} vendor bid${request.pendingBidCount === 1 ? ' is' : 's are'} waiting for manager approval.`, group: 'Bid decisions', priority: 'normal', actionType: 'award_bid', score: SCORE.bidDecision }
  }

  if ((request.activeTenderInviteCount ?? 0) > 0) {
    return { ...base, id: `${request.id}:wait-for-bids`, primaryLabel: 'Wait for bids', reason: `${request.activeTenderInviteCount} bid invitation${request.activeTenderInviteCount === 1 ? ' is' : 's are'} still out with vendors.`, group: 'Vendor bids', priority: 'low', actionType: 'monitor_vendor_bids', score: SCORE.bidWaiting }
  }

  if (!hasVendorChosen(request) && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:assign`, primaryLabel: 'Assign service call', reason: 'Choose a trusted vendor for the service call, or ask vendors for repair bids first.', group: 'Vendor assignment', priority: 'normal', actionType: 'assign_vendor', score: SCORE.vendorAssignment }
  }

  if ((request.pendingVendorApprovalCount ?? 0) > 0 && canReviewVendorCosts(request)) {
    return { ...base, id: `${request.id}:vendor-cost-approval`, href: `/requests/${request.id}#vendor-approvals`, primaryLabel: 'Vendor costs to approve', reason: `${request.pendingVendorApprovalCount} vendor cost${request.pendingVendorApprovalCount === 1 ? ' needs' : 's need'} approval before closing the request.`, group: 'Vendor costs to approve', priority: 'high', actionType: 'review_vendor_costs', score: SCORE.vendorCostApproval }
  }

  if (isOverdue(request, now)) {
    return { ...base, id: `${request.id}:overdue`, primaryLabel: 'Follow up', reason: 'The scheduled completion time has passed.', group: 'Overdue vendor updates', priority: 'high', actionType: 'follow_up_overdue_work', score: SCORE.overdueUpdate }
  }

  if (request.reviewState === 'vendor_completed_pending_review') {
    return { ...base, id: `${request.id}:vendor-update-review`, href: `/requests/${request.id}#vendor-update-review`, primaryLabel: 'Review completed work', reason: 'The vendor marked the work complete and needs manager review.', group: 'Vendor updates', priority: 'high', actionType: 'review_vendor_update', score: SCORE.overdueUpdate }
  }

  if (isTenantQuestionFollowUp(request)) {
    return { ...base, id: `${request.id}:tenant-message-review`, href: `/requests/${request.id}?comment=tenant#tenant-message-review`, primaryLabel: 'Review tenant question', reason: 'The tenant asked a question about this work order.', group: 'Tenant messages', priority: 'high', actionType: 'review_tenant_message', score: SCORE.overdueUpdate }
  }

  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') {
    return { ...base, id: `${request.id}:follow-up`, href: `/requests/${request.id}#vendor-update-review`, primaryLabel: 'Review update', reason: 'The latest vendor update needs a manager decision.', group: 'Vendor updates', priority: 'high', actionType: 'review_update', score: SCORE.overdueUpdate }
  }

  if (hasVendorChosen(request) && !request.vendorScheduledStart && ['approved', 'vendor_selected', 'scheduled', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:schedule`, primaryLabel: 'Add appointment time', reason: 'A vendor has been selected, but no appointment time is on the request yet.', group: 'Scheduling', priority: 'normal', actionType: 'schedule_work', score: SCORE.scheduleNeeded }
  }

  if (request.tenantStatusUpdatePending) {
    return { ...base, id: `${request.id}:tenant-update`, href: `/requests/${request.id}?comment=tenant#communication`, primaryLabel: 'Send tenant update', reason: 'The work status changed, but the tenant has not been notified yet.', group: 'Tenant updates', priority: 'normal', actionType: 'send_tenant_update', score: SCORE.tenantUpdate }
  }

  if (request.vendorScheduledStart && request.status === 'scheduled') {
    return { ...base, id: `${request.id}:scheduled`, primaryLabel: 'Wait for appointment', reason: 'The vendor is scheduled. No manager action is needed right now.', group: 'Monitoring', priority: 'low', actionType: 'monitor_scheduled_work', score: SCORE.routine }
  }

  if (request.vendorBillPending) {
    return { ...base, id: `${request.id}:await-vendor-bill`, href: `/requests/${request.id}#billing`, primaryLabel: 'Await vendor bill', reason: 'Work is marked complete, but no vendor charge or bill is recorded yet.', group: 'Vendor billing', priority: 'normal', actionType: 'await_vendor_bill', score: SCORE.paymentIssue }
  }

  if ((request.billingOpenBalanceCents ?? 0) > 0 || (request.vendorPayableBalanceCents ?? 0) > 0) {
    return { ...base, id: `${request.id}:payment`, href: `/requests/${request.id}#billing`, primaryLabel: 'Settle billing before closeout', reason: 'Vendor payment or a billing document still has an open balance.', group: 'Payments to finish', priority: 'normal', actionType: 'collect_payment_before_closeout', score: SCORE.paymentIssue }
  }

  if (request.status === 'completed') {
    return { ...base, id: `${request.id}:close`, primaryLabel: 'Close request', reason: 'Work is complete and payments are settled.', group: 'Closeout', priority: 'normal', actionType: 'close_request', score: SCORE.closeoutReady }
  }

  return { ...base, id: `${request.id}:monitor`, primaryLabel: 'View details', reason: 'No immediate manager action is required.', group: 'Monitoring', priority: 'low', actionType: 'review_history', score: SCORE.routine }
}

export function buildDashboardNextActions(requests: DashboardRequestRow[], now = new Date()) {
  return requests
    .map((request) => getRequestNextAction(request, now))
    .filter((action) => action.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

export function groupDashboardNextActions(actions: RequestNextAction[]) {
  const groups = new Map<string, RequestNextAction[]>()
  for (const action of actions) {
    const group = groups.get(action.group) ?? []
    group.push(action)
    groups.set(action.group, group)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}
