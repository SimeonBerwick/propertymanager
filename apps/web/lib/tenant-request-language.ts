import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import type { RequestStatus, ReviewStatus } from '@/lib/types'

export function tenantRequestStatusLabel(status: RequestStatus) {
  return deriveRequestCloseoutLanguage({ status }).tenantLabel
}

export function tenantRequestCloseoutLabel(request: {
  status: RequestStatus
  billingDocuments?: Array<{ status?: string | null, totalCents: number, paidCents: number }>
}) {
  const hasTenantCharges = Boolean(request.billingDocuments?.length)

  return deriveRequestCloseoutLanguage({
    status: request.status,
    billingDocuments: hasTenantCharges ? request.billingDocuments : undefined,
  }).tenantLabel
}

export function tenantRequestNextStep(request: {
  status: RequestStatus
  reviewState?: ReviewStatus | null
  reviewNote?: string | null
  declineReason?: string | null
  assignedVendorName?: string | null
  vendorScheduledStart?: string | Date | null
}) {
  if (request.status === 'approved' && request.reviewState === 'vendor_declined_reassignment_needed') {
    return 'The vendor could not continue with this request. Your property manager is reviewing it and choosing the next step.'
  }

  switch (request.status) {
    case 'requested':
      return 'Your property manager will review the problem and decide the next step.'
    case 'approved':
    case 'reopened':
      return request.assignedVendorName
        ? `${request.assignedVendorName} is being contacted to arrange the work.`
        : 'Your property manager is choosing a vendor for the work.'
    case 'vendor_selected':
      return request.vendorScheduledStart
        ? 'A visit has been arranged. Check the appointment details below.'
        : 'The vendor is arranging an appointment time.'
    case 'scheduled':
      return 'The vendor is expected to attend during the confirmed appointment window.'
    case 'in_progress':
      return 'The vendor is working on the issue. You will see an update when the work is complete.'
    case 'completed':
      return 'The work is marked complete and is waiting for final review.'
    case 'closed':
      return 'No further action is expected for this request.'
    case 'declined':
      return request.declineReason || request.reviewNote || 'This request was declined by your property manager.'
    case 'canceled':
      return 'This request was canceled. Report the problem again if help is still needed.'
  }
}
