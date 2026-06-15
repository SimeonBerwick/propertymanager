import type { DashboardRequestRow } from '@/lib/data'

const CLOSED_STATUSES = ['closed', 'declined', 'canceled'] as const
const REVIEW_STATES = [
  'needs_follow_up',
  'vendor_update_pending_review',
  'vendor_completed_pending_review',
  'reassignment_needed',
  'vendor_declined_reassignment_needed',
] as const

function isOpen(request: DashboardRequestRow) {
  return !CLOSED_STATUSES.includes(request.status as typeof CLOSED_STATUSES[number])
}

function isOverdue(request: DashboardRequestRow, now: Date) {
  return Boolean(request.vendorScheduledEnd)
    && new Date(request.vendorScheduledEnd!).getTime() < now.getTime()
    && isOpen(request)
    && request.status !== 'completed'
}

function needsManagerAction(request: DashboardRequestRow, now: Date) {
  if (!isOpen(request)) return false
  if (request.status === 'requested' || request.status === 'completed') return true
  if (isOverdue(request, now)) return true
  if (REVIEW_STATES.includes(request.reviewState as typeof REVIEW_STATES[number])) return true
  if (!request.assignedVendorName && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) return true
  if (!request.vendorScheduledStart && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) return true
  return false
}

function actionScore(request: DashboardRequestRow, now: Date) {
  let score = 0
  if (isOverdue(request, now)) score += 20
  if (request.urgency === 'urgent') score += 12
  if (request.urgency === 'high') score += 8
  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') score += 10
  if (request.reviewState === 'vendor_completed_pending_review' || request.status === 'completed') score += 7
  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') score += 6
  if (request.status === 'requested') score += 5
  if (!request.assignedVendorName) score += 3
  if (!request.claimedAt) score += 1
  return score
}

function completionTime(request: DashboardRequestRow) {
  return new Date(request.actualCompletedAt ?? request.closedAt ?? request.createdAt).getTime()
}

export function buildTodayOverview(requests: DashboardRequestRow[], now = new Date()) {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const needsYourAction = requests
    .filter((request) => needsManagerAction(request, now))
    .sort((a, b) => actionScore(b, now) - actionScore(a, now) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const scheduledToday = requests
    .filter((request) => {
      if (!request.vendorScheduledStart || !isOpen(request) || request.status === 'completed') return false
      const start = new Date(request.vendorScheduledStart)
      return start >= todayStart && start < todayEnd
    })
    .sort((a, b) => new Date(a.vendorScheduledStart!).getTime() - new Date(b.vendorScheduledStart!).getTime())

  const overdue = requests
    .filter((request) => isOverdue(request, now))
    .sort((a, b) => new Date(a.vendorScheduledEnd!).getTime() - new Date(b.vendorScheduledEnd!).getTime())

  const actionIds = new Set(needsYourAction.map((request) => request.id))
  const waitingOnOthers = requests
    .filter((request) => isOpen(request) && request.status !== 'completed' && !actionIds.has(request.id))
    .sort((a, b) => new Date(a.vendorScheduledStart ?? a.createdAt).getTime() - new Date(b.vendorScheduledStart ?? b.createdAt).getTime())

  const recentlyCompleted = requests
    .filter((request) => request.status === 'completed' || request.status === 'closed')
    .sort((a, b) => completionTime(b) - completionTime(a))

  return { needsYourAction, scheduledToday, overdue, waitingOnOthers, recentlyCompleted }
}
