import type { RequestStatus } from '@/lib/types'

const SCHEDULABLE_REQUEST_STATUSES: RequestStatus[] = ['approved', 'vendor_selected', 'scheduled', 'reopened']

export function canScheduleRequest(input: {
  status: RequestStatus
  dispatchStatus?: string | null
  hasVendor: boolean
  hasOpenBidActivity: boolean
  hasAppointment: boolean
  upfrontPaymentDueCents?: number
  workComplete?: boolean
}) {
  return !input.workComplete
    && (input.upfrontPaymentDueCents ?? 0) === 0
    && input.hasVendor
    && !input.hasOpenBidActivity
    && !input.hasAppointment
    && input.dispatchStatus === 'accepted'
    && SCHEDULABLE_REQUEST_STATUSES.includes(input.status)
}
