import type { RequestStatus } from '@/lib/types'

export function tenantEffectiveRequestStatus(request: {
  status: RequestStatus
  dispatchStatus?: string | null
  reviewState?: string | null
  dispatchHistory?: Array<{ status: string }>
}): RequestStatus {
  const dispatchCompleted = request.dispatchStatus === 'completed'
    || request.reviewState === 'vendor_completed_pending_review'
    || request.dispatchHistory?.some((entry) => entry.status === 'completed')

  if (dispatchCompleted && !['closed', 'canceled', 'declined'].includes(request.status)) return 'completed'
  return request.status
}
