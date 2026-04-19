import type { MaintenanceRequest, RequestStatus, ReviewStatus } from '@/lib/types'

export function formatDateTime(value?: string) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatRelativeAge(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function getRequestFlowState(request: Pick<MaintenanceRequest, 'status' | 'reviewState' | 'vendorScheduledEnd' | 'vendorScheduledStart'>):
  | 'scheduled-today'
  | 'overdue'
  | 'follow-up'
  | 'review'
  | RequestStatus {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  if (request.reviewState === 'vendor_completed_pending_review') return 'review'
  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') return 'follow-up'
  if (request.vendorScheduledEnd && new Date(request.vendorScheduledEnd) < now && !['completed', 'closed', 'declined', 'canceled'].includes(request.status)) return 'overdue'
  if (request.vendorScheduledStart) {
    const start = new Date(request.vendorScheduledStart)
    if (start >= todayStart && start < todayEnd) return 'scheduled-today'
  }
  return request.status
}

export function reviewStateLabel(value?: ReviewStatus) {
  switch (value) {
    case 'vendor_completed_pending_review':
      return 'Completion needs review'
    case 'needs_follow_up':
      return 'Needs follow-up'
    case 'vendor_update_pending_review':
      return 'Vendor update needs review'
    case 'reassignment_needed':
      return 'Vendor reassignment needed'
    case 'vendor_declined_reassignment_needed':
      return 'Vendor declined, reassign needed'
    case 'reopened_after_review':
      return 'Reopened after review'
    case 'approved':
      return 'Approved'
    case 'none':
    case undefined:
      return 'Clear'
    default:
      return String(value).replaceAll('_', ' ')
  }
}

export function formatClaimStatus(request: Pick<MaintenanceRequest, 'claimedAt' | 'firstReviewedAt' | 'claimedByUserId' | 'claimedByUserName'>) {
  if (request.claimedAt) {
    const owner = request.claimedByUserName ?? request.claimedByUserId ?? 'operator'
    return `Claimed by ${owner} ${formatRelativeAge(request.claimedAt)}`
  }

  if (request.firstReviewedAt) {
    return `First reviewed ${formatRelativeAge(request.firstReviewedAt)}`
  }

  return 'Unclaimed'
}

export function isStaleClaim(request: Pick<MaintenanceRequest, 'claimedAt' | 'status' | 'reviewState'>) {
  if (!request.claimedAt) return false
  if (request.status === 'closed') return false
  if (request.reviewState === 'approved') return false

  const diffMs = Date.now() - new Date(request.claimedAt).getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours >= 24
}
