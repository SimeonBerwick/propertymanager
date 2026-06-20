import type { DashboardRequestRow } from '@/lib/data'

export type DashboardNextAction = {
  id: string
  requestId: string
  title: string
  reason: string
  label: string
  href: string
  priority: 'urgent' | 'high' | 'normal'
  group: string
  score: number
  propertyName: string
  unitLabel: string
}

const CLOSED_STATUSES = ['closed', 'declined', 'canceled'] as const

function isOpen(request: DashboardRequestRow) {
  return !CLOSED_STATUSES.includes(request.status as typeof CLOSED_STATUSES[number])
}

function isOverdue(request: DashboardRequestRow, now: Date) {
  return Boolean(request.vendorScheduledEnd)
    && new Date(request.vendorScheduledEnd!).getTime() < now.getTime()
    && isOpen(request)
    && request.status !== 'completed'
}

function requestAction(request: DashboardRequestRow, now: Date): DashboardNextAction | null {
  const href = `/requests/${request.id}#actions`
  const base = {
    requestId: request.id,
    title: request.title,
    href,
    propertyName: request.propertyName,
    unitLabel: request.unitLabel,
  }

  if (isOverdue(request, now)) {
    return { ...base, id: `${request.id}:overdue`, label: 'Follow up', reason: 'The scheduled completion time has passed.', group: 'Overdue vendor updates', priority: 'urgent', score: 100 }
  }

  if (request.urgency === 'urgent' && request.status === 'requested') {
    return { ...base, id: `${request.id}:urgent-review`, label: 'Review urgent request', reason: 'A tenant marked this as urgent and it has not been reviewed.', group: 'Urgent requests', priority: 'urgent', score: 95 }
  }

  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') {
    return { ...base, id: `${request.id}:reassign`, label: 'Assign replacement', reason: 'The current vendor cannot complete the work.', group: 'Vendor reassignment', priority: 'urgent', score: 90 }
  }

  if ((request.vendorPayableBalanceCents ?? 0) > 0) {
    return { ...base, id: `${request.id}:payment`, label: 'Resolve payment', reason: 'A vendor payment balance is still open.', group: 'Payments to finish', priority: request.status === 'closed' ? 'high' : 'normal', score: request.status === 'closed' ? 88 : 72 }
  }

  if (request.reviewState === 'vendor_completed_pending_review' || request.status === 'completed') {
    return { ...base, id: `${request.id}:completion-review`, label: 'Review completion', reason: 'The vendor says work is complete and needs manager review.', group: 'Completion review', priority: 'high', score: 84 }
  }

  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') {
    return { ...base, id: `${request.id}:follow-up`, label: 'Review update', reason: 'The latest update needs a manager decision.', group: 'Follow-up needed', priority: 'high', score: 78 }
  }

  if (request.status === 'requested') {
    return { ...base, id: `${request.id}:new-review`, label: 'Review request', reason: 'This new request is waiting for a manager decision.', group: 'New requests', priority: request.urgency === 'high' ? 'high' : 'normal', score: request.urgency === 'high' ? 76 : 62 }
  }

  if (!request.assignedVendorName && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:assign`, label: 'Assign vendor', reason: 'The work is approved but no vendor is assigned.', group: 'Vendor assignment', priority: 'normal', score: 58 }
  }

  if (!request.vendorScheduledStart && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { ...base, id: `${request.id}:schedule`, label: 'Set appointment', reason: 'The vendor is selected but the work is not scheduled.', group: 'Scheduling', priority: 'normal', score: 52 }
  }

  if (!request.claimedAt && isOpen(request)) {
    return { ...base, id: `${request.id}:claim`, label: 'Take ownership', reason: 'No one has claimed this open request.', group: 'Unclaimed work', priority: 'normal', score: 40 }
  }

  return null
}

export function buildDashboardNextActions(requests: DashboardRequestRow[], now = new Date()) {
  return requests
    .map((request) => requestAction(request, now))
    .filter((action): action is DashboardNextAction => Boolean(action))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

export function groupDashboardNextActions(actions: DashboardNextAction[]) {
  const groups = new Map<string, DashboardNextAction[]>()
  for (const action of actions) {
    const group = groups.get(action.group) ?? []
    group.push(action)
    groups.set(action.group, group)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}
