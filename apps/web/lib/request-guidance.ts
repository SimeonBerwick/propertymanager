import type { MaintenanceRequest, Urgency } from '@/lib/types'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'

type GuidanceRequest = Pick<MaintenanceRequest,
  'id' | 'status' | 'urgency' | 'reviewState' | 'assignedVendorName' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'
>

export const WORKFLOW_STEPS = ['Review', 'Assign vendor', 'Schedule', 'Complete work', 'Close'] as const

const CATEGORY_KEYWORDS: Array<{ category: typeof REQUEST_CATEGORIES[number]; keywords: string[] }> = [
  { category: 'Plumbing', keywords: ['leak', 'pipe', 'sink', 'toilet', 'faucet', 'drain', 'water'] },
  { category: 'HVAC', keywords: ['heat', 'heating', 'air conditioning', 'ac ', 'a/c', 'furnace', 'thermostat'] },
  { category: 'Electrical', keywords: ['power', 'electric', 'outlet', 'breaker', 'light', 'sparking'] },
  { category: 'Appliance', keywords: ['fridge', 'refrigerator', 'oven', 'stove', 'dishwasher', 'washer', 'dryer'] },
  { category: 'Exterior', keywords: ['roof', 'gutter', 'fence', 'gate', 'outside', 'exterior'] },
  { category: 'Pest', keywords: ['pest', 'roach', 'mouse', 'mice', 'rat', 'ants', 'termites'] },
  { category: 'Safety', keywords: ['smoke', 'carbon monoxide', 'gas', 'fire', 'break-in', 'unsafe'] },
]

export function suggestRequestDetails(problem: string, description: string) {
  const text = `${problem} ${description}`.toLowerCase()
  const category = CATEGORY_KEYWORDS.find((option) => option.keywords.some((keyword) => text.includes(keyword)))?.category ?? 'Other'

  let urgency: Urgency = 'medium'
  if (['fire', 'gas leak', 'carbon monoxide', 'sparking', 'flood', 'break-in'].some((keyword) => text.includes(keyword))) urgency = 'urgent'
  else if (['no heat', 'no power', 'active leak', 'overflow', 'unsafe'].some((keyword) => text.includes(keyword))) urgency = 'high'
  else if (['minor', 'slow', 'cosmetic', 'when convenient'].some((keyword) => text.includes(keyword))) urgency = 'low'

  return { category, urgency }
}

export function getWorkflowStep(request: GuidanceRequest) {
  if (['closed', 'declined', 'canceled'].includes(request.status)) return 4
  if (request.status === 'completed') return 4
  if (request.status === 'in_progress') return 3
  if (request.status === 'scheduled' || request.vendorScheduledStart) return 3
  if (request.assignedVendorName || request.status === 'vendor_selected') return 2
  if (request.status === 'approved' || request.status === 'reopened') return 1
  return 0
}

export function getRecommendedAction(request: GuidanceRequest) {
  const href = `/requests/${request.id}#actions`
  if (request.reviewState === 'reassignment_needed' || request.reviewState === 'vendor_declined_reassignment_needed') {
    return { label: 'Assign a replacement vendor', detail: 'The previous vendor cannot complete this request.', href, tone: 'urgent' as const }
  }
  if (request.reviewState === 'vendor_completed_pending_review' || request.status === 'completed') {
    return { label: 'Review completion and close', detail: 'Confirm the work is complete before closing the request.', href, tone: 'review' as const }
  }
  if (request.reviewState === 'needs_follow_up' || request.reviewState === 'vendor_update_pending_review') {
    return { label: 'Review the latest update', detail: 'This request is waiting for a manager decision.', href, tone: 'review' as const }
  }
  if (request.vendorScheduledEnd && new Date(request.vendorScheduledEnd).getTime() < Date.now() && !['completed', 'closed', 'declined', 'canceled'].includes(request.status)) {
    return { label: 'Follow up on overdue work', detail: 'The scheduled completion time has passed.', href, tone: 'urgent' as const }
  }
  if (request.status === 'requested') {
    return { label: 'Review and approve request', detail: 'Confirm the issue and decide how it should move forward.', href, tone: request.urgency === 'urgent' ? 'urgent' as const : 'normal' as const }
  }
  if (!request.assignedVendorName && ['approved', 'reopened', 'vendor_selected'].includes(request.status)) {
    return { label: 'Assign a vendor', detail: 'Choose who should handle the work.', href, tone: 'normal' as const }
  }
  if (!request.vendorScheduledStart && ['approved', 'vendor_selected', 'reopened'].includes(request.status)) {
    return { label: 'Set the appointment', detail: 'Confirm when the vendor will perform the work.', href, tone: 'normal' as const }
  }
  if (request.status === 'scheduled') {
    return { label: 'Start or monitor the work', detail: 'The appointment is set and ready to progress.', href, tone: 'normal' as const }
  }
  if (request.status === 'in_progress') {
    return { label: 'Confirm progress with vendor', detail: 'Keep the tenant informed and confirm completion timing.', href, tone: 'normal' as const }
  }
  return { label: 'Review request history', detail: 'No immediate action is required.', href, tone: 'clear' as const }
}

export function getAttentionScore(request: GuidanceRequest) {
  if (['closed', 'declined', 'canceled'].includes(request.status)) return 0
  let score = request.urgency === 'urgent' ? 8 : request.urgency === 'high' ? 5 : 0
  const recommendation = getRecommendedAction(request)
  if (recommendation.tone === 'urgent') score += 8
  if (recommendation.tone === 'review') score += 5
  if (!request.assignedVendorName) score += 2
  if (!request.claimedAt) score += 1
  return score
}
