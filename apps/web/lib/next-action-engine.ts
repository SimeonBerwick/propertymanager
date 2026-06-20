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
  'id' | 'status' | 'urgency' | 'reviewState' | 'assignedVendorName' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'
> & {
  unitId?: string
  title?: string
  propertyName?: string
  unitLabel?: string
  vendorPayableBalanceCents?: number
  vendorPayableTo?: string
  tenantAccessFailureCount?: number
  tenantStatusUpdatePending?: boolean
}

const CLOSED_STATUSES = ['closed', 'declined', 'canceled'] as const

function isOpen(request: NextActionRequest) {
  return !CLOSED_STATUSES.includes(request.status as typeof CLOSED_STATUSES[number])
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

export function getRequestNextAction(request: NextActionRequest, now = new Date()): RequestNextAction {
  const base = actionBase(request)

  if ((request.tenantAccessFailureCount ?? 0) >= 3) {
    return { ...base, id: `${request.id}:tenant-access`, href: request.unitId ? `/units/${request.unitId}/edit` : base.href, primaryLabel: 'Help renter access portal', reason: `The renter has failed to access the portal ${request.tenantAccessFailureCount} times recently.`, group: 'Access help', priority: 'urgent', actionType: 'help_renter_access_portal', score: 110 }
  }

  if (isOverdue(request, now)) {
    return { ...base, id: `${request.id}:overdue`, primaryLabel: 'Follow up', reason: 'The scheduled completion time has passed.', group: 'Overdue vendor updates', priority: 'urgent', actionType: 'follow_up_overdue_work', score: 100 }
  }

  if (request.urgency === 'urgent' && request.status === 'requested') {
    return { ...base, id: `${request.id}:urgent-review`, primaryLabel: 'Review urgent request', reason: 'A tenant marked this as urgent and it has not been reviewed.', group: 'Urgent requests', priority: 'urgent', actionType: 'review_urgent_request', score: 95 }
  }

  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') {
    return { ...base, id: `${request.id}:reassign`, primaryLabel: 'Assign replacement', reason: 'The current vendor cannot complete the work.', group: 'Vendor reassignment', priority: 'urgent', actionType: 'assign_replacement_vendor', score: 90 }
  }

  if ((request.vendorPayableBalanceCents ?? 0) > 0) {
    return { ...base, id: `${request.id}:payment`, href: `/requests/${request.id}#billing`, primaryLabel: 'Collect payment before closeout', reason: `Vendor payment is still open${request.vendorPayableTo ? ` for ${request.vendorPayableTo}` : ''}.`, group: 'Payments to finish', priority: ['completed', 'closed'].includes(request.status) ? 'high' : 'normal', actionType: 'collect_payment_before_closeout', score: ['completed', 'closed'].includes(request.status) ? 88 : 72 }
  }

  if (!isOpen(request)) {
    return { ...base, id: `${request.id}:monitor`, primaryLabel: 'Review request history', reason: 'No immediate manager action is required.', group: 'Monitoring', priority: 'low', actionType: 'review_history', score: 0 }
  }

  if (request.reviewState === 'vendor_completed_pending_review') {
    return { ...base, id: `${request.id}:vendor-update-review`, primaryLabel: 'Review vendor update', reason: 'The vendor marked the work complete and needs manager review.', group: 'Completion review', priority: 'high', actionType: 'review_vendor_update', score: 84 }
  }

  if (request.status === 'completed') {
    return { ...base, id: `${request.id}:close`, primaryLabel: 'Close request', reason: 'Work is complete and payments are settled.', group: 'Closeout', priority: 'high', actionType: 'close_request', score: 82 }
  }

  if (request.tenantStatusUpdatePending) {
    return { ...base, id: `${request.id}:tenant-update`, href: `/requests/${request.id}#communication`, primaryLabel: 'Send tenant update', reason: 'The work status changed, but the renter has not been notified yet.', group: 'Tenant updates', priority: 'high', actionType: 'send_tenant_update', score: 80 }
  }

  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') {
    return { ...base, id: `${request.id}:follow-up`, primaryLabel: 'Review update', reason: 'The latest update needs a manager decision.', group: 'Follow-up needed', priority: 'high', actionType: 'review_update', score: 78 }
  }

  if (request.status === 'requested') {
    return { ...base, id: `${request.id}:new-review`, primaryLabel: 'Review request', reason: 'This new request is waiting for a manager decision.', group: 'New requests', priority: request.urgency === 'high' ? 'high' : 'normal', actionType: 'review_request', score: request.urgency === 'high' ? 76 : 62 }
  }

  if (!request.assignedVendorName && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:assign`, primaryLabel: 'Assign a vendor', reason: 'Request is approved but no vendor is assigned.', group: 'Vendor assignment', priority: 'normal', actionType: 'assign_vendor', score: 58 }
  }

  if (!request.vendorScheduledStart && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:schedule`, primaryLabel: 'Set appointment', reason: 'The vendor is selected but the work is not scheduled.', group: 'Scheduling', priority: 'normal', actionType: 'schedule_work', score: 52 }
  }

  if (!request.claimedAt && isOpen(request)) {
    return { ...base, id: `${request.id}:claim`, primaryLabel: 'Take ownership', reason: 'No one has claimed this open request.', group: 'Unclaimed work', priority: 'normal', actionType: 'claim_request', score: 40 }
  }

  return { ...base, id: `${request.id}:monitor`, primaryLabel: 'Review request history', reason: 'No immediate manager action is required.', group: 'Monitoring', priority: 'low', actionType: 'review_history', score: 0 }
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
