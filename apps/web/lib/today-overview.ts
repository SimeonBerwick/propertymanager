import type { DashboardRequestRow } from '@/lib/data'
import { getRequestNextAction } from '@/lib/recommended-actions'

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

function needsManagerAction(request: DashboardRequestRow, now: Date) {
  return getRequestNextAction(request, now).score > 0
}

function actionScore(request: DashboardRequestRow, now: Date) {
  return getRequestNextAction(request, now).score
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
