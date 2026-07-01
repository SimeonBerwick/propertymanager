import type { MaintenanceRequest, RequestStatus, ReviewStatus } from '@/lib/types'

const DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || 'America/Phoenix'

export function formatDateOnly(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value))
}

export function getCityFromAddress(address: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return 'Unknown city'

  const lastPart = parts.at(-1) ?? ''
  const stateOrStateZip = /^[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/i
  const country = /^(?:USA|United States|United States of America)$/i

  if (country.test(lastPart) && parts.length >= 3) {
    const regionPart = parts.at(-2) ?? ''
    return stateOrStateZip.test(regionPart) ? parts.at(-3) ?? 'Unknown city' : regionPart
  }

  return stateOrStateZip.test(lastPart) ? parts.at(-2) ?? 'Unknown city' : lastPart
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value))
}

export function formatRelativeAge(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days > 30) {
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: DISPLAY_TIME_ZONE,
    }).format(new Date(value))
    return `on ${date}`
  }
  return `${days}d ago`
}

export function getRequestFlowState(request: Pick<MaintenanceRequest, 'status' | 'reviewState' | 'vendorScheduledEnd' | 'vendorScheduledStart'>):
  | 'reassignment'
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

  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') return 'reassignment'
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
      return 'Review completion'
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
